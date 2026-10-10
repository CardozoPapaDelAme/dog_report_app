# Reporte de incidentes

Estado: plantilla de T1 con incidentes registrados por los ejecutores.
Convenciones: `docs/testing/README.md`. Cada ejecutor abre el incidente y el ticket
de bug en Jira al fallar un caso. T11 / TD-124 consolida; no esperar la regresión final.

## Índice

Ordenar por severidad y estado al consolidar. INC-n es consecutivo global.

| ID | Fecha | Caso o suite CI | Ejecución del test log | Severidad | Módulo | Jira | Estado | Responsable | Corrección y verificación |
|---|---|---|---|---|---|---|---|---|---|
| INC-1 | 2026-10-10 | TC-MODERACION-07 | RUN-48 | media | MODERACION | Pendiente (Alan Ruiz) | abierto | Alan Ruiz | Pendiente |

## Severidad y estado

- crítica: impide continuar o compromete seguridad, privacidad o integridad de datos.
- alta: un flujo principal falla sin alternativa viable.
- media: falla parcial con alternativa disponible.
- baja: defecto menor de presentación o documentación sin bloqueo del flujo.

Estados: `abierto`, `en análisis`, `en corrección`, `pendiente de verificación`,
`cerrado`. Responsable obligatorio mientras no esté cerrado. Si es duplicado,
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
| Pasos para reproducir | 1. `RUN_KNOWN_GAPS=1 deno test --no-lock --allow-env --config supabase/functions/api/deno.json --filter GAP supabase/functions/api/services/moderationService.test.js`; 2. Leer el resultado |
| Resultado esperado | `listQueue` rechaza con `forbidden` antes de obtener conexión, como `supabase/functions/api/services/duplicateService.test.js` (FAB-3 SERVICE: authorization and shape validation run before storage) |
| Resultado obtenido | `association must be rejected with forbidden, received null`: `listQueue` intenta obtener la conexión sin revisar el rol. Los comandos approve/hide/restore/delete de `supabase/functions/api/services/moderationService.js` tienen el mismo patrón |
| Evidencia | Salida de consola local; el test queda marcado y omitido en npm test hasta la corrección |
| Ticket de bug en Jira | Pendiente; responsable Alan Ruiz |
| Estado y responsable | abierto; Alan Ruiz |
| Diagnóstico | Confirmado por lectura de código: `listQueue` y `executeTransition` fijan contexto y llaman al repositorio sin autorizar al actor |
| Solución | Pendiente (fuera del alcance de T6: requiere cambio de código de producción) |
| Commit o PR correctivo | Abierto; responsable Alan Ruiz |
| Verificación y cierre | Pendiente: quitar la marca del test y registrar una nueva RUN que pase |

## Anexo histórico (T11)

Pendiente: conservar separados los fixes históricos hasta `49290b0` según
`docs/testing/BACKLOG.md`. No convertirlos en fallas recién ejecutadas.
