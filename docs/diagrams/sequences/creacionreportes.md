# Secuencia: creación y sincronización de reporte

El reporte se guarda primero en una cola local durable con su UUID final. La foto
única es opcional, permanece en un archivo privado local y se carga solo después
de aceptar el reporte.

```mermaid
sequenceDiagram
  actor Reporter as anonymous public reporter
  participant App as Aplicación React Native
  participant Queue as Expo SQLite + archivo local
  participant C as Hono Controller
  participant S as ReportService / PhotoService
  participant R as Repositories
  participant DB as PostgreSQL / PostGIS / RLS
  participant Storage as Storage privado
  participant P as JSON Presenter

  Reporter->>App: Completa incidente, avistamiento, ubicación y detalles
  opt Captura la foto opcional
    App->>App: Validar perro y calidad offline
    alt Foto HEIC o HEIF
      App->>App: Normalizar orientación, convertir a JPEG y quitar metadatos
    else Foto JPEG o PNG
      App->>App: Reducir dimensiones/bytes y quitar metadatos
    end
  end
  App->>Queue: Guardar UUID final, payload, estado queued y archivo opcional

  alt Sin conexión
    Queue-->>App: Estado queued conservado
    App-->>Reporter: Mostrar sincronización pendiente
  else Con conexión
    App->>Queue: Cambiar estado local a submitting
    App->>C: POST /reports sin Authorization
    C->>S: createReport(command, fingerprint)
    S->>DB: BEGIN, SET LOCAL app.role/app.origin_hash
    S->>R: Verificar replay por UUID y hash de payload
    R->>DB: SELECT parametrizado bajo RLS
    alt Replay idéntico
      S->>DB: COMMIT
      S->>P: Recibo original
      P-->>App: 200 data=ReportReceiptView
    else UUID con contenido distinto
      S->>DB: ROLLBACK
      S->>P: Mapear conflicto
      P-->>App: 409 report_id_payload_conflict
      App->>Queue: Cambiar estado local a terminal_error
    else Reporte nuevo
      S->>R: Validar geofence/configuración y consumir cuota atómica
      R->>DB: Sentencias parametrizadas, insertar y evaluar confianza
      alt Cuota agotada
        S->>DB: ROLLBACK
        S->>P: Mapear límite con Retry-After
        P-->>App: 429 report_rate_limit_exceeded
        App->>Queue: Cambiar estado local a retry_wait
      else Geofence no configurado
        S->>DB: ROLLBACK
        S->>P: Mapear indisponibilidad
        P-->>App: 503 geofence_not_configured
        App->>Queue: Conservar payload para reintento acotado
      else Entrada determinísticamente inválida
        S->>DB: ROLLBACK
        S->>P: Mapear error de entrada contratado
        P-->>App: 400 invalid_request, invalid_coordinates, invalid_details o client_created_at_out_of_bounds
        App->>Queue: Cambiar estado local a terminal_error
      else Reporte aceptado
        DB-->>R: pending_review o visible por confianza alta
        S->>DB: COMMIT
        S->>P: ReportReceiptView
        P-->>App: 201 data=ReportReceiptView
      end
    end

    opt Recibo del reporte aceptado: 201 o replay idéntico 200
      opt photo_expected=true
        App->>Queue: Cambiar estado local a uploading
        App->>C: POST /reports/:report_id/photo con X-Device-Fingerprint y multipart photo
        C->>S: Adaptar multipart y validar bytes, MIME, dimensiones, decode y cuota
        alt Foto o cuota inválida
          S->>P: Mapear error tipificado
          P-->>App: 413 photo_too_large, 415 unsupported_photo_type, 422 photo_decode_failed o 429 photo_rate_limit_exceeded
          App->>Queue: Conservar para retry_wait solo cuando el error sea reintentable
        else Foto válida
          S->>DB: BEGIN, SET LOCAL app.role/app.origin_hash
          S->>R: Validar vínculo y consultar identidad por report_id y source hash
          R->>DB: SELECT parametrizado bajo RLS
          alt Mismo source hash ya registrado
            S->>DB: COMMIT
            S->>P: Estado actual de foto
            P-->>App: 200 replay
          else Source hash diferente
            S->>DB: ROLLBACK
            S->>P: Mapear conflicto
            P-->>App: 409 photo_content_conflict
            App->>Queue: Cambiar estado local a terminal_error
          else Foto nueva
            S->>R: Guardar salida JPEG/PNG saneada con autorización backend
            R->>Storage: Escribir ruta privada estable
            S->>R: Registrar hash, metadatos saneados, estado y confianza
            R->>DB: Sentencias parametrizadas bajo RLS
            alt Falla SQL después de escribir el objeto
              S->>R: Compensar objeto privado
              R->>Storage: Eliminar objeto idempotentemente
              S->>DB: ROLLBACK
              P-->>App: 5xx tipificado
              App->>Queue: Conservar el mismo archivo para retry_wait
            else Registro confirmado
              S->>DB: COMMIT
              S->>P: Estado actual de foto
              P-->>App: 201 JSON
              App->>Queue: Cambiar a awaiting_processing si aún procesa
            end
          end
        end

        loop Hasta estado terminal o siguiente reintento acotado
          App->>C: GET /reports/:report_id/photo-status con X-Device-Fingerprint
          C->>S: getPhotoStatus(report_id, origin)
          S->>DB: BEGIN, SET LOCAL app.role/app.origin_hash
          S->>R: Consultar estado para el origen remitente
          R->>DB: SELECT parametrizado bajo RLS
          S->>DB: COMMIT
          S->>P: PhotoStatusView
          P-->>App: 200 data=PhotoStatusView
        end
        App->>Queue: Limpiar archivo solo si local_cleanup_allowed=true
      end
      App->>Queue: Cambiar transporte local aceptado a synced
      App-->>Reporter: Mostrar resultado de sincronización
    end
  end
```

Los estados locales `queued`, `submitting`, `uploading`, `awaiting_processing`,
`retry_wait`, `synced` y `terminal_error` nunca se escriben como estado de
moderación. Un `5xx` transitorio conserva payload y foto para reintentar el mismo
UUID/contenido. El servidor nunca persiste HEIC/HEIF ni EXIF crudo.
Los estados terminales de foto `approved`, `rejected`, `purge_pending` y `purged`
detienen el reintento; la retención conserva su flujo convergente de marcado,
borrado privado y confirmación.

## Brecha contractual

`docs/API.md` exige rechazar reportes nuevos fuera del geofence, pero no asigna un
código de error específico a ese caso. El diagrama no inventa uno; la ampliación
del contrato debe nombrarlo antes de implementarlo.

## Fuentes

- [`../../API.md`](../../API.md): `POST /reports` y rutas de estado/carga de foto.
- [`../../DATA-MODEL.md`](../../DATA-MODEL.md): estados locales, moderación, foto e idempotencia.
- [`../../SECURITY.md`](../../SECURITY.md): imagen no confiable, privacidad y límites durables.
