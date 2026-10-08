# Reporte de incidentes

Estado: plantilla de T1; sin incidentes registrados en esta entrega.
Convenciones: `docs/testing/README.md`. Cada ejecutor abre el incidente y el ticket
de bug en Jira al fallar un caso. T11 / TD-124 consolida; no esperar la regresión final.

## Índice

Ordenar por severidad y estado al consolidar. INC-n es consecutivo global.

| ID | Fecha | Caso o suite CI | Ejecución del test log | Severidad | Módulo | Jira | Estado | Responsable | Corrección y verificación |
|---|---|---|---|---|---|---|---|---|---|

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

## Anexo histórico (T11)

Pendiente: conservar separados los fixes históricos hasta `49290b0` según
`docs/testing/BACKLOG.md`. No convertirlos en fallas recién ejecutadas.
