# Pruebas no funcionales

Estado: plantilla de T1; T9 / TD-122 completa mediciones, inspecciones y evidencias.
Fuente de alcance: `docs/testing/BACKLOG.md`, T9. Estrategia: `docs/TESTING.md`.
Convenciones: `docs/testing/README.md`.

## Entorno y método

Fecha, responsable, commit/build, dispositivo/OS, versiones de API/base/herramientas,
red y configuración: pendientes. Distinguir test automatizado, medición en teléfono,
inspección y carga. No atribuir evidencia con mocks a un servicio real.

## Registro por requerimiento

| Caso | RNF | Método | Precondiciones y entrada | Pasos/herramienta | Criterio esperado y fuente | Métrica/unidad y resultado obtenido | Ejecución y evidencia | Límites y pendientes |
|---|---|---|---|---|---|---|---|---|
| <TC-MODULO-n> | <RNF exacto> | <test/medición/inspección/carga> | <fixture/configuración> | <pasos y ruta completa> | <umbral del contrato o por acordar> | <pendiente hasta ejecutar> | <RUN-n en docs/testing/TEST_LOG.md; ruta o URL> | <cobertura real> |

Si no hay umbral definido, acordarlo antes de evaluar éxito; no inventar requisitos.
Compatibilidad sin dispositivo disponible queda explícitamente sin cubrir, con
justificación. RNF35 requiere inspección y referencia que pospone embeddings.

## Medición de carga (T9)

Registrar script bajo `tests/load/`, objetivo, URL/entorno, fecha, duración,
usuarios virtuales, cantidad de peticiones, p95 con unidad, tasa de error y
limitaciones. Respetar el alcance ligero de lectura de T9 y las cuotas de staging.
Esta plantilla no ejecuta carga ni crea datos en un entorno compartido.

## Conclusiones

Pendientes. Cada caso ejecutado se registra en `docs/testing/TEST_LOG.md`; una
falla abre incidente y bug Jira al detectarse. T12 consolida los resultados.
