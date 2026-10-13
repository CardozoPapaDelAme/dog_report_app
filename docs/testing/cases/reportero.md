# Casos de prueba — Reportero público (T5)

Estado: casos especificados para T5 / TD-118. Este documento cubre los tests
existentes y los tests nuevos de RF02, RF05, RF07, RF04, RNF10, RNF32 y RNF36.
Las ejecuciones de T5 están registradas en `docs/testing/TEST_LOG.md` como RUN-117
a RUN-123 (RUN-123 bloqueado: TC-REPORTE-15 y TC-REPORTE-16). Después se
registraron RUN-138 (TC-REPORTE-15 y TC-REPORTE-16 con PostgreSQL/PostGIS real,
pasó) y RUN-140 a RUN-144 (TC-REPORTE-18, 25, 26, 28 y 29, pasó).
Convenciones: `docs/testing/README.md`. Responsable: Erick Herrera Luna (P3).

Fuentes: `docs/product/ETAPA1-REQUERIMIENTOS-V2.md`, `docs/API.md`,
`docs/DATA-MODEL.md`, `docs/testing/BACKLOG.md` (T5), evidencia T7 en
`docs/testing/ALPHA.md` y datos sintéticos en
`docs/testing/data/reportero-casos.json`.

Entorno de los casos automatizados: Deno y Playwright con datos simulados. Las
suites que citan `supabase/functions/api/tests/reportPostgres.test.js` requieren
PostgreSQL/PostGIS aislado mediante `node scripts/test-postgres.mjs report`. Los
casos de RF09, RF22, RNF08 y RNF12 enlazan la evidencia Android real de T7:
`docs/testing/ALPHA.md` y `docs/testing/data/alpha/2026-10-11/`.

## Entrada → resultado esperado

### Cámara, anonimato y cola local

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|
| TC-REPORTE-01 | RF07, HU-07 | normal | Playwright; fixture `?camera` | Pantalla inicial del reportero | 1. Abrir `/?camera`; 2. Revisar pantalla inicial | La cámara es la primera pantalla pública; el formulario no aparece antes de una acción del usuario | `tests/ui/reportForm.spec.js` — opens the public reporter on the camera screen and starts a no-photo draft from quick access |
| TC-REPORTE-02 | RF05, RF03, HU-05 | mínimo | Playwright; cámara con stub | Botón «Reportar sin foto» | 1. Abrir `/?camera`; 2. Pulsar «Reportar sin foto» | El acceso rápido es visible y abre un borrador con estado «Sin foto» | `tests/ui/reportForm.spec.js` — opens the public reporter on the camera screen and starts a no-photo draft from quick access; T7 `docs/testing/ALPHA.md` TC-ALPHA-02 y TC-ALPHA-13 |
| TC-REPORTE-03 | RF02, HU-02 | excepción | Playwright; formulario público | Sin campos de identidad | 1. Abrir `/?report`; 2. Revisar el aviso; 3. Buscar campos de nombre, teléfono y correo | El aviso «No ingreses datos personales» es visible; no existen campos de identidad del reportante | `tests/ui/reportForm.spec.js` — shows RF02 privacy warning and does not render reporter identity fields; T7 dejó la falla original en `docs/testing/data/alpha/2026-10-11/TC-ALPHA-14-sin-aviso-rf02.mp4` y la verificación Android corregida en `docs/testing/data/alpha/2026-10-12/TC-ALPHA-14-aviso-rf02-visible.jpg` |
| TC-REPORTE-04 | RF01, RNF26, HU-01 | promedio | Playwright; API interceptada | Formulario válido sin sesión | 1. Enviar el reporte; 2. Hacer doble clic en enviar; 3. Revisar payload | Se envía un solo POST anónimo; conserva UUID local; la huella cruda viaja como señal antiabuso sin crear cuenta | `tests/ui/reportForm.spec.js` — submits one frozen payload with raw fingerprint and no duplicate POST on double tap; `supabase/functions/api/controllers/reportController.test.js` — report parser passes the raw device fingerprint separately without trimming it |
| TC-REPORTE-05 | RF01, RNF12, HU-01 | excepción | Playwright; primer POST falla con 503 | Reporte válido sin foto | 1. Enviar; 2. Volver a cámara; 3. Reintentar manualmente | La app guarda el reporte en cola local y el reintento converge sin duplicar | `tests/ui/reportForm.spec.js` — network failure saves the report for sync, camera shows the queue, and manual retry converges; T7 TC-ALPHA-15 y TC-ALPHA-16 |
| TC-REPORTE-06 | RNF12 | máximo | Deno; resumen de cola local | Estados `queued`, `retry_wait`, `terminal_error`, `synced` | 1. Construir el resumen; 2. Calcular reintentos | La cola separa pendientes, terminales y completados; respeta backoff y estado ocupado | `models/reportDraft.test.js` — RNF12 queue summary separates pending, terminal and completed local states; `models/reportDraft.test.js` — RNF12 queue summary respects Retry-After/backoff and manual sync busy state; T7 TC-ALPHA-17 |
| TC-REPORTE-07 | RNF12 | excepción | Playwright; cola terminal | Draft con `terminal_error` | 1. Abrir cámara con cola terminal; 2. Buscar acción de reintento | Se muestra atención al usuario y no aparece reintento manual para un estado terminal | `tests/ui/reportForm.spec.js` — terminal local queue state is visible as attention and cannot be retried |

### Formulario dinámico, categorías y `details`

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|
| TC-REPORTE-08 | RF04, HU-04 | excepción | Deno; `docs/testing/data/reportero-casos.json` | `cantidad_aprox = 1` para `manada` | 1. Validar formulario; 2. Revisar errores | Rechazo `integerRange`, rango 2 a 1000 | `models/reportPayload.test.js` — L7 form requires pack quantity from 2 to 1000 only for avistamiento manada; T7 TC-ALPHA-11 |
| TC-REPORTE-09 | RF04, HU-04 | mínimo | Deno; `docs/testing/data/reportero-casos.json` | `cantidad_aprox = 2` | 1. Validar formulario; 2. Revisar `details` | Se acepta y `details.cantidad_aprox = 2` | `models/reportPayload.test.js` — L7 form requires pack quantity from 2 to 1000 only for avistamiento manada; T7 TC-ALPHA-08 |
| TC-REPORTE-10 | RF04, HU-04 | promedio | Deno; `docs/testing/data/reportero-casos.json` | `cantidad_aprox = 500` | 1. Validar formulario; 2. Revisar `details` | Se acepta y `details.cantidad_aprox = 500` | `models/reportPayload.test.js` — L7 form requires pack quantity from 2 to 1000 only for avistamiento manada |
| TC-REPORTE-11 | RF04, HU-04 | máximo | Deno; `docs/testing/data/reportero-casos.json` | `cantidad_aprox = 1000` | 1. Validar formulario; 2. Revisar `details` | Se acepta y `details.cantidad_aprox = 1000` | `models/reportPayload.test.js` — L7 form requires pack quantity from 2 to 1000 only for avistamiento manada; T7 TC-ALPHA-09 |
| TC-REPORTE-12 | RF04, HU-04 | excepción | Deno; `docs/testing/data/reportero-casos.json` | `cantidad_aprox = 1001` | 1. Validar formulario; 2. Revisar errores | Rechazo `integerRange`, rango 2 a 1000 | `models/reportPayload.test.js` — L7 form requires pack quantity from 2 to 1000 only for avistamiento manada; T7 TC-ALPHA-10 |
| TC-REPORTE-13 | RF06, RF24, RNF11, HU-06, HU-24 | promedio | Playwright; formulario público | Cambios entre avistamiento, ataque humano, mascota, ganado, perro lastimado y otro | 1. Cambiar tipo de incidente; 2. Revisar preguntas; 3. Revisar que no queden campos obsoletos | Solo aparecen las preguntas permitidas por categoría y el payload conserva las claves válidas | `tests/ui/reportForm.spec.js` — shows only the conditional questions allowed for the selected incident; `models/reportPayload.test.js` — L7 conditional incident sections build only their allowed details |
| TC-REPORTE-14 | RF06, RF24, RNF11, HU-24 | excepción | Deno; parser del backend | `details` fuera del contrato dinámico | 1. Parsear reporte; 2. Intentar servicio | El backend rechaza con `invalid_details` antes de persistir | `supabase/functions/api/controllers/reportController.test.js` — report parser rejects dynamic details that do not match the incident contract; `supabase/functions/api/services/reportService.test.js` — report detail trigger failures remain invalid_details |
| TC-REPORTE-15 | RNF36, RF24 | mínimo/máximo/promedio | PostgreSQL/PostGIS aislado | Solitario 1, manada 2/500/1000, y categorías con `details` válidos | 1. Ejecutar suite `report`; 2. Insertar filas contra `public.reports` | El trigger real acepta los `details` válidos y persiste las filas | `supabase/functions/api/tests/reportPostgres.test.js` — RNF36 SQL: report details are validated by the real PostgreSQL trigger |
| TC-REPORTE-16 | RNF36, RF24 | excepción | PostgreSQL/PostGIS aislado | Manada 1/1001, falta `hubo_mordida`, clave extra y descripción de 2001 caracteres | 1. Ejecutar suite `report`; 2. Insertar filas inválidas | El trigger real falla con mensajes específicos y no deja filas parciales | `supabase/functions/api/tests/reportPostgres.test.js` — RNF36 SQL: report details are validated by the real PostgreSQL trigger |

### Foto, validación local, color y saneamiento

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|
| TC-REPORTE-17 | RF03, HU-03 | mínimo | Deno; payload sin foto | `photo_file_uri = null` | 1. Construir payload; 2. Leer `photo` | El reporte se envía sin foto y `photo.expected = false` | `models/reportPayload.test.js` — PV-1 client_check_passed is true only when validation actually accepted the photo; `services/reportApi.test.js` — L6 report API submits JSON report payload through public Hono route |
| TC-REPORTE-18 | RF03, HU-03 | máximo | Deno; foto local validada | Un archivo de foto local por reporte | 1. Enviar reporte; 2. Subir foto con el recibo del reporte; 3. Consultar estado | Solo se sube después del reporte aceptado; se usa el `report_id` del recibo y el estado de foto queda pendiente o final | `hooks/reportDraftQueueController.test.js` — L8 queue controller sends photo only after L7 receipt and uses receipt report id; `tests/ui/reportForm.spec.js` — sets honeypot signal when a hidden field is filled and surfaces pending photo state |
| TC-REPORTE-19 | RF09, RNF08, HU-09 | promedio | Deno; modelo simulado | Foto nítida de perro | 1. Clasificar; 2. Calcular nitidez | La foto se acepta si la probabilidad de perro y la nitidez superan umbrales | `services/photoInference.test.js` — PV-1 dog + sharp photo is accepted (float32 logits, input scaled to 0..1); T7 TC-ALPHA-03 y TC-ALPHA-06 |
| TC-REPORTE-20 | RF09, RNF08, HU-09 | excepción | Deno; modelo simulado | Foto sin perro, borrosa, modelo no disponible o timeout | 1. Ejecutar validación; 2. Revisar razones | Se rechaza por `no_dog` o `blurry`; si el modelo no está disponible se falla abierto con razón explícita | `services/photoInference.test.js` — PV-1 non-dog class sums below the threshold and is rejected as no_dog; `services/photoInference.test.js` — PV-1 flat (blurry) dog photo is rejected as blurry; both failures report both reasons; T7 TC-ALPHA-04 y TC-ALPHA-05 |
| TC-REPORTE-21 | RF22, HU-22 | mínimo/promedio/máximo | Deno y Playwright; fotos sintéticas de color | Colores del vocabulario, centro ponderado y dos colores fuertes | 1. Detectar color; 2. Mostrar sugerencia; 3. Cambiar o limpiar manualmente | El color detectado pertenece al vocabulario fijo; el usuario puede sobreescribirlo o enviarlo como `null` | `models/dogColor.test.js` — RF22 vocabulary is the fixed Spanish set used by fixtures and docs; `tests/ui/reportForm.spec.js` — shows the detected dog colour, lets the user change it, and sends the manual choice; T7 TC-ALPHA-07 |
| TC-REPORTE-22 | RF22, HU-22 | excepción | Deno; imagen no usable o color desconocido | Fondo verde, ruido difuso o color fuera del vocabulario | 1. Detectar color; 2. Construir payload | La detección devuelve `null` o el formulario rechaza el color desconocido; no se inventa un color | `models/dogColor.test.js` — RF22 background-only (grass) and unusable inputs return null; `models/reportPayload.test.js` — RF22 predominant_color is filled from the form (auto-detected) and manual choice overrides it |
| TC-REPORTE-23 | RNF10 | excepción | Deno; servicio de foto con dobles | Sanitizador devuelve bytes limpios y metadatos fuente falsos | 1. Subir foto; 2. Capturar `approvePhoto` y `uploadStorageObject` | Solo persisten MIME, tamaño, dimensiones, hash y ruta privada; no persisten EXIF crudo, GPS EXIF, nombre de archivo ni metadatos fuente | `supabase/functions/api/services/photoService.test.js` — raw EXIF and source metadata are not persisted for approved photos |
| TC-REPORTE-24 | RNF32 | excepción | Deno; controller de foto | Servicio lanza `unsupported_media_type` | 1. Subir multipart con tipo no soportado; 2. Leer respuesta | HTTP 415 con código público `unsupported_photo_type` | `supabase/functions/api/controllers/photoController.test.js` — photo upload maps unsupported sanitizer media to public 415 unsupported_photo_type |

### Geofence, confianza, honeypots y denuncias

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|
| TC-REPORTE-25 | RNF09 | excepción | Deno; servicio de reportes con geofence simulado | Zona activa configurada y punto fuera | 1. Crear reporte; 2. Revisar llamadas al repositorio | Se rechaza `outside_geofence` antes de insertar | `supabase/functions/api/services/reportService.test.js` — temporary missing-geofence flag does not bypass an active geofence miss |
| TC-REPORTE-26 | RNF09 | excepción | Deno; sin zona activa | Geofence ausente | 1. Crear reporte; 2. Revisar error | Falla cerrado con `geofence_not_configured` salvo bandera temporal explícita de pruebas | `supabase/functions/api/services/reportService.test.js` — missing active geofence still fails closed by default; `supabase/functions/api/services/reportService.test.js` — temporary missing-geofence flag allows report creation without removing geofence checks |
| TC-REPORTE-27 | RNF27 | excepción | Playwright; honeypot oculto | Campo oculto `report-honeypot-contact` lleno por automatización | 1. Llenar honeypot con `force`; 2. Enviar | El payload marca `anti_abuse.honeypot_filled = true` sin exponer un campo al usuario real | `tests/ui/reportForm.spec.js` — sets honeypot signal when a hidden field is filled and surfaces pending photo state; `models/reportPayload.test.js` — L7 dog fields stay nullable and honeypot is a boolean signal only |
| TC-REPORTE-28 | RNF28 | promedio | Deno; configuración de confianza | GPS limpio, bucket de tasa bajo | 1. Evaluar confianza; 2. Revisar estado | El reporte de alta confianza se autopublica con motivo versionado | `supabase/functions/api/services/trustService.test.js` — high trust can auto-publish when GPS and fingerprint signals are clean; `supabase/functions/api/repositories/reportRepository.test.js` — report insert binds details with the driver's jsonb helper |
| TC-REPORTE-29 | RNF28 | excepción | Deno; configuración de confianza | GPS simulado o impreciso | 1. Evaluar confianza; 2. Revisar estado | El reporte permanece en revisión con razón explícita | `supabase/functions/api/services/trustService.test.js` — mock and imprecise locations stay pending even with otherwise high scores |
| TC-REPORTE-30 | RF08, RNF29, HU-08 | promedio | Playwright; mapa público con API interceptada | Denuncia con razón válida | 1. Abrir pin; 2. Denunciar; 3. Revisar request | Se envía denuncia anónima, sin autorización, con cuerpo neutral y respuesta de agradecimiento | `tests/ui/publicMap.spec.js` — flag button needs a reason; 201 shows a neutral thanks and sends an anonymous body without blank detail; `services/flagApi.test.js` — ERI10 API: flag is anonymous, posts the body with the fingerprint and returns the receipt; T7 TC-ALPHA-22 |
| TC-REPORTE-31 | RF08, RNF29, HU-08 | excepción | Deno y Playwright | Denuncia sin razón, repetida, reporte no denunciable o rate limit | 1. Validar; 2. Enviar escenarios de error | El cliente bloquea la forma inválida; el backend mapea 404/409/429 sin revelar moderación interna | `models/reportFlag.test.js` — ERI10 model: draft validation requires a reason and bounds the detail; `services/flagApi.test.js` — ERI10 API: maps 404, 409 and 429 (Retry-After) with code, status and request id; T7 TC-ALPHA-23 |
| TC-REPORTE-32 | RNF29 | máximo/excepción | PostgreSQL/PostGIS aislado | Dos denuncias del mismo origen efectivo y múltiples orígenes distintos | 1. Ejecutar suite `flag`; 2. Revisar unicidad y auto-ocultamiento | La unicidad evita duplicados por origen; el umbral oculta y audita de forma transaccional | `supabase/functions/api/tests/flag-postgres.test.js` — L2 SQL: flag RLS, uniqueness, auto-hide and rollback |

## Tipos no aplicables y límites

- RF04 y RNF36 sí tienen límites explícitos y por eso tienen casos mínimos,
  máximos, promedio y excepciones con valores concretos: TC-REPORTE-08 a
  TC-REPORTE-12 y TC-REPORTE-15/16.
- RF01, RF02, RF03, RF05, RF06, RF07, RF08, RF09, RF22, RF24, RNF08, RNF10,
  RNF11, RNF12, RNF27, RNF28, RNF29 y RNF32 no son rangos numéricos únicos. Sus
  tipos se expresan como estados mínimos, representativos, máximos de flujo o
  excepciones: ausencia/presencia de foto, cámara inicial, cola terminal,
  categorías permitidas, modelo no disponible, denuncia repetida o error HTTP.
- RF09 y RNF08 tienen lógica automatizada con datos simulados. La validación con
  fotos reales y modelo en Android se comprueba con T7: TC-ALPHA-03 a
  TC-ALPHA-06 en `docs/testing/ALPHA.md`.
- RF22 tiene pruebas deterministas con imágenes sintéticas; la comprobación con
  fotos reales del dispositivo se enlaza a T7 TC-ALPHA-07.
- RNF12 se cubre con simulación de red en Playwright/Deno; la cola sin conexión,
  modo avión y sincronización real se enlazan a T7 TC-ALPHA-15 a TC-ALPHA-17.
- RNF09 aquí cubre solo el rechazo del reporte fuera de zona o sin zona activa.
  La administración de zonas pertenece a T6.
- RNF32 en T5 cubre solo la respuesta pública `415 unsupported_photo_type`; el
  saneamiento completo de imágenes pertenece a T9, aunque RNF10 valida que no se
  persista EXIF crudo.
- TC-REPORTE-15, TC-REPORTE-16 y TC-REPORTE-32 requieren Docker/PostGIS; si
  Docker no está disponible, la suite se omite o queda bloqueada hasta ejecutar
  `node scripts/test-postgres.mjs report` y `node scripts/test-postgres.mjs flag`.
  TC-REPORTE-15 y TC-REPORTE-16 se ejecutaron con Docker en RUN-138.

## Resumen de cobertura

| Requerimiento | Casos |
|---|---|
| RF01, HU-01 | TC-REPORTE-04, TC-REPORTE-05 |
| RF02, HU-02 | TC-REPORTE-03 |
| RF03, HU-03 | TC-REPORTE-02, TC-REPORTE-17, TC-REPORTE-18 |
| RF04, HU-04 | TC-REPORTE-08 a TC-REPORTE-12 |
| RF05, HU-05 | TC-REPORTE-02 |
| RF06, HU-06 | TC-REPORTE-13, TC-REPORTE-14 |
| RF07, HU-07 | TC-REPORTE-01 |
| RF08, HU-08 | TC-REPORTE-30, TC-REPORTE-31 |
| RF09, HU-09 | TC-REPORTE-19, TC-REPORTE-20 |
| RF22, HU-22 | TC-REPORTE-21, TC-REPORTE-22 |
| RF24, HU-24 | TC-REPORTE-13 a TC-REPORTE-16 |
| RNF08 | TC-REPORTE-19, TC-REPORTE-20 |
| RNF09 | TC-REPORTE-25, TC-REPORTE-26 |
| RNF10 | TC-REPORTE-23 |
| RNF11 | TC-REPORTE-13, TC-REPORTE-14 |
| RNF12 | TC-REPORTE-05 a TC-REPORTE-07 |
| RNF27 | TC-REPORTE-27 |
| RNF28 | TC-REPORTE-28, TC-REPORTE-29 |
| RNF29 | TC-REPORTE-30 a TC-REPORTE-32 |
| RNF32 | TC-REPORTE-24 |
| RNF36 | TC-REPORTE-15, TC-REPORTE-16 |
