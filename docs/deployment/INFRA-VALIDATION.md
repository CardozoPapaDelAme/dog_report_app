# Validación de infraestructura (health/check)

Estado: esqueleto (D0, TD-138). Responsable: D2 (TD-140). Guía completa de la tarea:
[`docs/deployment/BACKLOG.md`](docs/deployment/BACKLOG.md), D2.

## 1. Health check del backend

Fuentes: `supabase/functions/api/routes/health.js`,
`supabase/functions/api/controllers/healthController.js`,
`supabase/functions/api/services/healthService.js`, `docs/API.md`.

`GET /functions/v1/api/health` es público y responde `200` cuando la base de datos
contesta, o `503 database_unavailable` si no.

_Pendiente (D2): qué valida y qué no; cambios a la respuesta si se deciden._

## 2. Checklist de infraestructura

Fuentes: `docs/DEPLOYMENT.md` ("Project bootstrap", "Post-deploy smoke check"),
`docs/SECURITY.md`.

| Punto | Cómo se verifica | Esperado | Obtenido | Fecha | Quién |
|---|---|---|---|---|---|
| Extensiones PostGIS y pgcrypto | | | _Pendiente (D2)_ | | |
| RLS activo en tablas de dominio | | | | | |
| `app_backend` `NOBYPASSRLS` sin objetos propios | | | | | |
| Grants móviles vacíos | | | | | |
| Bucket aprobado privado | | | | | |
| Secretos requeridos presentes (solo nombres) | | | | | |
| Signup público deshabilitado (`422 signup_disabled`) | | | | | |
| Advisors de seguridad y rendimiento | | | | | |
| HTTPS/TLS | | | | | |
| Function `api` en el commit esperado | | | | | |

## 3. Script de humo

_Pendiente (D2): uso, salida de ejemplo y su test._

## 4. Registro de ejecuciones

| Fecha | Entorno | Commit | Herramienta | Resultado | Notas |
|---|---|---|---|---|---|
| _Pendiente (D2)_ | | | | | |
