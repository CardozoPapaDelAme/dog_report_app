# Casos de prueba — Mapa y roles autenticados (T6)

Estado: casos especificados para T6 / TD-119; ejecutados RUN-1 a RUN-81 en
`docs/testing/TEST_LOG.md` (TC-ZONAS-07 no ejecutado: requiere PostgreSQL;
TC-MODERACION-07 falló y abrió INC-1 en `docs/testing/INCIDENTS.md`; tras la
corrección, RUN-82 pasó y INC-1 quedó corregido). Convenciones: `docs/testing/README.md`.
Responsable: Alan Ruiz Silva (P4).

Fuentes: `docs/product/ETAPA1-REQUERIMIENTOS-V2.md` (RF10–RF21, RF23, RNF07,
RNF09, RNF30, RNF33), `docs/product/APPROVED-CLARIFICATIONS.md` (aclaraciones
#2–#6, en particular #5 para configuración y zonas), `docs/API.md` y el código
del commit base `f5ed2c9`. Los límites provienen del código citado en cada fila
y de los fixtures de `docs/testing/data/`; no se inventa ningún límite.

Relación con T4: los casos `TC-TRAZA-13` a `TC-TRAZA-34`, `TC-TRAZA-37`,
`TC-TRAZA-39`, `TC-TRAZA-40` y `TC-TRAZA-48` a `TC-TRAZA-52` de
`docs/testing/cases/trazabilidad.md` conservan su numeración. Este documento
agrega los límites mínimo, máximo, promedio y excepción; cuando una fila usa el
mismo test que un caso T4 lo indica en la última columna.

Entorno de los casos automatizados: Deno y node:test con dobles en memoria, y
Playwright (Chromium) con la API interceptada por el servidor loopback de
`tests/ui/serve-configuration.mjs`. No hay sesión JWT real, base de datos ni
staging. Los casos que citan `supabase/functions/api/tests/*Postgres.test.js`
requieren PostgreSQL/PostGIS aislado (`npm run test:postgres`); sin esa base se
omiten y no tienen fila de ejecución. Ningún caso de este documento requiere
dispositivo; la comprobación visual del mapa en teléfono pertenece a T7
(`docs/testing/BACKLOG.md`).

## Entrada → resultado esperado

### Mapa público (RF10–RF14)

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|
| TC-MAPA-01 | RF10, HU-10 | normal | Deno; capturador SQL en memoria | Consulta de reportes públicos, `limit` 50 | 1. Ejecutar la consulta del repositorio; 2. Revisar el SQL capturado | La ubicación pública se calcula al leer con la aproximación de 50 m; no se exponen coordenadas exactas; solo visibles, vigentes y canónicos | `supabase/functions/api/repositories/publicMapRepository.test.js` — public map repository reports calculate approximate location at read time (mismo test que TC-TRAZA-13) |
| TC-MAPA-02 | RF10, HU-10 | promedio | Deno; sin red | Consulta sin parámetros; `since` con zona `-06:00` | 1. Analizar la consulta; 2. Comparar valores | `limit` predeterminado 100; `since` se normaliza a UTC | `supabase/functions/api/controllers/publicMapController.test.js` — public reports query applies defaults and validates timestamps |
| TC-MAPA-03 | RF10, HU-10 | máximo | Deno; sin red | `limit` = 1000 en el adaptador de la app | 1. Solicitar reportes con 1000; 2. Revisar la petición | Se acepta 1000 y se envía una sola petición | `services/publicMapApi.test.js` — ERI9 API: reports request validates since/limit and normalizes the response |
| TC-MAPA-04 | RF10, HU-10 | excepción | Deno; sin red | `limit` 0, 1001 y 1.5; `since` sin zona; consulta de clusters con `limit` 5001 | 1. Enviar cada consulta; 2. Contar llamadas al servicio | 400 `invalid_request` (o `RangeError` en la app) y cero llamadas al servicio | `supabase/functions/api/controllers/publicMapController.test.js` — public map controller rejects malformed query before service call; `services/publicMapApi.test.js` — ERI9 API: reports request validates since/limit and normalizes the response |
| TC-MAPA-05 | RF12, HU-12 | mínimo | Playwright; fixture `?native-map-clusters` | `docs/testing/data/mapa-tamano-cluster.json`, clave `count-1` | 1. Abrir el fixture; 2. Medir el marcador de 1 reporte | Diámetro 36 px (radio mínimo 18 px), marcador circular | `tests/ui/publicMapClusterSize.spec.js` — cluster markers grow with report_count between the minimum and maximum diameter |
| TC-MAPA-06 | RF12, HU-12 | promedio | Playwright; fixture `?native-map-clusters` | Claves `count-2`, `count-7`, `count-100` | 1. Medir cada marcador; 2. Comparar | Diámetros ≈ 42, 53 y 76 px, estrictamente crecientes y menores que 96 px | `tests/ui/publicMapClusterSize.spec.js` — cluster markers grow with report_count between the minimum and maximum diameter |
| TC-MAPA-07 | RF12, HU-12 | máximo | Playwright; fixture `?native-map-clusters` | Claves `count-1000` y `count-5000` | 1. Medir ambos marcadores | Ambos miden 96 px (radio máximo 48 px); un conteo mayor no supera el límite | `tests/ui/publicMapClusterSize.spec.js` — cluster markers grow with report_count between the minimum and maximum diameter |
| TC-MAPA-08 | RF12, HU-12 | excepción | Deno | Conteos 0 y NaN | 1. Calcular el radio en el modelo | Se usa el radio mínimo; no se produce un tamaño inválido | `models/publicMap.test.js` — ERI9 model: cluster radius grows with count inside fixed bounds (mismo test que TC-TRAZA-15) |
| TC-MAPA-09 | RF11, HU-11 | normal | Deno; capturador SQL en memoria | Consulta de clusters | 1. Ejecutar la consulta; 2. Revisar el SQL | Agrupa con DBSCAN métrico y proyecta los seis conteos | `supabase/functions/api/repositories/publicMapRepository.test.js` — public map repository clusters use metric DBSCAN and complete type counts (mismo test que TC-TRAZA-14) |
| TC-MAPA-10 | RF11, HU-11 | máximo | Deno; repositorio falso | Zoom 12 y `limit` 9000 | 1. Llamar al servicio; 2. Revisar la entrada del repositorio | Radio 250 m y `limit` recortado a 5000 | `supabase/functions/api/services/publicMapService.test.js` — public map service caps cluster input and fills six type counts |
| TC-MAPA-11 | RF11, HU-11 | promedio | Deno; sin red | Zoom 9 sin `limit`; zoom 17 con `limit` 5000 y viewport completo | 1. Analizar cada consulta | Zoom 9 usa `limit` 2000 sin viewport; zoom 17 acepta 5000 y el viewport de cuatro valores | `supabase/functions/api/controllers/publicMapController.test.js` — public clusters query validates zoom, viewport and default limit |
| TC-MAPA-12 | RF11, HU-11 | excepción | Deno; sin red | Viewport parcial, mínimo mayor que máximo, latitud 95 | 1. Validar y serializar | Viewport inválido devuelve null o `invalid_viewport`; se serializa todo o nada | `models/publicMap.test.js` — ERI9 model: viewport is validated, clamped and serialized all-or-none |
| TC-MAPA-13 | RF13, HU-13 | normal | Playwright con API interceptada | Cluster de 7 reportes con ataque a persona | 1. Tocar el cluster; 2. Revisar el detalle | Muestra los seis conteos y la mayor gravedad «Ataque a persona» | `tests/ui/publicMap.spec.js` — tapping a cluster shows the six type counts (mismo test que TC-TRAZA-16) |
| TC-MAPA-14 | RF13, HU-13 | máximo | Deno | Los seis tipos de incidente | 1. Calcular nivel y color de cada tipo | Ataque a persona es el más severo (aclaración #12); colores alta/media/baja de DESIGN | `models/publicMap.test.js` — ERI9 model: severity levels and colours follow clarification 12 and DESIGN tokens |
| TC-MAPA-15 | RF13, HU-13 | mínimo | Deno; repositorio falso | Fila con cinco conteos en cero y `otro` = 0 | 1. Mapear la fila del repositorio | Los seis conteos existen aunque valgan 0 | `supabase/functions/api/services/publicMapService.test.js` — public map service caps cluster input and fills six type counts |
| TC-MAPA-16 | RF13, HU-13 | excepción | Deno | Clusters con conteo 0, severidad desconocida, conteos incompletos o negativos | 1. Leer la respuesta | Se descartan los clusters inválidos y duplicados; no se inventan valores | `models/publicMap.test.js` — ERI9 model: readClusters keeps valid items and drops malformed or duplicate ones |
| TC-MAPA-17 | RF14, HU-14 | normal | Playwright con API interceptada | Zoom inicial 13; acercar hasta 17 | 1. Pulsar «Acercar» hasta 17; 2. Revisar la vista | Hasta 16 solo clusters; en 17 aparecen pines y se piden reportes sin `Authorization` | `tests/ui/publicMap.spec.js` — zooming in to 17 switches to pins and a flagged pin shows details and notice |
| TC-MAPA-18 | RF14, HU-14 | mínimo | Deno | Zoom 0 y 16.9 | 1. Calcular el modo y el radio | Modo clusters; zoom 0 usa radio de 1000 m | `models/publicMap.test.js` — ERI9 model: pins start at zoom 17 and zoom is normalized; `supabase/functions/api/services/publicMapService.test.js` — public map domain resolves balanced zoom radii |
| TC-MAPA-19 | RF14, HU-14 | máximo | Deno | Zoom 17 y 22 | 1. Calcular el modo y el radio | Modo pines; zoom 22 usa radio de 50 m | `models/publicMap.test.js` — ERI9 model: pins start at zoom 17 and zoom is normalized (mismo test que TC-TRAZA-17) |
| TC-MAPA-20 | RF14, HU-14 | promedio | Deno; cargador con temporizador falso | Zoom 16, 17, 18 y regreso a 10 | 1. Cambiar la región; 2. Revisar peticiones | Cambia a pines en 17 con una sola carga y regresa a clusters en 10 | `hooks/publicMapLoader.test.js` — ERI9 loader: switches to pins at zoom 17, loads once and filters by viewport |
| TC-MAPA-21 | RF14, HU-14 | excepción | Deno; sin red | Zoom ausente, 23, -1, 1.5 o texto | 1. Validar en controlador y app | 400 o `RangeError` sin petición al servicio | `services/publicMapApi.test.js` — ERI9 API: clusters validate inputs before any request |

### Sesión y roles hermanos (RF15, RF18, RNF07)

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|
| TC-SESION-01 | RF15, RNF07, HU-15 | normal | node:test; Auth y GET /me inyectados | Perfil `association` activo | 1. Iniciar sesión; 2. Revisar la navegación | Abre el panel de la Asociación según el rol verificado por el servidor | `controllers/loginController.test.js` — login navigates from the server-verified association role (mismo test que TC-TRAZA-18) |
| TC-SESION-02 | RF18, RNF07, HU-18 | normal | node:test; servicio inyectado | Perfil `administrator` activo | 1. Iniciar sesión; 2. Revisar el destino | El Command Center se elige solo a partir de GET /me | `controllers/loginController.test.js` — administrator dashboard is selected only from GET /me (mismo test que TC-TRAZA-22) |
| TC-SESION-03 | RF15, RF18, RNF07 | mínimo | Deno | Perfil sin rol, rol desconocido o inactivo | 1. Construir el perfil de sesión | Solo se acepta un rol de aplicación activo entregado por el servidor | `models/session.test.js` — session profile accepts only an active server-provided application role |
| TC-SESION-04 | RF15, RF18 | máximo | node:test; almacenamiento seguro falso | Sesión Unicode grande dividida en fragmentos | 1. Guardar; 2. Leer | Se conserva completa en fragmentos acotados | `services/secureSessionStorage.test.js` — secure storage reads and writes large Unicode values in bounded chunks |
| TC-SESION-05 | RF15, RF18, RNF07 | excepción | node:test | Rol de servidor desconocido; fallo de GET /me | 1. Iniciar sesión | Se borra la sesión de Supabase; no se elige panel | `controllers/loginController.test.js` — an unknown server role clears the session instead of choosing a dashboard; `controllers/loginController.test.js` — a failed /me check clears the Supabase session and keeps the original error |
| TC-SESION-06 | RF15, RF18 | excepción | Deno; sin base de datos | GET /me sin `Authorization` | 1. Solicitar la ruta | 401 | `supabase/functions/api/routes/identityRoutes.test.js` — GET /me without authorization returns 401 |
| TC-SESION-07 | RF18, RNF07, HU-18 | excepción | Deno; sin base de datos | Actores `administrator` y anónimo en el servicio de la Asociación | 1. Autorizar cada actor | Administrator y anónimo reciben `forbidden`: Administrator no hereda análisis ni exportación | `supabase/functions/api/services/associationService.test.js` — association service accepts only the association sibling role (mismo test que TC-TRAZA-37) |
| TC-SESION-08 | RF15, RNF07, HU-15 | excepción | Deno; sesión simulada | Identidad `association` contra configuración de Administrator | 1. Leer y publicar configuración | Ambas operaciones se rechazan | `supabase/functions/api/tests/identityConfiguration.test.js` — FAB-1 simulated session: an association identity cannot read or publish Administrator configuration |
| TC-SESION-09 | RF18, RNF07 | promedio | Playwright | Pantalla de login con regreso, carga y envío pendiente | 1. Abrir el login en cada estado | El regreso a cámara se ofrece solo cuando procede y se deshabilita durante el envío | `tests/ui/login.spec.js` — back button is disabled while sign-in is pending |

### Asociación de Hoteles de Chihuahua (RF16, RF17)

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|
| TC-ASOCIACION-01 | RF16, HU-16 | normal | Deno; capturador SQL | Filtro sin fechas, `limit` 25 | 1. Ejecutar la consulta; 2. Revisar el SQL | Solo visibles canónicos de los últimos cinco años, sin fingerprints, denuncias ni confianza | `supabase/functions/api/repositories/associationReportRepository.test.js` — association repository query enforces accepted canonical five-year projection (mismo test que TC-TRAZA-19) |
| TC-ASOCIACION-02 | RF16, HU-16 | mínimo | Deno | `limit` = 1 | 1. Analizar el límite | Se acepta 1 | `supabase/functions/api/controllers/associationController.test.js` — association query accepts optional dates and limits results from 1 to 5000 |
| TC-ASOCIACION-03 | RF16, HU-16 | máximo | Deno | `limit` = 5000 | 1. Analizar el límite | Se acepta 5000 | `supabase/functions/api/controllers/associationController.test.js` — association query accepts optional dates and limits results from 1 to 5000 |
| TC-ASOCIACION-04 | RF16, HU-16 | promedio | Deno | Sin `limit` | 1. Analizar el límite | Valor predeterminado 100 | `supabase/functions/api/controllers/associationController.test.js` — association query accepts optional dates and limits results from 1 to 5000 |
| TC-ASOCIACION-05 | RF16, HU-16 | excepción | Deno | `limit` 0, 5001 y 1.5; rango de fechas invertido o mal formado | 1. Analizar la consulta | Se rechaza antes del servicio | `supabase/functions/api/controllers/associationController.test.js` — association query accepts optional dates and limits results from 1 to 5000; `supabase/functions/api/controllers/associationController.test.js` — association query rejects malformed or reversed date ranges |
| TC-ASOCIACION-06 | RF16, HU-16 | máximo | Deno | Rango de 31 días y rango mayor | 1. Resumir filas | 31 días se agrupa por día; un rango mayor se agrupa por mes | `models/associationSummary.test.js` — RIC-5 summary: 31-day cutoff stays daily; longer ranges group by month |
| TC-ASOCIACION-07 | RF16, HU-16 | excepción | Deno; páginas simuladas | Cursor repetido o página posterior fallida | 1. Cargar el rango | Se rechaza el resultado incompleto; no se muestra un rango parcial | `hooks/associationReportLoader.test.js` — RIC-2 loader: a failed later page never resolves a partial range |
| TC-ASOCIACION-08 | RF17, HU-17 | normal | Playwright con API interceptada | Rango con reportes aceptados | 1. Filtrar; 2. Descargar CSV | Las tarjetas y el CSV contienen los mismos reportes completos | `tests/ui/associationDashboard.spec.js` — mobile cards and downloaded CSV contain the same complete filtered reports |
| TC-ASOCIACION-09 | RF17, HU-17 | mínimo | Playwright con API interceptada | Rango sin reportes | 1. Filtrar | Se explica el resultado vacío y la exportación queda deshabilitada | `tests/ui/associationDashboard.spec.js` — empty range explains the result and keeps export disabled |
| TC-ASOCIACION-10 | RF17, HU-17 | excepción | node:test | `incident_type` con `=HYPERLINK("bad")` | 1. Generar XLSX | La celda queda como texto literal, sin fórmula ejecutable | `models/associationWorkbook.test.js` — RIC-5 XLSX exports the accepted projection as values, not executable formulas (mismo test que TC-TRAZA-21) |
| TC-ASOCIACION-11 | RF17, HU-17 | promedio | Deno | Filas con comas, comillas y saltos de línea | 1. Generar CSV | Mismas filas y columnas que la tabla, con celdas escapadas | `models/associationReport.test.js` — RIC-4 export: CSV has the same rows and columns as the table, with escaped cells (mismo test que TC-TRAZA-20) |

### Moderación del Administrator (RF19, RF20, RF21)

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|
| TC-MODERACION-01 | RF19, HU-19 | normal | Playwright con API interceptada; sesión de prueba | `docs/testing/data/moderacion-cola.json`, `queue_items` | 1. Abrir el Command Center; 2. Revisar la cola | GET protegido con Bearer y `limit=20`; métricas 3/1/2; contexto (banderas, ubicación exacta, señales sospechosas) y comandos según estado | `tests/ui/commandCenter.spec.js` — renders the moderation queue with its context and page summary from the protected endpoint |
| TC-MODERACION-02 | RF19, HU-19 | mínimo | Deno; sin base de datos | `limit` = 1; cola vacía en el presentador | 1. Validar el límite; 2. Presentar cero filas | 1 llega al servicio (503 sin base); la página vacía tiene `next_cursor` null | `supabase/functions/api/services/moderationService.test.js` — RF19 moderation queue controller accepts limits 1, 500 and the default, and rejects 0, 501 and non-integers; `supabase/functions/api/services/moderationService.test.js` — RF19 moderation queue presenter trims the look-ahead row, encodes next_cursor and exposes context |
| TC-MODERACION-03 | RF19, HU-19 | máximo | Deno; capturador SQL | `limit` = 500 con cursor | 1. Validar; 2. Revisar el SQL | 500 se acepta; el SQL pide 501 filas, filtra `pending_review`/`hidden` y aplica el cursor por (`synced_at`, `id`) descendente | `supabase/functions/api/services/moderationService.test.js` — RF19 moderation repository applies the keyset cursor after the queue filter |
| TC-MODERACION-04 | RF19, HU-19 | promedio | Deno; capturador SQL y presentador | `limit` 20; tres filas para página de 2 | 1. Consultar; 2. Presentar | Pide 21 filas ordenadas por recientes; la página tiene 2 elementos y `next_cursor` de la última | `supabase/functions/api/services/moderationService.test.js` — RF19 moderation repository lists only pending_review and hidden reports newest first with one look-ahead row; `supabase/functions/api/services/moderationService.test.js` — RF19 moderation queue presenter trims the look-ahead row, encodes next_cursor and exposes context |
| TC-MODERACION-05 | RF19, HU-19 | excepción | Deno; sin base de datos | `limit` 0, 501, -1, 1.5, `abc`; cursores mal formados | 1. Llamar al controlador | 400 `invalid_request` antes del servicio | `supabase/functions/api/services/moderationService.test.js` — RF19 moderation queue controller accepts limits 1, 500 and the default, and rejects 0, 501 and non-integers; `supabase/functions/api/services/moderationService.test.js` — RF19 moderation queue controller rejects malformed cursors and accepts a keyset cursor |
| TC-MODERACION-06 | RF19, RNF07, HU-19 | excepción | Deno; sin base de datos ni JWT | Sin token, `Basic abc`, `Bearer not-a-jwt` | 1. Solicitar la cola en ambas rutas | 401 `authentication_required` o `invalid_token`; no se consulta el perfil | `supabase/functions/api/services/moderationService.test.js` — RF19 moderation queue route rejects missing or malformed bearer tokens before database access |
| TC-MODERACION-07 | RF19, RNF07, HU-19 | excepción | Deno; sin base de datos | Actor `association` directo en `listQueue` | 1. Ejecutar `listQueue` y cada comando con el actor | El servicio rechaza con `forbidden` antes de la base de datos (ADR-019 en `docs/architecture/DECISIONS.md`); anónimo recibe `authentication_required`; el Controller responde 403/401 | `supabase/functions/api/services/moderationService.test.js` — RF19 INC-1: moderation service rejects non-administrator actors before database access; `supabase/functions/api/services/moderationService.test.js` — RF19 INC-1: moderation controllers map Service authorization failures to 401 and 403 (regresión de INC-1) |
| TC-MODERACION-08 | RF19, HU-19 | excepción | Playwright con API interceptada | Respuestas 403 `forbidden` y 503 `database_unavailable`; cola vacía; sin sesión | 1. Abrir el Command Center; 2. Reintentar | Banner de error sin tarjetas y recuperación al reintentar; estado vacío con métricas en 0; sin sesión no hay petición | `tests/ui/commandCenter.spec.js` — a 403 forbidden response shows the error banner and recovers on retry; `tests/ui/commandCenter.spec.js` — an empty queue shows the empty state with zero metrics; `tests/ui/commandCenter.spec.js` — without an Administrator session the queue is not requested |
| TC-MODERACION-09 | RF19, HU-19 | máximo | Playwright con API interceptada | Primera página con `next_cursor` | 1. Pulsar «Cargar más» | Se envía el cursor y se anexa la página siguiente; desaparece el botón al final | `tests/ui/commandCenter.spec.js` — load more sends the next_cursor and appends the following page |
| TC-MODERACION-10 | RF20, HU-20 | normal | Playwright con API interceptada | Nota en blanco y nota `  Foto no corresponde  ` | 1. Ocultar; 2. Restaurar; 3. Aprobar otro reporte | La nota en blanco no envía; ocultar envía la nota recortada y deja la tarjeta como «Oculto»; restaurar vuelve a «Pendiente»; aprobar retira la tarjeta | `tests/ui/commandCenter.spec.js` — hide requires a note, keeps the card as hidden, restore returns it to pending and approve removes it |
| TC-MODERACION-11 | RF20, HU-20 | máximo | Deno | Nota de 1000 y de 1001 caracteres | 1. Analizar el cuerpo de aprobar | 1000 se acepta; 1001 se rechaza | `supabase/functions/api/controllers/moderationController.test.js` — approve enforces the audit note type and storage limit |
| TC-MODERACION-12 | RF20, HU-20 | mínimo | Deno | Eliminar sin nota, `{}` o nota de espacios | 1. Analizar el cuerpo | Solo se acepta un motivo no vacío | `supabase/functions/api/controllers/moderationController.test.js` — delete requires a non-empty audit note (mismo test que TC-TRAZA-26) |
| TC-MODERACION-13 | RF20, HU-20 | excepción | Deno | Aprobar visible o eliminado; eliminar eliminado | 1. Evaluar la transición | Error `invalid_approve_transition` / `invalid_delete_transition` | `supabase/functions/api/domain/reportModeration.test.js` — approve rejects visible and deleted reports; `supabase/functions/api/domain/reportModeration.test.js` — delete rejects an already deleted report |
| TC-MODERACION-14 | RF20, HU-20 | promedio | Deno | Estados `pending_review`, `visible`, `hidden` | 1. Eliminar lógicamente cada uno | Todos pasan a `deleted` (reversible) | `supabase/functions/api/domain/reportModeration.test.js` — delete allows every non-deleted report state (mismo test que TC-TRAZA-25) |
| TC-MODERACION-15 | RF21, RNF33, HU-21 | mínimo | Deno; servicio con dobles | Umbral 2 (mínimo configurable); dos dispositivos distintos | 1. Denunciar dos veces | La primera deja visible; la segunda oculta y audita `report_auto_hidden` una vez | `supabase/functions/api/services/flag-service.test.js` — distinct devices accumulate to the threshold and auto-hide once (mismo test que TC-TRAZA-29) |
| TC-MODERACION-16 | RF21, HU-21 | máximo | Deno | `flag_auto_hide_threshold` 100 y 101 | 1. Validar la configuración | 100 se acepta; 101 se rechaza | `supabase/functions/api/domain/configuration.test.js` — FAB-1 VALIDATION: flag_auto_hide_threshold bounds, types and storage precision |
| TC-MODERACION-17 | RF21, HU-21 | excepción | Deno | Reportes no públicos, vencidos, inexistentes o no canónicos | 1. Denunciar | No son denunciables; no se oculta nada | `supabase/functions/api/services/flag-service.test.js` — non-public, expired, missing and noncanonical reports are not flaggable |
| TC-MODERACION-18 | RF21, HU-21 | promedio | Deno | Reporte oculto por umbral; comandos disponibles | 1. Derivar comandos de `hidden` | Administrator puede aprobar, eliminar o restaurar | `supabase/functions/api/services/moderationService.test.js` — RF19 moderation queue presenter trims the look-ahead row, encodes next_cursor and exposes context |

### Configuración (aclaración #5)

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|
| TC-CONFIGURACION-01 | Aclaración #5, RF21, RF23 | mínimo | Deno | `docs/testing/data/configuracion-umbrales.json`, `rules` → cada `min` | 1. Validar cada campo en su mínimo | Se acepta el mínimo; `min - 1` se rechaza | `supabase/functions/api/domain/configuration.test.js` — FAB-1 VALIDATION: duplicate_radius_meters bounds, types and storage precision (la misma plantilla cubre los ocho campos) |
| TC-CONFIGURACION-02 | Aclaración #5, RF21, RF23 | máximo | Deno | `rules` → cada `max` | 1. Validar cada campo en su máximo | Se acepta el máximo; `max + 1` se rechaza | `supabase/functions/api/domain/configuration.test.js` — FAB-1 VALIDATION: gps_accuracy_max_meters bounds, types and storage precision (la misma plantilla cubre los ocho campos) |
| TC-CONFIGURACION-03 | Aclaración #5, RNF33 | promedio | Playwright con API interceptada | `representative` del fixture | 1. Cargar ocho valores; 2. Publicar | Se envía el payload tipado completo con la nota | `tests/ui/configuration.spec.js` — loads eight values, identifies GPS range and publishes the complete typed payload |
| TC-CONFIGURACION-04 | Aclaración #5 | excepción | Deno | Cuerpo parcial, campo extra, bandas de confianza invertidas, nota en blanco o de 1001 caracteres | 1. Validar | `invalid_request` con el campo señalado | `supabase/functions/api/domain/configuration.test.js` — FAB-1 VALIDATION: rejects partial bodies, extra fields and inverted trust bands; `supabase/functions/api/domain/configuration.test.js` — FAB-1 VALIDATION: requires bounded nonblank audit note |
| TC-CONFIGURACION-05 | Aclaración #5, RNF07 | excepción | Deno | Valores inválidos y actores no Administrator | 1. Publicar | Nunca se obtiene conexión a la base de datos | `supabase/functions/api/services/configurationService.test.js` — FAB-1 SERVICE: invalid values and actors never obtain a database connection |
| TC-CONFIGURACION-06 | Aclaración #5, RNF33 | normal | Deno; dobles en memoria | Publicación válida | 1. Publicar; 2. Revisar el orden de eventos | Contexto, bloqueo, inserción, activación y auditoría antes del commit | `supabase/functions/api/services/configurationService.test.js` — FAB-1 SERVICE: publication sets context then locks, inserts, activates and audits before commit (mismo test que TC-TRAZA-40) |

### Zonas (RNF09, administración)

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|
| TC-ZONAS-01 | RNF09, aclaración #5 | normal | Playwright con API interceptada | Archivo GeoJSON sintético; referencia de aprobación | 1. Cargar archivo; 2. Crear; 3. Aprobar y activar | La creación no activa; la aprobación separada activa exactamente el borrador | `tests/ui/zoneSet.spec.js` — file upload displays canonical checksum; creation never activates; separate approval activates exact draft |
| TC-ZONAS-02 | RNF09 | máximo | Deno | `docs/testing/data/zonas-administracion.json`, claves `approval-1000` y `approval-1001` | 1. Validar la aprobación | 1000 caracteres Unicode se aceptan; 1001 se rechaza | `models/zoneSet.test.js` — FAB-5 MODEL: provenance and independent approval are mandatory and bounded |
| TC-ZONAS-03 | RNF09 | mínimo | Deno | Aprobación `AHC-2026-09-21` con nota; aprobación de espacios o nota vacía | 1. Validar la activación | Se exige una referencia no vacía; la nota es opcional pero no vacía | `supabase/functions/api/domain/zoneSet.test.js` — FAB-2 DOMAIN: activation keeps Association approval separate from Administrator note |
| TC-ZONAS-04 | RNF09 | excepción | Deno | Claves `point` y `ring-open-4`; checksum ajeno; URI relativa | 1. Validar la creación | Rechazo en `geometry`, `source_sha256` o `source_uri` | `supabase/functions/api/domain/zoneSet.test.js` — FAB-2 DOMAIN: geometry and checksum reject malformed or mismatched evidence |
| TC-ZONAS-05 | RNF09, RNF33 | promedio | Deno; dobles en memoria | Activación con checksum almacenado | 1. Activar | Valida checksum y reemplaza la zona activa de forma atómica | `supabase/functions/api/services/zoneService.test.js` — FAB-2 SERVICE: activation validates stored checksum then atomically replaces the active set |
| TC-ZONAS-06 | RNF09 | excepción | Deno | Varias zonas activas o borrador sin checksum coincidente | 1. Activar | Se rechaza; como máximo una zona activa | `supabase/functions/api/domain/zoneSet.test.js` — FAB-2 DOMAIN: activation permits at most one active zone and only a checksum-matched draft |
| TC-ZONAS-07 | RNF09, RNF19, RNF33 | normal | PostgreSQL/PostGIS aislado; `npm run test:postgres` | Geometrías válidas, vacías y autointersectadas; activaciones concurrentes | 1. Ejecutar la suite SQL | PostGIS rechaza inválidas; una zona activa y auditoría atómica | `supabase/functions/api/tests/zonePostgres.test.js` — FAB-2 SQL: PostGIS zone creation, replacement, rollback and concurrency (mismo test que TC-TRAZA-49; no ejecutado sin base) |

### Duplicados (RF23, RNF30)

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|
| TC-DUPLICADOS-01 | RF23, RNF30, HU-23 | normal | Playwright con API interceptada | Cadena A-B-C sugerida | 1. Seleccionar A/C; 2. Seleccionar A/B/C; 3. Revertir | A/C no envía POST; A/B/C resuelve y revierte | `tests/ui/duplicateManagement.spec.js` — groups genuine candidates; disconnected induced selection warns before POST; valid chain resolves then reverses (mismo test que TC-TRAZA-34) |
| TC-DUPLICADOS-02 | RF23, HU-23 | mínimo | Deno | `report_ids` de 2 y de 1 elemento | 1. Validar la resolución | 2 reportes se aceptan; 1 se rechaza | `supabase/functions/api/domain/duplicateGroup.test.js` — FAB-3 DOMAIN: resolution validates canonical membership, identifiers, limits and notes |
| TC-DUPLICADOS-03 | RF23, HU-23 | máximo | Deno | 501 identificadores; nota de 1001 caracteres | 1. Validar la resolución | Se rechaza por encima de 500 reportes y de 1000 caracteres | `supabase/functions/api/domain/duplicateGroup.test.js` — FAB-3 DOMAIN: resolution validates canonical membership, identifiers, limits and notes |
| TC-DUPLICADOS-04 | RF23, RNF30, HU-23 | promedio | Deno | Grafo de cinco reportes, todos los subconjuntos | 1. Calcular conectividad | Coincide con el backend sin pasar por nodos no seleccionados | `models/duplicateCandidate.test.js` — FAB-6 MODEL: exhaustive subsets match backend induced connectivity; no path through unselected nodes (mismo test que TC-TRAZA-32) |
| TC-DUPLICADOS-05 | RF23, RNF07 | excepción | Deno | Actor anónimo o `association`; forma inválida | 1. Listar o resolver | `authentication_required`/`forbidden`/`invalid_request` sin conexión | `supabase/functions/api/services/duplicateService.test.js` — FAB-3 SERVICE: authorization and shape validation run before storage |
| TC-DUPLICADOS-06 | RF23, RNF30, RNF33 | excepción | Deno | Fallo de auditoría inyectado | 1. Resolver; 2. Revertir | Rollback de cada comando sin cambios parciales | `supabase/functions/api/services/duplicateService.test.js` — FAB-3 SERVICE: audit failure rolls back each command (mismo test que TC-TRAZA-33) |
| TC-DUPLICADOS-07 | RF23, RNF30 | normal | Deno | Resolución y reversión | 1. Resolver; 2. Revertir | Se preservan los reportes originales y solo se reabren candidatos internos | `supabase/functions/api/services/duplicateService.test.js` — FAB-3 SERVICE: resolution and reversal preserve reports and reopen only internal candidates |

### Auditoría y roles transversales (RNF07, RNF33)

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|
| TC-AUDITORIA-01 | RNF33 | excepción | Deno; dobles en memoria | Fallo en inserción, activación o auditoría | 1. Publicar configuración | La transacción aborta sin cambios | `supabase/functions/api/services/configurationService.test.js` — FAB-1 SERVICE: failures in insertion, activation or audit abort the transaction |
| TC-AUDITORIA-02 | RNF33, RNF09 | normal | Deno; dobles en memoria | Creación de zona | 1. Crear | Borrador, geometría y auditoría en una sola transacción | `supabase/functions/api/services/zoneService.test.js` — FAB-2 SERVICE: creation writes immutable draft, geometry and audit in one transaction |
| TC-AUDITORIA-03 | RNF07 | excepción | Deno | Lectura de candidatos con actor anónimo o `association` | 1. Solicitar la lectura | Se niega a ambos | `supabase/functions/api/controllers/duplicateController.test.js` — FAB-6 HTTP: candidate read denies query, wrong method, anonymous and Association actors |

## Tipos no aplicables y límites

- RF15 y RF18, máximo numérico: el SRS y la aclaración #2 permiten varias
  cuentas por rol sin límite; no hay un número máximo que probar. TC-SESION-04
  cubre el límite de almacenamiento de la sesión, no de cuentas. El registro
  público deshabilitado es configuración de Supabase Auth (`supabase/config.toml`)
  y se inspecciona en T9; no hay test automatizado.
- RF10 y RF11, mínimo de `limit` = 1 (`supabase/functions/api/domain/publicMap.js`):
  los tests solo comprueban que 0 se rechaza (TC-MAPA-04, TC-MAPA-21); ninguno
  acepta 1 en el controlador público. Se deja como límite inferior conocido sin
  caso propio para no atribuir aserciones inexistentes.
- RF15, promedio: el acceso de la Asociación no tiene un valor intermedio; el
  flujo representativo es TC-SESION-01.
- RF17, máximo: la exportación no tiene un límite propio; exporta el rango
  completo ya cargado, acotado por los límites de RF16 (5000 por página, ventana
  de cinco años; TC-ASOCIACION-01 y TC-ASOCIACION-03).
- RF13, promedio: la severidad es un orden de seis categorías, no un rango
  numérico; TC-MAPA-13 cubre el caso representativo.
- RF20, RF21 y RNF33, comportamiento de auditoría de los comandos de moderación:
  `supabase/functions/api/services/moderationService.js` obtiene la conexión
  directamente (sin inyección de dependencias), por lo que el orden contexto →
  bloqueo → auditoría de approve/hide/restore/delete no es observable sin
  PostgreSQL y no existe suite SQL de moderación. Queda como brecha documentada.
- RNF30 y RNF33, mínimo/máximo: no tienen límite numérico propio; se cubren con
  los límites de RF23 (TC-DUPLICADOS-02/03) y de las notas de auditoría
  (TC-MODERACION-11, TC-CONFIGURACION-04).
- RNF07, mínimo/máximo/promedio: es una regla de autorización (dos roles
  hermanos), no un valor; aplica normal y excepción (TC-SESION-01/02/07/08,
  TC-MODERACION-06/07, TC-AUDITORIA-03, TC-DUPLICADOS-05).
- TC-ZONAS-07 requiere PostgreSQL/PostGIS y no se ejecuta en `npm test`.
- RF12 en teléfono: TC-MAPA-05 a TC-MAPA-07 miden el componente del dispositivo
  con MapLibre sustituido por `tests/ui/maplibre-stub.js`; el dibujo sobre el
  mapa real corresponde a T7.

## Resumen de cobertura

| Requerimiento | Casos |
|---|---|
| RF10, HU-10 | TC-MAPA-01 a TC-MAPA-04 |
| RF11, HU-11 | TC-MAPA-09 a TC-MAPA-12 |
| RF12, HU-12 | TC-MAPA-05 a TC-MAPA-08 |
| RF13, HU-13 | TC-MAPA-13 a TC-MAPA-16 |
| RF14, HU-14 | TC-MAPA-17 a TC-MAPA-21 |
| RF15, HU-15 | TC-SESION-01, TC-SESION-03 a TC-SESION-06, TC-SESION-08 |
| RF16, HU-16 | TC-ASOCIACION-01 a TC-ASOCIACION-07 |
| RF17, HU-17 | TC-ASOCIACION-08 a TC-ASOCIACION-11 |
| RF18, HU-18 | TC-SESION-02 a TC-SESION-07, TC-SESION-09 |
| RF19, HU-19 | TC-MODERACION-01 a TC-MODERACION-09, TC-MODERACION-18 |
| RF20, HU-20 | TC-MODERACION-10 a TC-MODERACION-14 |
| RF21, HU-21 | TC-MODERACION-15 a TC-MODERACION-18 |
| RF23, HU-23 | TC-DUPLICADOS-01 a TC-DUPLICADOS-07 |
| Configuración (aclaración #5) | TC-CONFIGURACION-01 a TC-CONFIGURACION-06 |
| RNF07 | TC-SESION-01 a TC-SESION-03, TC-SESION-05, TC-SESION-07 a TC-SESION-09, TC-MODERACION-06, TC-MODERACION-07, TC-AUDITORIA-03, TC-CONFIGURACION-05, TC-DUPLICADOS-05 |
| RNF09 (administración de zonas) | TC-ZONAS-01 a TC-ZONAS-07, TC-AUDITORIA-02 |
| RNF30 | TC-DUPLICADOS-01, TC-DUPLICADOS-04, TC-DUPLICADOS-06, TC-DUPLICADOS-07 |
| RNF33 | TC-MODERACION-15, TC-AUDITORIA-01, TC-AUDITORIA-02, TC-CONFIGURACION-03, TC-CONFIGURACION-06, TC-ZONAS-05, TC-ZONAS-07, TC-DUPLICADOS-06 |
