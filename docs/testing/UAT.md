# Pruebas con usuarios generales

Estado: plantilla de T1; T8 / TD-121 prepara el guion y ejecuta con 3–5 personas
fuera del equipo. Fuente: `docs/testing/BACKLOG.md`, T8. RNF04: reporte en menos
de 5 minutos. Convenciones: `docs/testing/README.md`.

## Sesión y consentimiento

Fecha, facilitador, commit/build, dispositivo, versiones y entorno: pendientes.
Explicar propósito, participación voluntaria y uso de observaciones/capturas;
registrar consentimiento antes de probar. Identificar participantes con códigos
anónimos como U01. No versionar identidades, firmas ni datos de contacto.

| Participante anónimo | Consentimiento y fecha | Dispositivo y experiencia relevante |
|---|---|---|
| <U-n> | <confirmado antes de ejecutar; o pendiente> | <modelo, OS, contexto sin identidad> |

## Guion de tareas

T8 completa: hacer un reporte, consultar el mapa y denunciar un reporte.
Usar `docs/testing/cases/TEMPLATE.md` para los casos. Registrar tiempos reales;
para RNF04 comparar duración del reporte con el límite estricto de 300 segundos.

| Participante | Caso | Tarea y entrada | Pasos | Resultado esperado | Inicio/fin y duración | Ejecución/resultado | Observaciones |
|---|---|---|---|---|---|---|---|
| <U-n> | <TC-UAT-n> | <tarea; fixture> | <acciones> | <criterio observable> | <pendiente hasta medir> | <RUN-n en docs/testing/TEST_LOG.md> | <dificultades/evidencia> |

## Encuesta y conclusiones

Preparar preguntas breves sobre facilidad, claridad y dificultades. Anotar las
respuestas sin datos personales. Resultados, hallazgos y pendientes: pendientes.
Cada ejecución va a `docs/testing/TEST_LOG.md`; cada falla genera incidente en
`docs/testing/INCIDENTS.md` y ticket de bug en Jira al detectarse.
