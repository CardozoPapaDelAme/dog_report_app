# Secuencia: detalle público de zona y denuncia

La API no expone una consulta por `zone_id` ni miembros de un cluster. La aplicación
usa la proyección pública contratada, filtra localmente por el área visible usando
solo ubicaciones aproximadas y envía la denuncia por la ruta pública exacta.

```mermaid
sequenceDiagram
  actor Reporter as anonymous public reporter
  participant App as Aplicación React Native
  participant C as Hono Controller
  participant S as PublicMapService / FlagService
  participant R as Repositories
  participant DB as PostgreSQL / PostGIS / RLS
  participant P as JSON Presenter

  Reporter->>App: Toca un cluster o área del mapa
  App->>C: GET /public/reports con since y limit
  C->>S: listReports(query, actor público)
  S->>DB: BEGIN, SET LOCAL app.role=anonymous
  S->>R: Consultar reportes públicos
  R->>DB: SELECT parametrizado bajo RLS
  DB-->>R: Visibles, vigentes y canónicos con ubicación aproximada
  R-->>S: Reportes públicos autorizados
  S->>DB: COMMIT
  S->>P: PublicReportView[]
  P-->>App: 200 data=PublicReportView[]
  App->>App: Filtrar por área visible sin reconstruir coordenadas exactas
  App-->>Reporter: Mostrar reportes públicos del área

  Reporter->>App: Denuncia un reporte y selecciona motivo
  App->>C: POST /reports/:report_id/flags sin Authorization
  C->>S: submitFlag(report_id, reason, detail, fingerprint)
  S->>DB: BEGIN, SET LOCAL app.role/app.origin_hash
  S->>R: Bloquear reporte y aplicar límite, unicidad y umbral
  R->>DB: Sentencias parametrizadas y auditoría de auto-ocultamiento
  alt Denuncia aceptada
    DB-->>R: Denuncia creada, estado visible o hidden
    S->>DB: COMMIT
    S->>P: flag_id y report_status
    P-->>App: 201 data=flag_id, report_status
    App-->>Reporter: Confirmar denuncia
  else Reporte no denunciable
    S->>DB: ROLLBACK
    S->>P: Mapear error sin revelar existencia privada
    P-->>App: 404 report_not_flaggable
    App-->>Reporter: Informar que no puede denunciarse
  else Origen repetido o cuota agotada
    S->>DB: ROLLBACK
    S->>P: Mapear conflicto o límite
    P-->>App: 409 flag_already_submitted o 429 flag_rate_limit_exceeded
    App-->>Reporter: Informar que no se registró otra denuncia
  end
```

## Rutas y brecha contractual

| Ruta | Uso |
|---|---|
| `GET /public/reports?since=<timestamp>&limit=<1..1000>` | Obtener únicamente la proyección pública aproximada |
| `POST /reports/:report_id/flags` | Registrar motivo tipificado, detalle opcional y fingerprint de origen |

**Brecha:** no existe `GET /public/zones/:zone_id/reports`, consulta por viewport
para pines ni endpoint de miembros de cluster. Un detalle exacto por cluster/zona
requiere una ampliación de `docs/API.md`; no se sustituye con SQL directo.

## Fuentes

- [`../../API.md`](../../API.md): proyección pública, comando de denuncia y errores.
- [`../../DATA-MODEL.md`](../../DATA-MODEL.md): visibilidad, canonicidad y umbral de denuncias.
- [`../../SECURITY.md`](../../SECURITY.md): minimización de ubicación y diversidad de origen.
