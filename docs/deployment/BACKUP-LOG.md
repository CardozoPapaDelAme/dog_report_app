# Registro de respaldos

Estado: calendario definido; primera exportación completa y primer ensayo de
restauración ejecutados y verificados el 2026-10-24. Guía de la tarea:
[`docs/deployment/BACKLOG.md`](/docs/deployment/BACKLOG.md), D5.

Procedimiento: `docs/DEPLOYMENT.md` ("Milestone export and restore runbook").
Los dumps, objetos, manifiestos y cadenas de conexión viven fuera del repositorio,
en almacenamiento cifrado del operador. Aquí solo se registran metadatos.

El plan Free de Supabase no hace respaldos automáticos, así que el equipo los hace a
mano: cada semana exporta la base de datos completa (roles, estructura y datos) y las
fotos privadas, calcula una huella SHA-256 de cada archivo para poder comprobar que no
se dañaron, y guarda todo cifrado fuera de Supabase.

## Calendario

| Dato | Valor |
|---|---|
| Frecuencia | Cada 7 días |
| Día y hora | Lunes, 10:00 (hora de Chihuahua); si es inhábil, el siguiente día hábil |
| Responsable | Operador técnico del equipo; suplente: otro integrante con acceso al proyecto |
| Recordatorio | Evento recurrente semanal en el calendario compartido del equipo, con enlace a este archivo |
| Qué se registra | Una fila en "Exportaciones" por corrida, aunque falle |
| Cómo se monitorea | La revisión semanal de `docs/deployment/MONITORING.md` (señal "Antigüedad de la última exportación") alerta si la última fila tiene más de 7 días |
| Retención de copias | Las 4 últimas semanales y una por hito del proyecto |

**Pasos de cada corrida** (detalle exacto en el runbook de `docs/DEPLOYMENT.md`):

1. Anotar fecha UTC, versiones (`supabase --version`, `psql --version`,
   `docker --version`) y la migración actual (hoy `20261021120000`).
2. Desde una carpeta cifrada fuera del repo, con la cadena de conexión en una
   variable de entorno (nunca escrita en el comando):
   `supabase db dump --db-url "$DATABASE_URL" -f <respaldo>/roles.sql --role-only`,
   luego `-f <respaldo>/schema.sql` y `-f <respaldo>/data.sql --use-copy --data-only`
   con las exclusiones del runbook.
3. Calcular tamaño y SHA-256 de los tres archivos de la base (roles, esquema y
   datos) con `sha256sum`.
4. Exportar los objetos del bucket privado `approved-photos` con un script del
   operador (fuera del repo) que genere un manifiesto con ruta, tamaño y SHA-256, y
   comparar el número de objetos con la base (hoy 18).
5. Cifrar y guardar; registrar la fila abajo, sin rutas privadas ni secretos.

## Exportaciones

| Fecha (UTC) | Operador | Versiones (supabase/psql/docker) | Migración actual | Archivos y SHA-256 | Objetos de Storage | Duración | Resultado |
|---|---|---|---|---|---|---|---|
| 2026-10-24 16:20 | Operador técnico (asistido) | supabase 2.122.0 / psql: no instalado (`pg_dump` del contenedor `supabase/postgres:17.6.1.166`) / docker 29.2.1 | `20261021120000` | roles 481 B `e40ed7ba…`; esquema 70 KB `eee22e6e…`; datos 1.8 MB `d5db9e25…`; manifiesto de fotos `0db49d73…` | 18/18 objetos (10.9 MB): tamaños iguales a `storage.objects` | ≈ 3 min | **Correcta.** Conteos por tabla del dump iguales a la base en las 13 tablas de `public` (p. ej. 94 reportes, 17 fotos). Hecha con la sesión de la CLI (`--linked`), sin escribir la cadena de conexión. Guardada en la VPS del equipo, fuera del repo, con permisos solo del propietario; **cifrado pendiente** (falta la frase de paso del operador). |

## Restauraciones

| Fecha (UTC) | Proyecto destino (aislado) | Respaldo usado | Verificaciones | Duración (RTO) | Resultado |
|---|---|---|---|---|---|
| 2026-10-24 16:52 | Segundo proyecto Free aislado (`dogreport-restore-test`, misma región), creado para el ensayo | Exportación del 2026-10-24 16:20 (SHA-256 verificados antes de usarla) | Conteos de las 13 tablas de `public` iguales al origen (94 reportes, 17 fotos); RLS 13/13; `app_backend` sin `BYPASSRLS`; bucket `approved-photos` privado; PostGIS y pgcrypto; 4 cuentas de Auth; 18/18 objetos con SHA-256 idéntico al manifiesto; cada `photo_assets` con su objeto | ≈ 3 min (crear el proyecto ≈ 1 min, base 38 s, fotos 6 s) | **Correcta para datos y fotos.** No incluye desplegar la Function ni sus secretos en el destino (≈ 5 min más, ver ensayo de despliegue en `docs/deployment/INFRA-VALIDATION.md`). Hallazgos abajo. |

### Hallazgos del ensayo (2026-10-24)

1. `<respaldo>/roles.sql` trae `GRANT SET ON PARAMETER "log_min_messages" TO
   "supabase_realtime_admin"`, un permiso del proveedor que un proyecto nuevo ya
   tiene y que el usuario `postgres` no puede volver a otorgar. Se restaura con una
   copia de `<respaldo>/roles.sql` sin esa línea.
2. El dump no incluye el historial de migraciones (`supabase_migrations`). En el
   proyecto restaurado hay que marcarlas como aplicadas con
   `supabase migration repair --status applied <versión>` antes del siguiente
   `supabase db push`.
3. El rol `app_backend` se restaura sin contraseña: hay que asignarle una nueva y
   actualizar el secreto `APP_BACKEND_DATABASE_URL` de la Function.

