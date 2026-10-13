# Reporte de incidentes

Estado: T11 consolidó los incidentes INC-1 a INC-3 (2026-10-12), cada uno con ticket de bug en Jira o su justificación, y el anexo histórico. La corrida final de T10 y T14 pueden agregar incidentes.
Convenciones: `docs/testing/README.md`. Cada ejecutor abre el incidente y el ticket
de bug en Jira al fallar un caso. T11 / TD-124 consolida; no esperar la regresión final.

## Índice

Ordenar por severidad y estado al consolidar. INC-n es consecutivo global.

| ID | Fecha | Caso o suite CI | Ejecución del test log | Severidad | Módulo | Jira | Estado | Responsable | Corrección y verificación |
|---|---|---|---|---|---|---|---|---|---|
| INC-1 | 2026-10-10 | TC-MODERACION-07 | RUN-48 | media | MODERACION | TD-129 | corregido | Alan Ruiz | Commit `313f045`; verificado en RUN-82 |
| INC-3 | 2026-10-11 | TC-UAT-02 | RUN-126 | media | MAPA / UAT | No aplica: hallazgo UAT, sin defecto confirmado | cerrado | Ricardo Becerra Bitar | RUN-133 pasó con fixture público; se conserva la dificultad de navegación como hallazgo de usabilidad |
| INC-2 | 2026-10-11 | TC-ALPHA-14 | RUN-96 | baja | REPORTE / PRIVACIDAD | TD-130 | corregido | Erick Herrera | Correctivo `f18ba0b` (PR #64); verificado en Android real en RUN-137 |

## Severidad y estado

- crítica: impide continuar o compromete seguridad, privacidad o integridad de datos.
- alta: un flujo principal falla sin alternativa viable.
- media: falla parcial con alternativa disponible.
- baja: defecto menor de presentación o documentación sin bloqueo del flujo.

Estados: `abierto`, `en análisis`, `en corrección`, `pendiente de verificación`,
`corregido`, `cerrado`. Responsable obligatorio mientras no esté cerrado. Si es duplicado,
referir el incidente principal y explicar la relación. Si no es un defecto del
producto, documentar la causa de entorno/fixture y su resolución verificada.

## Plantilla de incidente

Copiar este bloque por cada incidente real; sustituir los marcadores.

### INC-<n> — <título>

| Campo | Detalle |
|---|---|
| Fecha y hora con zona | <detección> |
| Caso o suite CI | <ID y ruta completa del caso; o suite fallida en main> |
| Ejecución que lo originó | <RUN-n o CI-n en docs/testing/TEST_LOG.md> |
| Severidad y justificación | <crítica/alta/media/baja; impacto> |
| Módulo | <módulo afectado> |
| Entorno y commit | <versiones, rol, mocks/servicios reales; SHA completo> |
| Precondiciones y datos | <estado y valores; ruta completa del fixture> |
| Pasos para reproducir | 1. <acción>; 2. <acción> |
| Resultado esperado | <resultado de la especificación> |
| Resultado obtenido | <observación, código de error, efectos> |
| Evidencia | <ruta completa o URL persistente sin secretos> |
| Ticket de bug en Jira | <clave y URL; si falta, pendiente y responsable> |
| Estado y responsable | <estado; persona> |
| Diagnóstico | <causa confirmada o hipótesis pendiente> |
| Solución | <cambio realizado; o pendiente> |
| Commit o PR correctivo | <SHA o URL; o abierto con responsable> |
| Verificación y cierre | <nueva RUN-n/CI-n; resultado, fecha y quién verificó> |

No borrar la ejecución fallida cuando se corrige. Cerrar exige una nueva ejecución
que pruebe la corrección y deje evidencia vinculada.

## Incidentes registrados

### INC-1 — El servicio de moderación no autoriza el rol del actor

| Campo | Detalle |
|---|---|
| Fecha y hora con zona | 2026-10-10 22:36 UTC |
| Caso o suite CI | TC-MODERACION-07; docs/testing/cases/mapa-y-roles.md |
| Ejecución que lo originó | RUN-48 en docs/testing/TEST_LOG.md |
| Severidad y justificación | media: ADR-019 (`docs/architecture/DECISIONS.md`) exige que el Service cargue el perfil y verifique el rol; hoy solo lo hace el middleware `requireAuth('administrator')` de `supabase/functions/api/routes/moderation.js`, que sí bloquea a la Asociación por HTTP. Falta la defensa en el Service; no se observó exposición de datos |
| Módulo | MODERACION (RF19, RF20, RNF07) |
| Entorno y commit | Local; Deno 2.9.6; dobles sin base de datos; 99b5ac28ca80ee369f668dc20d0088d88f0ca7ce |
| Precondiciones y datos | Sin `APP_BACKEND_DATABASE_URL`; actor `{ type: "authenticated", role: "association" }` |
| Pasos para reproducir | En el commit probado: 1. `RUN_KNOWN_GAPS=1 deno test --no-lock --allow-env --config supabase/functions/api/deno.json --filter GAP supabase/functions/api/services/moderationService.test.js`; 2. Leer el resultado. Tras la corrección, el test marcado se reemplazó por los tests `RF19 INC-1` del mismo archivo, que corren en npm test |
| Resultado esperado | `listQueue` rechaza con `forbidden` antes de obtener conexión, como `supabase/functions/api/services/duplicateService.test.js` (FAB-3 SERVICE: authorization and shape validation run before storage) |
| Resultado obtenido | `association must be rejected with forbidden, received null`: `listQueue` intenta obtener la conexión sin revisar el rol. Los comandos approve/hide/restore/delete de `supabase/functions/api/services/moderationService.js` tienen el mismo patrón |
| Evidencia | Salida de consola local de RUN-48 (falla) y RUN-82 (corrección verificada) |
| Ticket de bug en Jira | TD-129 (https://dog-reports-team3.atlassian.net/browse/TD-129), creado retroactivamente el 2026-10-12 en T11 |
| Estado y responsable | corregido; Alan Ruiz |
| Diagnóstico | Confirmado por lectura de código: `listQueue` y `executeTransition` fijan contexto y llaman al repositorio sin autorizar al actor |
| Solución | `supabase/functions/api/services/moderationService.js` autoriza al actor antes de obtener conexión (Administrator activo con perfil coincidente; si no, `forbidden`; sin sesión, `authentication_required`) en `listQueue` y en los cuatro comandos. `supabase/functions/api/controllers/moderationController.js` traduce esos errores a 403/401 |
| Commit o PR correctivo | `313f0458ebc300cc39c2c8e15b45d80d0ffa7be4` en la rama `TD-119-fix-inc-1-rol-en-servicio-de-moderacion` |
| Verificación y cierre | Test de brecha reemplazado por dos tests de regresión que corren en npm test; RUN-82 pasó. PR de la corrección: #59; tests 401/403 de los comandos de moderación en [#60](https://github.com/CardozoPapaDelAme/dog_report_app/pull/60) |

### INC-2 — Falta aviso RF02 en el formulario público de reporte

| Campo | Detalle |
|---|---|
| Fecha y hora con zona | 2026-10-11 00:00 America/Mexico_City |
| Caso o suite CI | TC-ALPHA-14; docs/testing/cases/alpha.md |
| Ejecución que lo originó | RUN-96 en docs/testing/TEST_LOG.md |
| Severidad y justificación | baja: no bloquea el envío de reportes y no se observaron campos de identidad, pero falta el aviso visible requerido por RF02 sobre información incidental en foto o texto libre |
| Módulo | REPORTE / PRIVACIDAD (RF02) |
| Entorno y commit | Android real; samsung SM-S918B; Android 16 SDK 36; staging con servicios reales; app 1.0.0 com.wildogscanner.app; build development/debug no Expo Go; fe8da67d23862517ab5878228da5a15ca971b973 |
| Precondiciones y datos | Formulario público de reporte abierto durante la sesión alfa T7; cuentas y credenciales no documentadas; evidencia en docs/testing/data/alpha/2026-10-11/TC-ALPHA-14-sin-aviso-rf02.mp4 |
| Pasos para reproducir | 1. Abrir el flujo público de reporte; 2. Recorrer las preguntas del formulario; 3. Verificar que no haya campos de nombre, teléfono o correo; 4. Buscar un aviso sobre información incidental en foto o texto libre |
| Resultado esperado | No hay campos que pidan identificadores personales y se muestra el aviso RF02 sobre información incidental |
| Resultado obtenido | No se observaron campos de identidad, pero no apareció el aviso RF02 en las preguntas del reporte |
| Evidencia | docs/testing/data/alpha/2026-10-11/TC-ALPHA-14-sin-aviso-rf02.mp4 |
| Ticket de bug en Jira | TD-130 (https://dog-reports-team3.atlassian.net/browse/TD-130), creado retroactivamente el 2026-10-12 en T11 |
| Estado y responsable | corregido; Erick Herrera |
| Diagnóstico | Confirmado en ejecución manual alfa; la UI automatizada de T5 ya cubre el aviso RF02 y la ausencia de campos de identidad, pero la evidencia que abrió el incidente fue Android real y debe repetirse ahí |
| Solución | Aviso visible agregado en el formulario público sin pedir nombre, teléfono, correo ni otros datos de identidad |
| Commit o PR correctivo | `f18ba0b` (PR #64) |
| Verificación y cierre | RUN-117 pasó con `npm run test:report-form-ui` y cubrió `TC-REPORTE-03`. RUN-137 pasó el 2026-10-12 en Android real con build `88950993dfb3c60f5a5262357b9ec1de695af307`; la evidencia `docs/testing/data/alpha/2026-10-12/TC-ALPHA-14-aviso-rf02-visible.jpg` muestra el aviso RF02 visible en el formulario público y cierra la verificación |

### INC-3 — La persona no encontró el mapa para comprobar el reporte recién enviado

| Campo | Detalle |
|---|---|
| Fecha y hora con zona | 2026-10-11; hora no registrada; America/Chihuahua |
| Caso o suite CI | TC-UAT-02; docs/testing/cases/uat.md |
| Ejecución que lo originó | RUN-126 en docs/testing/TEST_LOG.md |
| Severidad y justificación | media: la persona no completó la tarea de consulta del mapa en cinco minutos. Aún no se confirma si la causa es navegación, expectativa de visibilidad inmediata o preparación del fixture. |
| Módulo | MAPA / UAT (RF10–RF14, HU-10–HU-14) |
| Entorno y commit | iPhone 18 Pro; versión de iOS, build, entorno y commit no registrados |
| Precondiciones y datos | Participante anónimo U03. No quedó registrado el consentimiento ni un identificador de fixture público visible. La persona intentó comprobar el reporte que acababa de enviar. |
| Pasos para reproducir | 1. Terminar TC-UAT-01 con un reporte de prueba; 2. pedir a la persona que consulte el mapa para comprobarlo; 3. observar si puede encontrar el acceso al mapa y el reporte sin indicar controles. |
| Resultado esperado | La persona llega al mapa y localiza el fixture público sintético indicado, o describe un impedimento reproducible. |
| Resultado obtenido | Tras 5 min, la persona no supo llegar al mapa para verificar que su reporte se había subido con éxito. |
| Evidencia | Observación anónima proporcionada por el facilitador; no se adjuntó captura ni video. |
| Ticket de bug en Jira | No aplica: la reejecución confirmó un problema de preparación/expectativa del fixture, no un defecto confirmado de producto. |
| Estado y responsable | cerrado; Ricardo Becerra Bitar |
| Diagnóstico | Confirmado en RUN-133: TC-UAT-02 se completa con un reporte público de prueba. El fallo inicial buscaba comprobar el reporte recién enviado, que puede requerir revisión antes de hacerse visible. La dificultad para llegar al mapa permanece como hallazgo de usabilidad en las encuestas de U01–U03. |
| Solución | El guion de UAT conserva la instrucción de usar un fixture público, sintético y visible para TC-UAT-02. |
| Commit o PR correctivo | No aplica: no se confirmó defecto de producto. |
| Verificación y cierre | RUN-133 pasó el 2026-10-11 en 176 s sin ayuda, con un fixture público visible. Se cierra como incidente de preparación de la prueba; el hallazgo de usabilidad queda registrado en `docs/testing/UAT.md`. |

## Anexo histórico (T11)

Los 12 commits `fix` desde el inicio del proyecto hasta `49290b0` (2026-10-05)
se conservan separados: ocurrieron durante el desarrollo, antes de esta etapa de
pruebas, y no son fallas de casos ejecutados, por lo que no tienen INC ni ticket
de bug. Obtenidos con
`git log --oneline 49290b0 | grep -E '^[0-9a-f]+ fix([(: !]|$)'`; los PRs, con
`gh api repos/CardozoPapaDelAme/dog_report_app/commits/<sha>/pulls`.

| Commit | Fecha | Autor | Mensaje | PR |
|---|---|---|---|---|
| `25d63d0` | 2026-10-03 | Alan Ruiz | fix(dev): keep the Windows Path when adding platform-tools | #47 |
| `2c8df22` | 2026-10-02 | Alan Ruiz | fix(camera): keep slow model loads and re-arm retry wake-ups | #45 |
| `b3d7718` | 2026-10-02 | Alan Ruiz | fix(queue): never drop auto-sync triggers and wake up due drafts | #45 |
| `2eab713` | 2026-10-02 | Alan Ruiz | fix(camera): time out photo validation and colour detection | #43 |
| `5db0506` | 2026-10-02 | Alan Ruiz | fix(flags): block double flag submits and pin the zone list zoom | #40 |
| `ffa6a2c` | 2026-10-02 | Alan Ruiz | fix(map): reset pin photo state per report and clear location timer | #39 |
| `107f58f` | 2026-10-01 | Uncensored290 | fix style update hero background color | #39 (fusionado con esa rama; el commit no tiene PR propio) |
| `5703580` | 2026-10-01 | Alan Ruiz | fix(api): type cluster id parameters in public clusters query | #38 |
| `e1695be` | 2026-10-01 | Alan Ruiz | fix(auth): disable public signup and harden policy tests | #33 |
| `8976930` | 2026-10-01 | Alan Ruiz | fix(db): split backend mutate policies per command | #33 |
| `964c3d8` | 2026-09-30 | jpDLG101 | fix: make admin hero buttons visible on dark header | #32 |
| `038630a` | 2026-09-30 | jpDLG101 | fix: call /me instead of /api/me to avoid duplicated api prefix | #32 |

## Correcciones posteriores a `49290b0`

De los commits con "fix" entre `49290b0` y `main`, solo uno corrige un defecto
hallado por un caso ejecutado:

| Commit | Mensaje | PR | Tratamiento |
|---|---|---|---|
| `313f045` | T6: fix(moderation): authorize the Administrator actor inside the moderation Service | #59 | INC-1 (TD-129) |
| `bceb201` | T5: Fix Playwright test runner | #64 | Ajuste de herramienta de pruebas; ninguna fila del test log falló por esto, sin incidente |
| `63b4e9c` | T2: fix(testing): force the spec reporter so node:test totals parse on Node 22 | #56 | Ajuste de la CI de T2 (anterior a las ejecuciones de casos); sin incidente |
