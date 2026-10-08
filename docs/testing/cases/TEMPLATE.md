# Plantilla de casos de prueba — <módulo>

Estado: plantilla sin ejecutar. Copiar a `docs/testing/cases/<modulo>.md`.
Convenciones: `docs/testing/README.md`. Fuentes: <rutas completas y secciones>.
Responsable: <persona>. Tipos no aplicables: <requerimiento, tipo y justificación>.

## Entrada → resultado esperado

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|---|
| TC-MODULO-01 | <RF/RNF/HU o aclaración> | <mínimo/máximo/promedio/excepción/normal> | <estado inicial, rol, configuración> | <valores exactos o ruta del fixture + clave> | 1. <acción>; 2. <comprobación> | <salida exacta y efectos que deben o no ocurrir> | <ruta completa del test + nombre exacto, o protocolo + ruta prevista de evidencia> |

La fila anterior es un marcador para reemplazar, no un caso registrado.
Los resultados obtenidos y las evidencias reales van en `docs/testing/TEST_LOG.md`.

## Ejemplo didáctico: tamaño de manada

Estos IDs usan el módulo EJEMPLO y están reservados para esta explicación.
No cuentan como cobertura ni como casos ejecutados. Datos ilustrativos completos:
`docs/testing/data/example-pack-count.json`. Validación local en
`models/reportPayload.js`, función `validateReportFormDraft`, verificada en la
base de T1 (`e59348a`) el 2026-10-07. Revisar el contrato si cambia el código.

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|---|
| TC-EJEMPLO-01 | RF04, HU-04 | excepción | Formulario de avistamiento/manada | cantidad_aprox = "1" | 1. Cargar form de pack-1; 2. Validar | Error integerRange, min 2, max 1000; cantidad no aceptada | Protocolo manual: validar el form del fixture; evidencia pendiente |
| TC-EJEMPLO-02 | RF04, HU-04 | mínimo | Formulario de avistamiento/manada | cantidad_aprox = "2" | 1. Cargar form de pack-2; 2. Validar | Sin error de cantidad; details.cantidad_aprox = 2 | Protocolo manual: validar el form del fixture; evidencia pendiente |
| TC-EJEMPLO-03 | RF04, HU-04 | promedio | Formulario de avistamiento/manada | cantidad_aprox = "500" | 1. Cargar form de pack-500; 2. Validar | Sin error de cantidad; details.cantidad_aprox = 500 | Protocolo manual: validar el form del fixture; evidencia pendiente |
| TC-EJEMPLO-04 | RF04, HU-04 | máximo | Formulario de avistamiento/manada | cantidad_aprox = "1000" | 1. Cargar form de pack-1000; 2. Validar | Sin error de cantidad; details.cantidad_aprox = 1000 | Protocolo manual: validar el form del fixture; evidencia pendiente |
| TC-EJEMPLO-05 | RF04, HU-04 | excepción | Formulario de avistamiento/manada | cantidad_aprox = "1001" | 1. Cargar form de pack-1001; 2. Validar | Error integerRange, min 2, max 1000; cantidad no aceptada | Protocolo manual: validar el form del fixture; evidencia pendiente |

El test existente `L7 form requires pack quantity from 2 to 1000 only for avistamiento manada`
en `models/reportPayload.test.js` sirve como referencia; no atribuirle todas las
entradas de esta tabla sin comprobar sus aserciones.
