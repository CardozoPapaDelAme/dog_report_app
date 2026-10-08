# Test log — registro de ejecuciones

Estado: plantilla de T1. Sin ejecuciones registradas en esta entrega.
Convenciones: `docs/testing/README.md`. Cada ejecutor agrega sus filas; T12 / TD-125
consolida el resumen. Los ejemplos de formato no cuentan como ejecuciones.

## Resumen (T12)

Pendiente de ejecuciones reales. Informar totales por módulo (pasó/falló/bloqueado)
y por suite CI (pasaron/fallaron/omitidos), cobertura de T4, alfa, usuarios,
no funcionales, aceptación, conclusiones y pendientes. Los números deben coincidir
con las filas y con la corrida final T10; no sumar casos y suites entre sí.

## Ejecuciones de casos

Una fila por caso y ejecución, incluidos reintentos. RUN-n identifica la fila.
Registrar la ruta de su especificación, el commit completo probado y versiones
relevantes en entorno/notas. Resultado obtenido debe explicar qué se observó.

| Ejecución | Fecha y hora con zona | ID de caso y ruta | Ejecutado por | Entorno y versiones | Commit probado | Resultado | Resultado obtenido | Incidente | Evidencia y notas |
|---|---|---|---|---|---|---|---|---|---|

Formato para copiar (reemplazar todos los marcadores antes de registrar):

```text
| RUN-<n> | <fecha, hora, zona> | <TC-módulo-n; docs/testing/cases/modulo.md> | <persona> | <local/CI/dispositivo/staging; versiones; mocks o servicios reales> | <SHA completo> | <pasó/falló/bloqueado> | <observación concreta> | <INC-n; o no aplica> | <ruta desde raíz o URL persistente; motivo/responsable si bloqueado> |
```

Toda fila `falló` debe tener INC-n en `docs/testing/INCIDENTS.md` y ticket de bug
en Jira. Una fila `bloqueado` exige motivo y responsable; no es un caso aprobado.

## Corridas automáticas de CI

Una fila por suite de corridas sobre main y de la final T10. No registrar aquí
corridas de PR en curso. P2 abre incidente ante fallas de main. Las omitidas no
cuentan como aprobadas; registrar el motivo. Si una suite no pudo iniciar, no
inventar totales: anotar «sin ejecución» en los totales, la causa y el incidente.

| Ejecución CI | Fecha y hora con zona | Rama y commit probado | Suite | Pasaron | Fallaron | Omitidos | Enlace a corrida | Incidente | Notas |
|---|---|---|---|---|---|---|---|---|---|

Formato para copiar:

```text
| CI-<n> | <fecha, hora, zona> | main; <SHA completo> | <suite> | <total> | <total> | <total> | <URL de corrida> | <INC-n si falla; o no aplica> | <versiones, omisiones; indicar final T10 cuando aplique> |
```
