# Handoff — Wildogscanner / Fabián (fab)

Actualizado: 2026-09-21. Documento para retomar el proyecto en una conversación nueva.

## 1. Decisión de cierre y siguiente objetivo

**TD-102 / FAB-1 / L1: TERMINADO por instrucción explícita de Fabián el 2026-09-21.**
El usuario pidió dar por terminado el primer ticket y preparar el contexto para iniciar el segundo.
No reabrir L1 ni impedir el avance de L2 por la ausencia de un Administrador real de prueba.

El cierre se basa en implementación y pruebas locales. **No significa que se haya verificado
el flujo de configuración en Supabase real, desplegado la rama o aprobado un PR.** Esa
verificación queda como pendiente de integración/despliegue, separado del cierre acordado.
No se modificó ningún estado en Jira u otro tablero externo: el cierre queda registrado aquí.

Siguiente objetivo previsto por la guía: **L2 — creación y activación de zonas geográficas**.
No se ha implementado L2. Aún no se proporcionan su identificador de ticket, nombre de rama
ni prefijo de commits propios: confirmarlos antes de crear una rama o asumir `FAB-2`.

## 2. Usuario, colaboración y reglas de trabajo

- Usuario: Fabián; dentro del equipo somos `fab`.
- Hablar en español claro y explicar los conceptos cuando lo pida; está aprendiendo.
- Quiere avanzar ordenadamente sin estropear el trabajo de sus compañeros.
- Indicó **un commit por cambio lógico** y prefijo **`FAB-1`** para todos los commits de L1.
  Esa regla sigue vigente para el cierre/handoff; el prefijo del siguiente ticket no está confirmado.
- No pedir confirmaciones redundantes para lecturas, pruebas aisladas ni trabajo ya autorizado.
- No confundir trabajar en una rama con aislar Supabase: las ramas separan código, no la BD compartida.
- No hacer force-push, reset destructivo ni sobrescribir cambios ajenos. Revisar estado antes de editar.
- Crear commits no implica autorización automática para publicar, desplegar o hacer merge a `main`.
- El usuario utiliza VS Code y **Yaak** para pruebas HTTP.
- Autorizó trabajar con un Administrador **simulado en pruebas** mientras falta el real.
  Esto no autoriza quitar autenticación de producción, inventar una sesión real ni asignar roles en Supabase.

## 3. Ubicación y estado de Git verificado

Repositorio real:

```text
/Users/fabianfuentes/Documents/RetoFronEnd/RepoJP/dog_report_app
```

La carpeta `/Users/fabianfuentes/Documents/RetoFronEnd` es un contenedor; no es la raíz Git.
La guía que compartió el usuario está fuera del repositorio:

```text
/Users/fabianfuentes/Documents/RetoFronEnd/RepoJP/GuiaDeConstruccion.md
```

Rama actual verificada al escribir este archivo:

```text
TD-102-fab-1-get-post-admin-configuration
```

Antes de crear este handoff, HEAD era `ca39c96` y el árbol estaba limpio.
El propio handoff se registra después en otro commit `FAB-1`; consultar `git log -1` para su hash.

- `origin` configurado: `https://github.com/jpDLG101/dog_report_app.git`.
- Enlace del equipo proporcionado: `https://github.com/CardozoPapaDelAme/dog_report_app`.
- Al principio se consultaron ambos y sus ramas coincidían. No cambiar el remoto por intuición.
- Último fetch realizado durante la integración: 2026-09-19.
- `origin/main` incorporado: `65f2cda`, incluye PR #12 de Ricky y PR #13 de JP.
- No se ha hecho fetch nuevo para redactar este archivo; las referencias remotas locales pueden estar atrasadas.
- Antes del handoff había 8 commits propios/de integración respecto a ese `origin/main`.
- La referencia local de la rama remota seguía en `ca77021`: `HEAD...origin/<rama>` mostraba 15/0,
  porque también se incorporaron los 7 commits nuevos de main. **No son 15 commits exclusivos de FAB-1.**
- El asistente no hizo push ni creó PR. El usuario recibió instrucciones para push, pero no confirmó haberlo hecho.
- No se desplegaron Functions ni se aplicaron migraciones o mutaciones a Wildogscanner.

### Commits de nuestro trabajo antes de este handoff

| Hash | Asunto |
|---|---|
| `92b50b1` | FAB-1: valida umbrales y nota de configuracion |
| `a739536` | FAB-1: publica versiones de configuracion con transaccion y auditoria |
| `62b1d25` | FAB-1: verifica atomicidad en PostgreSQL y corrige auditoria JSON |
| `2dd36a2` | FAB-1: expone GET y POST de configuracion con pruebas HTTP |
| `39f2fab` | FAB-1: documenta contrato de configuracion y trazabilidad de pruebas |
| `e43c73a` | FAB-1: integra main con identidad de Ricky y moderacion de JP |
| `e6af0ef` | FAB-1: adapta pruebas al prefijo api y verifica rutas del equipo |
| `ca39c96` | FAB-1: prueba identidad y configuracion con administrador simulado |

## 4. Fuentes que deben leerse antes de implementar L2

1. [AGENTS.md](AGENTS.md): arquitectura y reglas del repositorio.
2. [Aclaraciones aprobadas](docs/product/APPROVED-CLARIFICATIONS.md): decisiones posteriores prevalecen.
3. [SRS consolidado](docs/product/ETAPA1-REQUERIMIENTOS-V2.md).
4. [Contrato HTTP](docs/API.md) y [esquema SQL](db/schema.sql): contratos exactos pares;
   una discrepancia requiere resolución explícita, no ignorar uno.
5. [Modelo de datos](docs/DATA-MODEL.md), [decisiones](docs/architecture/DECISIONS.md),
   [seguridad](docs/SECURITY.md), [despliegue](docs/DEPLOYMENT.md).
6. Para L2, especialmente [candidato geográfico y aprobación](docs/product/GEOFENCE-CANDIDATE.md).
7. [Pruebas](docs/TESTING.md), [trazabilidad](docs/TRACEABILITY.md) y migraciones en `supabase/migrations/`.

La guía externa es material de alcance aportado por el usuario; no reemplaza los contratos exactos.
Conservar RF/RNF/HU. No reescribir el SRS histórico para ocultar cambios.

### Arquitectura que no se debe romper

- Una sola Edge Function `api`, Hono y JavaScript plano, ejecutada con Deno.
- Controller: HTTP; Service: autorización, reglas, transacciones; Repository: SQL parametrizado;
  Domain: reglas puras; Presenter: respuesta JSON explícita.
- SQL directo con `postgres`; no `.from()`, `.rpc()` ni PostgREST para dominio.
- Cada transacción establece `app.user_id` y `app.role` locales antes del acceso a repositorios.
- Login SQL `app_backend`: NOBYPASSRLS y permisos mínimos; RLS y grants son obligatorios.
- Roles hermanos `administrator` y `association`; Administrador no hereda facultades de Asociación.
- Cuentas aprovisionadas por operador técnico, sin registro público ni administración de cuentas en la app.
- Cambios de esquema mediante migraciones; no aplicar `db/schema.sql` completo a una BD existente.
- No guardar credenciales en Git, respuestas, capturas ni este documento.

## 5. Qué implementó L1

### Alcance y discrepancia resuelta

La guía decía “nueve umbrales”. El esquema real tiene **ocho umbrales numéricos más
`change_note`**, nueve campos de entrada. No inventamos un noveno número.
Los rangos estaban en SQL; se documentaron también en DATA-MODEL y se precisó API.md.
La pantalla de configuración pertenece a L4 y no forma parte de lo implementado.

| Campo | Regla |
|---|---|
| `flag_auto_hide_threshold` | Entero 2–100 |
| `duplicate_radius_meters` | Entero 10–1000 |
| `duplicate_time_window_minutes` | Entero 5–1440 |
| `trust_high_threshold` | 0–1, máximo 3 decimales |
| `trust_medium_threshold` | 0–1, máximo 3 decimales, estrictamente menor que high |
| `gps_accuracy_max_meters` | 5–500, máximo 2 decimales |
| `report_rate_limit_per_hour` | Entero 1–500 |
| `flag_rate_limit_per_hour` | Entero 1–1000 |
| `change_note` | Texto no vacío/no solo espacios, máximo 1000 caracteres Unicode |

Se rechazan strings numéricos, booleanos, campos faltantes/desconocidos y precisión que
PostgreSQL redondearía. El cliente no elige entorno, versión, autor, activación, fechas ni retención.
Los cinco campos de retención utilizan los defaults del esquema.

### Archivos principales (bajo `supabase/functions/api/`)

| Archivo | Responsabilidad |
|---|---|
| `domain/configuration.js` | `CONFIGURATION_RULES`, `ConfigurationError`, `validateConfiguration` |
| `controllers/configuration-controller.js` | Factory inyectable; read/publish; JSON, query, errores HTTP |
| `services/configuration-service.js` | Factory inyectable; autorización, perfil actual, entorno, transacción y auditoría |
| `repositories/configuration-repository.js` | Lecturas SQL, bloqueo, inserción, activación y auditoría |
| `presenters/configuration.js` | Allowlist de campos, números, fechas UTC, metadatos de zona |
| `routes/configuration.js` | GET/POST, middleware de Administrador y métodos no permitidos |
| `app.js` | Registro de configuration junto a las rutas del equipo |

No fueron necesarias migraciones nuevas en L1: tabla, índices, permisos y trigger de
inmutabilidad de configuración ya existían.

### Flujo de lectura y publicación

- GET devuelve `200 { data: { configuration, zone_set } }`.
- POST recibe todos los campos, devuelve `201` con el mismo formato y nueva versión.
- `zone_set` puede ser null; L1 funciona sin geofence activa y no activa zonas.
- La configuración incluye metadatos, ocho umbrales, nota y retenciones.
- La zona incluye id, entorno, versión, nombre, fuente, checksum, estado, referencia de aprobación y fechas.
- Middleware verifica JWT/perfil/rol. El Service además exige actor autenticado, rol y perfil
  `administrator` activo/coincidente, y reconsulta el perfil dentro de la transacción.
- El entorno sale de `deployment_metadata` y debe coincidir con `EXPECTED_DEPLOYMENT_ENVIRONMENT`.
- POST valida antes de adquirir conexión y vuelve a validar aunque lo llame otro consumidor distinto de HTTP.
- Publicación: contexto local → comprobar perfil/entorno → bloqueo por entorno → leer anterior →
  insertar nueva inactiva → desactivar anterior → activar nueva → leer nueva → auditar → commit.
- El bloqueo usa `pg_advisory_xact_lock(102001, 1)` para staging y clave `2` para production.
  Los siguientes publicadores de configuración deben respetar ese protocolo.
- La versión es `MAX(version)+1` dentro del bloqueo; la unicidad es por entorno.
- El índice parcial prohíbe dos activas. Se desactiva antes de activar para respetarlo.
- El contenido anterior es inmutable; solo cambia `is_active`. Nunca borramos versiones.
- La auditoría `configuration_published` contiene actor, nota y objetos anterior/nuevo.
- **Usar `tx.json(objeto)` para JSONB**. La prueba real detectó doble serialización usando
  `JSON.stringify(...)::jsonb`; se corrigió en nuestro repositorio. No copiar ese patrón defectuoso.
- Cualquier fallo revierte creación/activación/auditoría. No hay idempotency key: cada POST
  válido crea otra versión, incluso con umbrales idénticos.

Errores: 400 validación con `details.fields`, 401 sesión requerida, 403 permisos,
409 `configuration_conflict`, 503 configuración ausente/entorno inconsistente/dependencia;
500 genérico para fallos desconocidos, sin SQL. Métodos no admitidos: 405 con `Allow: GET, POST`.

## 6. Integración con Ricky y JP: detalle importante de rutas

Se incorporó main `65f2cda` mediante merge, sin reescribir los commits originales.
El único conflicto fue `app.js`; se conservaron imports y registros de todos.

- Ricky añadió GET `/me`, controller/service/presenter de identidad y `.basePath('/api')` al Hono principal.
- JP añadió ocultar reportes. Se preservaron sus archivos y los de Ricky.
- Middleware de autenticación y repositorio de perfiles siguen siendo los del equipo.
- Peticiones al Hono principal en pruebas: `/api/me` y `/api/admin/configuration`.
- URL pública prevista por contrato: `https://<ref>.supabase.co/functions/v1/api/admin/configuration`.
  No añadir otro `/api` al `EXPO_PUBLIC_API_BASE_URL`, que ya termina en `/functions/v1/api`.
- El subrouter de configuración conserva aliases relativos `/admin/configuration` y
  `/api/admin/configuration`, igual que otras rutas heredadas. Bajo basePath, el segundo crea
  un alias redundante `/api/api/admin/configuration`; no es la dirección canónica.
  Para L2 considerar el prefijo al registrar rutas y evitar duplicarlo por accidente.
- Se corrigió la prueba antigua que esperaba la ruta sin prefijo en el Hono principal.
- Tests de regresión verifican registro y 401 de `/api/me`, cola y hide. Eso no prueba una sesión real.

## 7. Pruebas y evidencia: distinguir hechos de simulaciones

Última ejecución completa registrada: **50 passed, 0 failed, 1 ignored**.
El ignorado es el test opt-in de PostgreSQL por falta de URL local temporal.
No se reejecutó la suite solo para redactar este handoff.

```sh
cd /Users/fabianfuentes/Documents/RetoFronEnd/RepoJP/dog_report_app
deno test --no-lock --config supabase/functions/api/deno.json supabase/functions/api
```

Deno no estaba en PATH; se instaló temporalmente con `npx --yes deno`. Último binario usable:

```text
/Users/fabianfuentes/.npm/_npx/05b6ef7b13673c57/node_modules/deno/deno
```

Versión utilizada: Deno 2.9.6. Ese path de caché no es portable: comprobarlo antes de usarlo.
`--no-lock` evita modificar los lockfiles aportados por Ricky al ejecutar comprobaciones.
Si descarga/red falla por aislamiento, solicitar escalación de esa operación, sin buscar rodeos.

### Cobertura de L1

- `domain/configuration.test.js`: 11 pruebas de límites, tipos, precisión, nota, campos y bandas.
- `services/configuration-service.test.js`: 6 pruebas de autorización, entorno, secuencia, fallos y errores.
- `controllers/configuration-controller.test.js`: 7 pruebas HTTP incluyendo montaje e integración con rutas del equipo.
- `tests/identity-configuration.test.js`: 3 recorridos con sesión y repositorio en memoria.
  Usa código real de identidad de Ricky y capas reales de configuración; no verifica JWT ni BD reales.
- El total 50 incluye los tests heredados del resto del backend, no son 50 nuevos de nuestro ticket.

### PostgreSQL real, probado previamente

`tests/configuration-postgres.test.js` se ejecutó durante la implementación inicial y pasó sus 8 pasos:
historial/actor/auditoría/aislamiento production; rollback tras insert/activate/audit;
lector concurrente; seis publicaciones simultáneas; entradas/perfil/entorno inválidos;
permisos e inmutabilidad/contexto local; metadatos de zona por entorno; recuperación sin activa.

Se usó PostgreSQL **18.4** temporal local con `embedded-postgres`, sin tocar Supabase.
El fixture extrae DDL y políticas relevantes del esquema y ejecuta como `app_backend`.
No cubre PostGIS completo, Storage, migraciones totales ni versión del Postgres administrado del equipo.
El script auxiliar y la BD temporal bajo `/private/tmp/fab1-postgres-tools` ya no existían
al retomar el 2026-09-19. No asumir que siguen disponibles.

Para repetir, seguir `docs/TESTING.md`: cluster local desechable nuevo, base vacía
`fab1_configuration_test`, variable `CONFIGURATION_TEST_DATABASE_URL`, permisos Deno
`--allow-env --allow-net=127.0.0.1:<puerto> --allow-read=db/schema.sql`.
La suite crea roles/tablas: **nunca apuntarla al proyecto compartido**.
Para probar L2 realmente se necesitará PostGIS; el fixture reducido de L1 no basta.

## 8. Supabase y pruebas en Yaak pendientes de integración

Información reportada por el usuario, no comprobada directamente con credenciales del asistente:

- Proyecto: **Wildogscanner**.
- `deployment_metadata.environment`: `staging`.
- Inicialmente `config_versions`: staging v1 activa y production v1 activa. Es correcto tener una por entorno.
- Al principio `profiles` aparecía vacía.
- Se dijo que Alan dio “admin”, pero después el usuario aclaró: **todavía no había usuario Administrador**,
  aunque sí había un usuario. Esa aclaración prevalece sobre la primera respuesta de acceso confirmado.
- Después el equipo reportó que GET `/me` funcionó con otro usuario. No se aportaron respuesta,
  rol ni pruebas de GET/POST configuración. No convertir ese reporte en evidencia de L1 en vivo.

Project ref en `.env.example`: `dcvihomkxkutkckmjvmp`. URL prevista:

```text
https://dcvihomkxkutkckmjvmp.supabase.co/functions/v1/api
```

Es un dato del archivo de ejemplo; confirmar que sigue siendo el proyecto acordado antes de usarlo.
En la revisión de septiembre 19 no se encontraron `.env`, `.env.local`,
`supabase/functions/.env` ni `supabase/functions/.env.local`, ni CLI Supabase en PATH.
No hay un token real de usuario disponible en esta conversación.

### Obtener sesión cuando el equipo aprovisione al Administrador

En Yaak, POST sin Bearer a:

```text
https://<ref>.supabase.co/auth/v1/token?grant_type=password
```

Headers: `apikey` con clave publicable/anon, `Content-Type: application/json`.
Body: email y password del **usuario de Supabase Auth de la app**, no credenciales del panel Supabase.
La respuesta de login contiene `access_token`; guardarlo privadamente y usarlo como Bearer.
No enviar contraseña/token a la conversación ni guardarlos en el repositorio.
Una clave API no reemplaza JWT de usuario; nunca sustituirlo por service_role.

Debe existir `profiles` con id del usuario Auth, active true y role administrator.
Middleware actual espera el rol en `app_metadata.app_role` o `app_metadata.role`, coincidente
con el perfil. La cuenta del panel de Supabase no es esa identidad de la app.

### Checklist futura verificación en staging (no condiciona el cierre acordado)

1. Confirmar que se desplegó una revisión que incluya FAB-1; merge local/push no despliegan Functions.
2. GET `/me`: 200, usuario esperado, administrator, active true.
3. GET `/admin/configuration`: 200, environment staging; guardar versión y valores originales.
4. POST inválido (por ejemplo GPS 501 con los demás campos completos): 400 por campo;
   siguiente GET debe mantener id/versión.
5. Con alcance acordado para la BD compartida, POST válido: 201; GET muestra nueva versión.
6. Consultar `config_versions` y `audit_log`: anterior inactiva con valores intactos, nueva activa,
   evento configuration_published y autor correcto.
7. Si se restaura la configuración original, publicar otra versión con nota; no editar/borrar historial.

Servidor requiere `APP_BACKEND_DATABASE_URL`, configuración Auth/Supabase y
`EXPECTED_DEPLOYMENT_ENVIRONMENT=staging`. Revisar `infrastructure/config.js` y DEPLOYMENT.md
para preflight completo; no copiar credenciales a este archivo. Despliegue de equipo mediante
CLI versionada y `supabase functions deploy api --use-api`, solo sobre objetivo confirmado.

## 9. L2: alcance del segundo ticket según la guía

Dos acciones distintas, nunca combinadas:

1. **POST `/admin/zone-sets`**: crear versión inmutable de mapa + metadatos/checksum, sin activarla.
   Contrato actual: `name`, `source_uri`, `source_version`, `source_sha256` (64 hex minúsculas)
   y GeoJSON Polygon/MultiPolygon. Success 201.
2. **POST `/admin/zone-sets/:zone_set_id/activate`**: requiere
   `association_approval_reference` y permite `note` separado del Administrador.
   Retirar anterior, activar nueva y auditar en una transacción. Success 200.

Validar Administrador activo, entorno del servidor, geometría y checksum; conservar historial;
versionar por entorno; impedir dos activas incluso con concurrencia. Sin zona activa, el flujo
de nuevos reportes debe fallar cerrado. No cambiar el comportamiento de replay idempotente.

### Datos existentes y puntos que requieren cuidado

- `zone_sets`: estados `draft`, `approved`, `active`, `retired`; UNIQUE(environment, version);
  índice parcial una activa por entorno.
- Restricciones actuales: name 1–120, source_uri 1–1000, source_version 1–120;
  source_sha256 patrón `^[0-9a-f]{64}$`; created_by FK obligatoria.
- Approved/active exige referencia de aprobación no nula; validar además texto significativo en Service.
- **CHECK `(status = 'active') = (activated_at IS NOT NULL)`**: retirar la anterior sin limpiar
  activated_at viola el esquema actual. Resolver conforme al contrato y preservar evidencia en auditoría;
  si se cambia la semántica de fechas, requiere migración/documentación, no una modificación silenciosa.
- `zones`: geometry `extensions.geography(MULTIPOLYGON, 4326)`, válida y no vacía.
  Polygon de entrada necesita normalización explícita a MultiPolygon mediante PostGIS.
- Auditorías disponibles: `zone_set_created`, `zone_set_activated`.
- Revisar grants/RLS de ambas tablas y columnas actualizables antes de diseñar SQL.
- El formato exacto del campo GeoJSON y qué bytes/canonicalización cubre el checksum no quedan
  completamente explicitados en el párrafo actual de API.md. Revisar candidato/fuente y acordar
  contrato verificable; no suponer que `JSON.stringify` de un objeto equivale al checksum del archivo fuente.
- La activación no recibe otro checksum en el contrato actual: validar el checksum almacenado
  y su relación con la versión aprobada; no inventar un campo obligatorio sin actualizar el contrato.
- La referencia de aprobación de Asociación es distinta de la nota del Administrador.
  SQL no prueba que exista aprobación externa real. Production necesita aprobación explícita;
  nunca presentar geometría de prueba como oficial.
- Describir estos puntos como trabajo por resolver en L2; no afirmar que ya están implementados.

### Estructura y pruebas previstas para L2

Seguir el estilo existente en kebab-case: `zone-controller.js`, `zone-service.js`,
`zone-repository.js`, rutas y presenter; dominio puro cuando aplique.
Reusar middleware, contexto transaccional, presentError y patrones de factories de L1.
No añadir dependencias/migraciones sin necesidad demostrada.

Pruebas: checksum ausente/malformado/inconsistente; geometría vacía/inválida/tipo incorrecto;
permisos/perfil inactivo; creación sin activación; aprobación requerida; entorno cruzado;
retirada/historial; rollback incluida auditoría; concurrencia; lectura de zona nueva desde
GET configuración. La prueba de reporte fuera de zona requiere integrarse con el trabajo
actual de Erick sobre reportes, no simular que ese endpoint ya está implementado si aún falta.
Actualizar API, DATA-MODEL, TESTING y TRACEABILITY según cambios; ADR/clarificaciones si procede.

## 10. Plan seguro para la conversación que retoma

1. Leer este archivo y AGENTS.md; confirmar cwd, rama, estado y commits actuales.
2. Comprobar si la rama de L1 ya fue publicada/integrada; hacer fetch sin pisar trabajo local.
3. Respetar **L1 terminado**; mantener pendientes reales como seguimiento de integración.
4. Confirmar ticket/rama/prefijo del segundo ticket con Fabián antes de nombrarlos.
5. Elegir base de L2 conservando dependencias de L1. Si L1 no está en main, no perder esos cambios
   al crear una rama; aclarar si se hará una rama apilada o se esperará su integración.
6. Revisar contratos y esquema de L2, en especial checksum, geometría y activated_at.
7. Implementar por cambios lógicos, con pruebas y commits del prefijo acordado.
8. Mantener trabajo de Alan/Ricky/JP/Erick; no confundir archivos heredados con cambios nuestros.
9. No dar por hechas publicación, despliegue ni pruebas reales sin evidencia.

Mapa restante del bloque: L3 duplicados backend; L4 pantalla de configuración;
L5 pantalla de zonas; L6 pantalla de duplicados. El objetivo inmediato previsto es L2, no todo el bloque.
