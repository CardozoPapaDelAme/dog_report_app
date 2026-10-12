# Casos de prueba — Usuarios generales (T8)

T8 / TD-121 · Responsable: Ricardo Becerra Bitar (P5).
Estado: completado; RUN-124 a RUN-133 están registradas. INC-3 conserva el
hallazgo de usabilidad de mapa y su reejecución aprobada.
tareas, consentimiento y encuestas. Convenciones:
`docs/testing/README.md`. Protocolo, consentimiento, cronómetro y encuesta:
`docs/testing/UAT.md`.

Los tres casos se ejecutan manualmente por 3 a 5 personas ajenas al equipo, una
vez por participante. No se usan datos personales, fotografías de personas ni
ubicaciones reales. El facilitador registra cada ejecución con el próximo
`RUN-<n>` consecutivo en `docs/testing/TEST_LOG.md`.

## Entrada → resultado esperado

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|
| TC-UAT-01 | RNF04, RF01, RF04, RF05, RF06, HU-01, HU-04, HU-05, HU-06 | normal | Participante anónimo con consentimiento; build y entorno de prueba listos; cámara/ubicación disponibles o ruta sin foto; cronómetro preparado | Escenario sintético: un perro solo; tipo y detalles válidos; ningún dato personal | 1. Leer el enunciado de `docs/testing/UAT.md`; 2. iniciar cronómetro; 3. participante crea un reporte sin ayuda; 4. detener al envío/cola; 5. registrar resultado y encuesta | El participante completa el flujo sin guía y tarda menos de 300 s. Si supera 300 s, RNF04 falla aunque el reporte llegue a envío/cola. No se solicitan datos de identidad. | Evidencia manual: fila `RUN-<n>` con inicio, fin y duración en `docs/testing/TEST_LOG.md`; observación anónima en `docs/testing/UAT.md`; incidente si falla |
| TC-UAT-02 | RF10, RF11, RF12, RF13, RF14, HU-10, HU-11, HU-12, HU-13, HU-14 | normal | Participante anónimo con consentimiento; build y entorno de prueba listos; fixture público sintético visible en mapa; cronómetro preparado | Identificador o descripción no personal del fixture que el facilitador puede entregar oralmente | 1. Leer el enunciado de `docs/testing/UAT.md`; 2. iniciar cronómetro; 3. participante abre y explora el mapa; 4. localizar el fixture o explicar el impedimento; 5. detener y registrar | El participante puede llegar al mapa y ubicar el fixture o se conserva un impedimento reproducible, sin que el facilitador señale controles. | Evidencia manual: fila `RUN-<n>` en `docs/testing/TEST_LOG.md`; observación anónima en `docs/testing/UAT.md`; incidente si falla |
| TC-UAT-03 | RF08, HU-08, RNF29 | normal | Participante anónimo con consentimiento; build y entorno de prueba listos; fixture público sintético, visible y canónico; cronómetro preparado | Mismo fixture sintético o uno separado, identificado por el facilitador | 1. Leer el enunciado de `docs/testing/UAT.md`; 2. iniciar cronómetro; 3. participante abre el detalle; 4. presenta denuncia; 5. detener al mensaje final y registrar | El participante encuentra la opción de denuncia y recibe confirmación o un error que queda documentado. La observación no contiene identidad ni ubicación precisa. | Evidencia manual: fila `RUN-<n>` en `docs/testing/TEST_LOG.md`; observación anónima en `docs/testing/UAT.md`; incidente si falla |

Tipos no aplicables: mínimo, máximo, promedio y excepción. T8 mide comprensión
del flujo con tareas representativas; los límites y errores técnicos se cubren en
los casos funcionales de `docs/testing/cases/reportero.md` y
`docs/testing/cases/mapa-y-roles.md`.
