# Registro de respaldos

Estado: calendario definido; primera exportación pendiente de las credenciales del
operador (2026-10-24). Guía de la tarea:
[`docs/deployment/BACKLOG.md`](docs/deployment/BACKLOG.md), D5.

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
| 2026-10-24 | Operador técnico (asistido) | supabase: no instalado / psql: no instalado / docker 29.2.1 | `20261021120000` | — | 18 objetos (10 MB) según la base | — | **No ejecutada:** la VPS del equipo no tiene la sesión de la CLI de Supabase ni la cadena de conexión de la base; queda para la primera corrida del calendario con las credenciales del operador. |

## Restauraciones

| Fecha (UTC) | Proyecto destino (aislado) | Respaldo usado | Verificaciones | Duración (RTO) | Resultado |
|---|---|---|---|---|---|
| — | Segundo proyecto Free (cuota: hasta 2 proyectos activos) | Primera exportación completa | Conteos por tabla, RLS y grants, login por rol, smoke check, manifiesto de fotos | Sin medir | **No ensayada:** depende de la primera exportación. Se ensaya en un proyecto Free aislado que se borra al terminar. |
