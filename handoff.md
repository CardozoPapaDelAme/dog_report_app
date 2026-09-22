# Handoff — Wildogscanner / Fabián (`fab`)

Actualizado: 2026-09-22. Estado al terminar la implementación local de L3.

## Estado de entrega

- Repositorio: `/Users/fabianfuentes/Documents/RetoFronEnd/RepoJP/dog_report_app`.
- Rama L3: `TD-104-fab-3-get-post-admin-duplicate-groups-reverse`.
- Base: `0a2a579`, merge de L2 mediante PR #15. Incluye L1 y la corrección
  `ee3258c` de integración Controller → Service de L2.
- L1 (`TD-102`, `FAB-1`) y L2 (`TD-103`, `FAB-2`) están integrados en `main`.
- L3 (`TD-104`, `FAB-3`) implementado y probado localmente, en commits separados.
  Consultar `git log origin/main..HEAD` para la lista exacta.
- No se hizo push, PR, merge, despliegue ni mutación de Supabase para L3.
- La prueba con un Administrador real sigue aplazada por Fabián. Las sesiones
  HTTP de prueba son simuladas; la prueba SQL usa PostgreSQL/PostGIS real local.
- El handoff del Escritorio describe el cierre anterior de L2; su afirmación de
  que L2 aún no está fusionado quedó superada por PR #15.

## Alcance L3 y decisión confirmada

Tres rutas bajo la única aplicación Hono con `basePath('/api')`:

1. `GET /api/admin/duplicate-groups`: grupos activos, canónico, miembros,
   versión y fechas. Sin body, query ni paginación en el prototipo.
2. `POST /api/admin/duplicate-groups`: crea una resolución humana, 201.
   Recibe `canonical_report_id`, `report_ids` (2–500 UUID distintos, incluyendo
   el canónico) y `note` opcional según el contrato existente.
3. `POST /api/admin/duplicate-groups/:group_id/reverse`: revierte una resolución
   activa, 200; `note` obligatorio, significativo y máximo 1000 caracteres.

**Decisión explícita de Fabián:** conservar la moderación y reabrir candidatos.
Revertir no pasa los reportes a `pending_review`, no publica ocultos ni restaura
eliminados. No modifica ningún campo de `reports` ni `photo_assets`.

La conectividad se comprueba sobre candidatos `pending` con ambos extremos en la
selección. A–B–C es válido aunque A–C no exista. Un camino mediante un reporte no
seleccionado o un candidato confirmed/dismissed no cuenta. Todos los miembros
existen, no están eliminados lógicamente y no pertenecen a otro grupo activo.

Resolver crea grupo versión 1 y membresías, confirma los candidatos internos y
registra `duplicate_resolved`. Revertir conserva el grupo como `reversed`, sube
su versión a 2, desactiva membresías, reabre candidatos internos confirmados y
registra `duplicate_reversed`. La auditoría conserva motivo, actor y estado
anterior/nuevo. Una nueva resolución crea otro grupo, sin borrar la anterior.
Los candidatos externos/dismissed permanecen intactos. La eliminación física de
un miembro no canónico por retención no bloquea liberar el grupo restante.

## Arquitectura y concurrencia

- Leer `AGENTS.md`; prioridad: aclaraciones aprobadas → SRS v2 → API y SQL como
  contratos pares → modelo, ADR, seguridad, despliegue, pruebas y trazabilidad.
- La guía externa está en `../GuiaDeConstruccion.md`; no reemplaza contratos.
- Controller adapta HTTP; Service autoriza, valida y abre transacciones;
  Repository usa SQL parametrizado; Domain contiene el grafo y las reglas;
  Presenter usa allowlist. Una sola Edge Function `api`, sin PostgREST/RPC.
- Service fija `app.user_id`/`app.role` locales antes de SQL, reconsulta perfil y
  comprueba entorno contra `EXPECTED_DEPLOYMENT_ENVIRONMENT`.
- Resolución/reversión usan `pg_advisory_xact_lock(103003, 1)` para toda la BD,
  porque reports no tiene columna environment. También bloquean reportes por
  UUID y candidatos por UUID; reversal bloquea el grupo. Todo escritor futuro
  de duplicados debe respetar este protocolo.
- Índices existentes respaldan la exclusividad de membresía activa y canónico.
  SQL/RLS/grants existentes bastan: L3 no añade migraciones.
- GET toma grupo/miembros en una misma consulta para una lectura consistente.
- Fallos de auditoría o conflictos revierten la transacción completa. Conflictos
  conocidos retornan 409; SQL desconocido retorna 500 genérico sin detalles.
- Nunca usar `service_role` en cliente, guardar secretos ni aplicar el snapshot
  completo `db/schema.sql` a una BD existente.

## Archivos principales

Bajo `supabase/functions/api/`:

| Archivo | Función |
|---|---|
| `domain/duplicate-group.js` | UUID, campos, notas, disponibilidad y grafo conectado |
| `services/duplicate-service.js` | Autorización, transacciones, resolución y reversión |
| `repositories/duplicate-repository.js` | SQL directo, candados, memberships, candidatos y auditoría |
| `controllers/duplicate-controller.js` | Parsing HTTP, códigos de error y comandos |
| `routes/duplicate-groups.js` | GET/POST, Administrator y métodos permitidos |
| `presenters/duplicate-group.js` | Vista pública del comando sin campos privados |
| `tests/duplicate-postgres.test.js` | Integración real HTTP + Service + SQL/PostGIS |
| `tests/helpers/duplicate-fixture.js` | Fixture aislado para pruebas de Service/HTTP |

`docs/API.md`, `docs/DATA-MODEL.md`, `docs/TESTING.md` y `docs/TRACEABILITY.md`
describen el contrato exacto, candados, límites, runbook y cobertura.

## Verificación ejecutada

- Suite backend completa: **78 passed, 0 failed, 3 ignored**. Los tres ignorados
  son suites SQL opt-in; L3 se ejecutó aparte con base real.
- L3 PostgreSQL/PostGIS local: **1 passed, 10 pasos, 0 failed**.
- Prueba real aplica las seis migraciones existentes en una BD vacía, genera
  candidatos con el trigger real y opera como `app_backend` (NOBYPASSRLS).
- Verifica grafo, HTTP, canonicalidad pública/Asociación, rollback tras insertar
  auditoría, concurrencia, RLS/grants, contexto local, reversión tras moderación
  posterior y retención. Compara reportes/fotos antes y después sin cambios.
- Docker temporal `fab3-postgis-test`, puerto local 55434; eliminado al terminar.
  El runbook para recrearlo está en `docs/TESTING.md`.
- Deno utilizado desde caché local:
  `/Users/fabianfuentes/.npm/_npx/05b6ef7b13673c57/node_modules/deno/deno`.
  No es ruta portable. Usar `--no-lock` para no tocar lockfiles del equipo.

## Próximo paso

Revisar la entrega L3 y, si Fabián lo pide, publicar la rama y abrir PR a main.
La autorización anterior de merge fue para L2; no extenderla automáticamente a L3.
La validación administrada en staging sigue pendiente y requiere revisión del
proyecto/entorno/despliegue según `docs/DEPLOYMENT.md`. No afirmar que L3 esté activo
allí. El siguiente bloque de la guía es L4 (pantalla de configuración); L6 es la
pantalla de duplicados y no forma parte de este ticket backend.

Mantener commits pequeños con prefijo del ticket, conservar cambios del equipo
y evitar operaciones destructivas o reescritura de historia.
