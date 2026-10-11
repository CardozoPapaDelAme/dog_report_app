# Pruebas con usuarios generales — T8

T8 / TD-121 · Responsable: Ricardo Becerra Bitar (P5).
Estado: **en curso**. Este documento prepara y registra las sesiones; no acredita
su ejecución hasta que las filas reales estén en `docs/testing/TEST_LOG.md`.

Fuentes: `docs/testing/BACKLOG.md` (T8),
`docs/product/ETAPA1-REQUERIMIENTOS-V2.md` (RNF04),
`docs/testing/README.md` y `docs/testing/cases/uat.md`.

## Objetivo y alcance

Validar con 3 a 5 personas externas al equipo que los flujos públicos se
entienden sin capacitación previa: hacer un reporte, consultar el mapa y
denunciar un reporte. La métrica obligatoria de RNF04 es completar el reporte
en menos de 5 minutos (300 segundos).

La sesión ocurre en un entorno de prueba con datos sintéticos. No se piden
nombres, correo, teléfono, fotografías de personas ni ubicaciones personales.
La persona puede abandonar la prueba, omitir una pregunta o pedir detener la
grabación en cualquier momento.

Fuera de alcance: medir satisfacción estadística, validar credenciales de
Asociación/Administrator, publicar reportes reales o usar datos de producción.

## Participantes y consentimiento

Reclutar de 3 a 5 personas que no pertenezcan al equipo. El facilitador asigna
un código secuencial `U01` a `U05`; conserva cualquier dato de contacto fuera
del repositorio y no lo asocia al código en archivos versionados.

Antes de empezar, leer este texto y registrar solo la respuesta y la fecha:

> Te invitamos a probar una aplicación de reporte de perros en situación de
> calle. Harás tres tareas ficticias y tomaremos el tiempo de cada una. Tu
> participación es voluntaria; puedes detenerte o saltar preguntas sin explicar
> por qué. No registraremos tu nombre ni datos de contacto en el reporte. Las
> observaciones se usarán para mejorar la aplicación y se guardarán con un código
> anónimo. ¿Aceptas participar?

| Participante | Consentimiento y fecha/hora con zona | Dispositivo y experiencia relevante | Sesión completada |
|---|---|---|---|
| U01 | pendiente | pendiente | pendiente |
| U02 | pendiente | pendiente | pendiente |
| U03 | pendiente | pendiente | pendiente |
| U04 (opcional) | pendiente | pendiente | pendiente |
| U05 (opcional) | pendiente | pendiente | pendiente |

No anotar firmas, voz, rostro, cuentas, contraseñas, números telefónicos ni
ubicación precisa del participante. Si se toma captura de pantalla o video,
debe ser con consentimiento explícito adicional y sin datos personales.

## Preparación de cada sesión

1. Confirmar que el build, commit y entorno de prueba están anotados antes de
   la sesión. Usar una cuenta y datos de prueba si el entorno lo necesita.
2. Preparar un reporte público sintético, visible y denunciable para la tarea 3;
   anotar su identificador de fixture, no una ubicación real.
3. Activar cronómetro independiente para cada tarea. El facilitador no enseña
   dónde pulsar ni corrige durante la tarea; solo puede repetir el enunciado.
4. Leer el consentimiento y marcarlo antes de iniciar el cronómetro.
5. Registrar cada tarea inmediatamente en `docs/testing/TEST_LOG.md` con el
   siguiente `RUN-<n>` consecutivo disponible. Un fallo abre un `INC-<n>` y un
   ticket de bug según `docs/testing/INCIDENTS.md`.

## Guion para el facilitador

Leer literalmente cada enunciado. Si la persona hace una pregunta, responder:
“Haz lo que te parezca natural; no puedo indicarte los pasos.” Registrar toda
ayuda solicitada, pausa o abandono como observación.

| Caso | Enunciado para la persona | Cronómetro | Éxito observable | Registro obligatorio |
|---|---|---|---|---|
| TC-UAT-01 | “Imagina que observaste un perro solo cerca de un lugar conocido. Registra un reporte de prueba sin incluir información personal.” | Iniciar al terminar de leer; detener al ver la confirmación de envío o el estado de cola local. | El flujo termina con confirmación/cola sin que el facilitador indique controles; duración menor a 300 s para RNF04. | Inicio, fin, duración, resultado, ayuda, errores y `RUN-<n>`. |
| TC-UAT-02 | “Consulta el mapa y encuentra el reporte de prueba indicado por el facilitador. Explora la información que aparece.” | Iniciar al terminar de leer; detener cuando la persona identifique el reporte o declare que no puede encontrarlo. | La persona llega al mapa y ubica o explica por qué no ubica el fixture. | Inicio, fin, duración, resultado, ayuda, errores y `RUN-<n>`. |
| TC-UAT-03 | “En el reporte de prueba indicado, usa la opción disponible para denunciarlo.” | Iniciar al terminar de leer; detener al aparecer la confirmación o mensaje final. | La denuncia se confirma o el caso documenta una falla/bloqueo reproducible. | Inicio, fin, duración, resultado, ayuda, errores y `RUN-<n>`. |

Si TC-UAT-01 supera 300 s, se marca **falló** para RNF04 aunque la persona
complete el reporte. Una interrupción externa (batería, red del entorno,
llamada) se registra como `bloqueado` con causa y responsable, no como éxito ni
defecto sin investigación.

## Hoja de observación por participante

Completar una copia por código UAT. El tiempo se anota como `HH:MM:SS` y la
duración en segundos, para comparar TC-UAT-01 con 300 s.

| Participante | Caso | Inicio | Fin | Duración (s) | Resultado | Ayuda solicitada/intervención | Observación concreta | RUN en test log | INC/ticket si aplica |
|---|---|---|---|---:|---|---|---|---|---|
| U<n> | TC-UAT-01 | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente | no aplica |
| U<n> | TC-UAT-02 | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente | no aplica |
| U<n> | TC-UAT-03 | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente | no aplica |

## Encuesta corta posterior

Aplicar cuando terminen las tres tareas. Registrar solo el código anónimo y las
respuestas, sin atributos que permitan reidentificar a la persona.

Escala: 1 = muy en desacuerdo / muy difícil; 5 = muy de acuerdo / muy fácil.

| Pregunta | Respuesta (1–5 o texto breve) |
|---|---|
| P1. Me fue claro cómo iniciar un reporte. | pendiente |
| P2. Me fue fácil completar el reporte. | pendiente |
| P3. Me fue claro cómo consultar el mapa. | pendiente |
| P4. Me fue claro cómo denunciar un reporte. | pendiente |
| P5. ¿En qué momento dudaste, te detuviste o esperabas otra opción? | pendiente |
| P6. ¿Qué cambiarías primero para que la app sea más fácil de usar? | pendiente |

## Registro de resultados y hallazgos

Al terminar todas las sesiones, consolidar una línea por participante y no
ocultar los abandonos, bloqueos ni fallas.

| Participante | TC-UAT-01 <300 s | TC-UAT-02 | TC-UAT-03 | Encuesta completada | Hallazgo/INC | Estado |
|---|---|---|---|---|---|---|
| U01 | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente |
| U02 | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente |
| U03 | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente |
| U04 (opcional) | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente |
| U05 (opcional) | pendiente | pendiente | pendiente | pendiente | pendiente | pendiente |

Un resultado `falló` exige:

1. Añadir la fila real en `docs/testing/TEST_LOG.md`.
2. Abrir el siguiente incidente consecutivo en `docs/testing/INCIDENTS.md`, con
   pasos, resultado esperado/obtenido, evidencia sin datos personales y ticket
   de bug Jira.
3. Vincular el `INC-<n>` en esta hoja y en la fila de ejecución.

T8 queda en **hecho** únicamente cuando hay consentimiento registrado para 3–5
participantes anónimos, nueve a quince ejecuciones reales en el test log, encuesta
y observaciones por participante, y los hallazgos están registrados.
