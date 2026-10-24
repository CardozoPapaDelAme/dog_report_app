# Validación de infraestructura (health/check)

Estado: ejecutada sobre staging el 2026-10-24. El incidente INC-4 se corrigió y verificó el mismo día (PR #91).
Guía de la tarea: [`docs/deployment/BACKLOG.md`](docs/deployment/BACKLOG.md), D2.

Validar la infraestructura es comprobar, con evidencia, que cada pieza desplegada
(base de datos, API, almacenamiento de fotos, autenticación y red) está en el estado
que exige el diseño, y que responde. Se hace con tres herramientas: un checklist de
configuración, un script de humo que cualquiera puede correr y el health check del
backend.

## 1. Health check del backend

Fuentes: `supabase/functions/api/routes/health.js`,
`supabase/functions/api/controllers/healthController.js`,
`supabase/functions/api/services/healthService.js`, `docs/API.md`.

`GET /functions/v1/api/health` es público y responde `200` cuando la base de datos
contesta, o `503 database_unavailable` si no.

**Qué valida:** que la Edge Function `api` arranca, que enruta peticiones y que
obtiene una conexión a PostgreSQL y ejecuta una consulta (`SELECT 1`) con el login
`app_backend`. Respuesta sana: `{"data":{"ok":true,"database":"up"}}`.

**Qué no valida:** Storage (el bucket es privado y el health check no tiene
credenciales para él), Auth, el job de retención, que el geofence esté activo ni el
rendimiento de consultas reales. Esas señales se cubren con el script de humo
(sección 3), que también corre cada 15 minutos como monitor programado, y los
dashboards de Supabase
(`docs/deployment/MONITORING.md`).

**Decisión sobre ampliar la respuesta:** no se agregan `version` ni `latency_ms` al
contrato. La versión desplegada se verifica comparando los archivos desplegados con
el commit (checklist, último punto), lo que es más fuerte que un campo
autodeclarado, y la latencia se mide desde fuera (script de humo y monitor
programado), que es la que vive el usuario. Así `docs/API.md` no cambia.

## 2. Checklist de infraestructura

Fuentes: `docs/DEPLOYMENT.md` ("Project bootstrap", "Post-deploy smoke check"),
`docs/SECURITY.md`.

Ejecutado el 2026-10-24 entre 07:48 y 07:58 UTC sobre staging
(`dcvihomkxkutkckmjvmp`, PostgreSQL 17.6), commit `32a4183`. "API de
administración" significa la API de administración de Supabase usada por el
servidor MCP (consultas SQL de solo lectura, advisors y listado de Functions).

| Punto | Cómo se verifica | Esperado | Obtenido | Fecha | Quién |
|---|---|---|---|---|---|
| Extensiones PostGIS y pgcrypto | `select extname, extversion from pg_extension` | Ambas en el esquema `extensions` | **Cumple.** `postgis 3.3.7` y `pgcrypto 1.3` en `extensions`. | 2026-10-24 | Operador técnico (asistido) |
| RLS activo en tablas de dominio | `pg_class.relrowsecurity` de las tablas de `public` | Todas con RLS | **Cumple.** 13/13 tablas con RLS activo. | 2026-10-24 | Operador técnico (asistido) |
| `app_backend` `NOBYPASSRLS` sin objetos propios | `pg_roles` y dueños en `pg_class` | `rolbypassrls = false`, 0 objetos | **Cumple.** `bypassrls=false`, `superuser=false`, 0 objetos propios. | 2026-10-24 | Operador técnico (asistido) |
| Grants móviles vacíos | `information_schema.role_table_grants` para `anon` y `authenticated` en `public` | Ninguno | **Cumple.** Ningún grant. | 2026-10-24 | Operador técnico (asistido) |
| Bucket aprobado privado | `storage.buckets` | `approved-photos` con `public = false` | **Cumple.** `approved-photos`, `public=false` (18 objetos, 10 MB). | 2026-10-24 | Operador técnico (asistido) |
| Secretos requeridos presentes (solo nombres) | `supabase secrets list` | Los 6 nombres de `docs/deployment/MIGRATION-PLAN.md` | **Cumple.** `supabase secrets list` (CLI 2.122.0, 08:20 UTC) muestra `APP_BACKEND_DATABASE_URL`, `INTERNAL_RETENTION_SECRET`, `EXPECTED_SUPABASE_PROJECT_REF`, `EXPECTED_DEPLOYMENT_ENVIRONMENT` y `APPROVED_PHOTOS_BUCKET`, más los que inyecta el proveedor (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). `JWT_SECRET` es opcional (la verificación usa JWKS) y no está definido. `ALLOW_REPORTS_WITHOUT_ACTIVE_GEOFENCE` está definido, lo cual es válido solo en staging. | 2026-10-24 | Operador técnico (asistido) |
| Signup público deshabilitado (`422 signup_disabled`) | `POST /auth/v1/signup` con la clave publicable (script de humo) | `422 signup_disabled` | **Cumple.** `422 signup_disabled` en 3/3 corridas. | 2026-10-24 | Operador técnico (asistido) |
| Advisors de seguridad y rendimiento | Advisors de Supabase | Sin hallazgos críticos | **Cumple con observaciones.** Seguridad: 1 WARN `auth_leaked_password_protection` (función del plan Pro; aceptado en `docs/SECURITY.md`). Rendimiento: 10 INFO de llaves foráneas sin índice y 3 INFO de índices sin uso (aceptados por el bajo volumen, `docs/DEPLOYMENT.md`). | 2026-10-24 | Operador técnico (asistido) |
| HTTPS/TLS | `curl` por HTTP y `openssl s_client` | HTTP redirige a HTTPS; certificado válido | **Cumple.** HTTP → `301` a HTTPS; TLS 1.3 (`TLS_AES_256_GCM_SHA384`), certificado de Google Trust Services válido hasta 2026-11-24 (renovación automática del proveedor). | 2026-10-24 | Operador técnico (asistido) |
| Function `api` en el commit esperado | Listado de Functions y SHA-256 de cada archivo desplegado contra el repo | Mismo contenido que `32a4183` | **Cumple.** `api` versión 116, ACTIVE, `verify_jwt=false`; 83/83 archivos idénticos a `supabase/functions/api/` en `32a4183`. | 2026-10-24 | Operador técnico (asistido) |
| Migraciones aplicadas | Lista remota contra `supabase/migrations/` | 12/12, sin pendientes | **Cumple.** Cabeza `20261021120000_add_photo_validation_thresholds`. | 2026-10-24 | Operador técnico (asistido) |
| Entorno declarado | `public.deployment_metadata` | `staging` | **Cumple.** `environment = staging`. | 2026-10-24 | Operador técnico (asistido) |
| Capacidad de conexiones | `max_connections` y `pg_stat_activity` | Holgura frente al límite | **Cumple.** 12 conexiones activas de 60 permitidas. | 2026-10-24 | Operador técnico (asistido) |

## 3. Script de humo

`npm run smoke` ejecuta `scripts/smoke.mjs`: un script de Node sin dependencias ni
secretos que prueba el entorno desplegado de punta a punta y mide la latencia de
cada llamada en milisegundos. Sale con código `0` si todo pasa y `1` si algo falla,
así que sirve después de cada despliegue y en automatizaciones.

| Chequeo | Esperado |
|---|---|
| `GET /health` | `200` y `database: up` |
| `GET /public/clusters` | `200` con una lista |
| `GET /public/reports` | `200` con una lista |
| `POST /auth/v1/signup` | `422 signup_disabled` (se omite si no hay clave publicable) |

Uso:

```bash
API_BASE_URL=https://<ref>.supabase.co/functions/v1/api \
SUPABASE_PUBLISHABLE_KEY=<clave publicable> npm run smoke
# o, con el archivo .env de la app:
node --env-file=.env scripts/smoke.mjs
```

La clave publicable es la misma que ya lleva la app; no es un secreto del servidor.
Salida real contra staging (2026-10-24 07:50:12 UTC):

```text
Smoke check: https://dcvihomkxkutkckmjvmp.supabase.co/functions/v1/api  (2026-10-24T07:50:12.244Z)
OK       GET /health            200  255 ms
OK       GET /public/clusters   200  451 ms
OK       GET /public/reports    200  429 ms
OK       POST /auth/v1/signup   422  219 ms
Resultado: OK
```

Sus pruebas (`scripts/smoke.test.js`, con `fetch` simulado) corren dentro de
`npm test`: caso sano, base caída (`503`), `200` con base no disponible, signup
habilitado, error de red, omisión sin clave, lectura de variables y formato.

## 4. Registro de ejecuciones

| Fecha | Entorno | Commit | Herramienta | Resultado | Notas |
|---|---|---|---|---|---|
| 2026-10-24 07:48–07:58 UTC | staging | `32a4183` | Checklist (sección 2) | Pasó (13/13; secretos verificados de forma indirecta) | Advisors sin hallazgos críticos. |
| 2026-10-24 07:50:09 UTC | staging | `32a4183` | `npm run smoke` | Pasó | health 896 ms (arranque en frío), clusters 455 ms, reports 1044 ms, signup 381 ms. |
| 2026-10-24 07:50:12 UTC | staging | `32a4183` | `npm run smoke` | Pasó | 255 / 451 / 429 / 219 ms. |
| 2026-10-24 07:50:13 UTC | staging | `32a4183` | `npm run smoke` | Pasó | 306 / 430 / 428 / 218 ms. |
| 2026-10-24 07:56 UTC | staging | `32a4183` | Monitor Python (`examples/python_health/`) | Pasó (`up`) | api_database 894 ms, public_clusters 504 ms, public_reports 510 ms. |
| 2026-10-24 07:50–07:55 UTC | staging | `32a4183` | k6 y `curl` en paralelo | **Falló:** ver INC-4 | Peticiones colgadas bajo concurrencia. |
| 2026-10-24 08:21 UTC | staging | `32a4183` | k6, 10 usuarios (antes del fix) | **Falló** | 161 peticiones, 4.97 % sin respuesta (60 s). |
| 2026-10-24 08:23 UTC | staging | `0fb3f76` | `supabase functions deploy api --use-api` + smoke check | Pasó | Despliegue del fix de INC-4; health 1,073 ms (arranque en frío), clusters 446 ms, reports 440 ms, signup 390 ms. |
| 2026-10-24 08:23–08:27 UTC | staging | `0fb3f76` | k6 con 2, 5, 10 y 25 usuarios | Pasó | 0 % de errores en 91, 200, 326 y 733 peticiones; p95 449 / 1,053 / 1,800 / 2,143 ms. |

## 5. Incidente INC-4 — Peticiones que tocan la base se quedan sin respuesta

Registrado también en `docs/testing/INCIDENTS.md`.

| Campo | Detalle |
|---|---|
| Fecha y hora con zona | 2026-10-24 07:50 UTC |
| Severidad | **Alta** para producción: una parte de las lecturas del mapa no responde y el usuario espera hasta el tiempo límite; en staging hay alternativa (reintentar). |
| Entorno y commit | staging `dcvihomkxkutkckmjvmp`, Function `api` v116 = `32a4183`; cliente: VPS del equipo, k6 v2.3.0 y `curl`. |
| Pasos para reproducir | 1. `VUS=10 DURATION=60s k6 run tests/load/public-read.js` con `API_BASE_URL` de staging. 2. O bien 40 `curl` a `/health` con 10 en paralelo y tiempo límite de 20 s. |
| Resultado esperado | Todas las lecturas responden `2xx` en pocos segundos (con 2 usuarios virtuales: 0 % errores, RUN-145). |
| Resultado obtenido | k6 con 10 usuarios: 33 peticiones, **36 % fallidas** por tiempo límite de 60 s. Con 25 usuarios: 206 peticiones, 12 % fallidas. Con 5 usuarios (08:01 UTC): 9 peticiones, 67 % fallidas; con 2 usuarios (08:00 UTC): 89/89 correctas. Es decir, no crece con la carga: aparece por rachas. `curl` 10 en paralelo: 5 de 40 sin respuesta a los 20 s; en secuencia: 1 de 15. Una ruta que **no** toca la base (`/no-existe` → 404) respondió 30/30 en paralelo. |
| Evidencia | Logs de la Function: las peticiones que sí llegaron terminaron en ≤ 2.8 s y hubo 3 respuestas `503` en `/health`; las colgadas no aparecen como terminadas. La conexión TLS se establece (≈ 0.05 s) pero no llega el primer byte. |
| Diagnóstico | Los logs de la Function registran el aviso de PostgreSQL `25001 there is already a transaction in progress` (2 veces entre 07:50 y 08:04 UTC): una transacción se abre sobre una conexión que ya tenía otra abierta. **Hipótesis pendiente de confirmar:** el cliente de PostgreSQL de la Function usa una sola conexión por instancia (`max: 1` en `supabase/functions/api/infrastructure/db.js`) a través de Supavisor, sin tiempo límite por consulta. Si esa conexión queda en mal estado (por ejemplo, una transacción que no se cerró), las peticiones de esa instancia esperan indefinidamente. Tras unos minutos sin carga el servicio vuelve a responder 12/12 (08:03 UTC). |
| Causa confirmada | Supavisor atiende a la Function en **modo transacción** (`mode: :transaction` en sus logs) y la librería `postgres` manda en *pipeline* las consultas concurrentes de una instancia por su única conexión; Supavisor no maneja ese pipeline entre transacciones. Se confirmó porque al eliminar el pipeline desaparecieron las fallas y el aviso `25001`. |
| Solución | PR #91, commit `0fb3f76`: `supabase/functions/api/infrastructure/db.js` pone en cola las operaciones de cada instancia (una consulta o transacción a la vez) y agrega un tiempo límite de 10 s que responde `503 database_unavailable`, descarta la conexión y abre una nueva. 5 pruebas nuevas; suites Deno (402) y PostgreSQL (7/7) en verde. |
| Verificación y cierre | Desplegado en staging el 2026-10-24 08:23 UTC. k6 antes: 5 % a 67 % de fallas con 5 a 25 usuarios; después: **0 %** con 2, 5, 10 y 25 usuarios (p95 ≤ 2,143 ms). Sin avisos `25001` ni respuestas `5xx` en los logs de 08:23 a 08:28 UTC. |
| Estado y responsable | Corregido en staging; se cierra al fusionar el PR #91 en `main`. Operador técnico del equipo. |

Con la corrección, la capacidad comprometida en el SLA sube a 25 usuarios
simultáneos (`docs/deployment/SLA.md`, sección 3).
