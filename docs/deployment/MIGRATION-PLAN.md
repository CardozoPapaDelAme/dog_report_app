# Plan de migración del software (despliegue)

Estado: esqueleto. Tarea: D1. Guía completa de la tarea:
[`docs/deployment/BACKLOG.md`](docs/deployment/BACKLOG.md), D1.

Producción sigue bloqueada (fail-closed) hasta que la Asociación de Hoteles de
Chihuahua apruebe un geofence; el procedimiento se ensaya sobre staging.

## 1. Entornos

Fuentes: `docs/DEPLOYMENT.md` (introducción y "Project bootstrap"), `eas.json`,
`README.md` ("Team setup").

| Entorno | Propósito | Proyecto / URL (sin secretos) | Quién opera | Datos |
|---|---|---|---|---|
| Local | _Pendiente (D1)_ | | | |
| Staging | _Pendiente (D1)_ | | | |
| Producción | _Pendiente (D1)_ | | | |

## 2. Inventario de componentes a migrar

Fuentes: `supabase/migrations/`, `db/schema.sql`, `supabase/config.toml`,
`docs/SECURITY.md` ("Secret and fail-closed inventory"), `eas.json`.

| Componente | Origen en el repo | Cómo se migra | Verificación |
|---|---|---|---|
| Migraciones SQL | `supabase/migrations/` | _Pendiente (D1)_ | |
| Function `api` | `supabase/functions/api/index.js` | | |
| Secretos (solo nombres) | | | |
| Bucket privado y políticas | | | |
| Cuentas de Asociación y Administrator | | | |
| Metadata de entorno | | | |
| Geofence aprobado | | | |
| Build móvil y variables `EXPO_PUBLIC_*` | `eas.json` | | |

## 3. Estrategia de migración

Fuentes: `docs/product/PROBLEM-CONTEXT.md`, `docs/DEPLOYMENT.md` ("Promotion and
verification").

_Pendiente (D1)_

## 4. Procedimiento paso a paso

Fuentes: `docs/DEPLOYMENT.md` ("Required preflight and promotion", "Remote-first
workflow", "Post-deploy smoke check").

| # | Paso | Comando o acción | Verificación | Responsable |
|---|---|---|---|---|
| 1 | _Pendiente (D1)_ | | | |

## 5. Plan de reversión (rollback)

Fuentes: `docs/DEPLOYMENT.md` ("Milestone export and restore runbook"),
`docs/deployment/BACKUP-LOG.md` (D5).

_Pendiente (D1)_

## 6. Criterios go/no-go y riesgos

_Pendiente (D1)_

## 7. Cronograma

Formato de referencia: `docs/testing/PLAN.md` (Gantt `mermaid`).

_Pendiente (D1)_

## 8. Ensayo sobre staging

| Fecha | Operador | Versión de Supabase CLI | Commit desplegado | Paso | Resultado |
|---|---|---|---|---|---|
| _Pendiente (D1)_ | | | | | |
