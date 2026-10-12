# Pruebas con usuarios generales — T8

T8 / TD-121 · Responsable: Ricardo Becerra Bitar (P5).
Estado: **completado**. Hay 10 ejecuciones reales registradas en
`docs/testing/TEST_LOG.md` para tres participantes anónimos; se conservan el
fallo y la reejecución de mapa de U03 como hallazgo.

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
| U01 | confirmado verbalmente; 2026-10-11; hora no registrada; America/Chihuahua | iPhone 18 Pro; iOS 27; simulador Xcode para TC-UAT-02 y TC-UAT-03 | completó las tres tareas |
| U02 | confirmado verbalmente; 2026-10-11; hora no registrada; America/Chihuahua | iPhone 18 Pro; iOS 27; simulador Xcode para TC-UAT-02 y TC-UAT-03 | completó las tres tareas |
| U03 | confirmado verbalmente; 2026-10-11; hora no registrada; America/Chihuahua | iPhone 18 Pro; iOS 27; simulador | completó las tres tareas; TC-UAT-02 reejecutado |
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
| U01 | TC-UAT-01 | hora no registrada | hora no registrada | 76.15 | pasó | sin ayuda | Reporte sin foto completado; sin evidencia personal registrada. | RUN-124 | no aplica |
| U02 | TC-UAT-01 | hora no registrada | hora no registrada | 123.43 | pasó | poca ayuda | Reporte sin foto completado; la ayuda se conserva como hallazgo de usabilidad. | RUN-125 | no aplica |
| U03 | TC-UAT-02 | hora no registrada | hora no registrada | 300 | falló | no registrada | No llegó al mapa para comprobar el reporte recién enviado. | RUN-126 | INC-3; Jira pendiente |
| U03 | TC-UAT-01 | hora no registrada | hora no registrada | 10 | pasó | sin ayuda | Reporte de prueba completado sin dificultad en simulador iPhone 18 Pro con iOS 27. | RUN-127 | no aplica |
| U03 | TC-UAT-03 | hora no registrada | hora no registrada | 112.12 | pasó | sin ayuda | Abrió un reporte de prueba y presentó la denuncia de forma sencilla y sin esfuerzo. | RUN-128 | no aplica |
| U01 | TC-UAT-02 | hora no registrada | hora no registrada | 18 | pasó | sin ayuda; solo enunciado de la tarea | Encontró el reporte público de prueba en simulador Xcode. | RUN-129 | no aplica |
| U01 | TC-UAT-03 | hora no registrada | hora no registrada | 47 | pasó | sin ayuda; solo enunciado de la tarea | Presentó denuncia y recibió confirmación en simulador Xcode. | RUN-130 | no aplica |
| U02 | TC-UAT-02 | hora no registrada | hora no registrada | 29 | pasó | ayuda mínima para ubicar el reporte | Encontró el reporte público de prueba en simulador Xcode. | RUN-131 | no aplica |
| U02 | TC-UAT-03 | hora no registrada | hora no registrada | 65 | pasó | ayuda mínima sobre cómo denunciar | Presentó denuncia y recibió confirmación en simulador Xcode. | RUN-132 | no aplica |
| U03 | TC-UAT-02 (reejecución) | hora no registrada | hora no registrada | 176 | pasó | sin ayuda | Con reporte público de prueba, encontró el reporte; batalló para llegar a él. | RUN-133 | INC-3; hallazgo de usabilidad |

## Encuesta corta posterior

Aplicar cuando terminen las tres tareas. Registrar solo el código anónimo y las
respuestas, sin atributos que permitan reidentificar a la persona. Las respuestas
de U01–U03 se obtuvieron al cierre de sus sesiones parciales y se conservarán al
terminar las tareas pendientes.

Escala: 1 = muy en desacuerdo / muy difícil; 5 = muy de acuerdo / muy fácil.

| Participante | P1. Iniciar reporte | P2. Completar reporte | P3. Consultar mapa | P4. Denunciar reporte | P5. Duda o detención | P6. Cambio prioritario |
|---|---:|---:|---:|---:|---|---|
| U01 | 5 | 5 | 4 | 5 | No | Hacer más visible cómo llegar al mapa. |
| U02 | 5 | 5 | 3 | 4 | No | El mapa, sin duda. |
| U03 | 3 | 4 | 1 | 1 | Después del reporte no supo cómo llegar al mapa. | Al terminar el reporte, dirigir directamente al mapa. |

## Registro de resultados y hallazgos

Al terminar todas las sesiones, consolidar una línea por participante y no
ocultar los abandonos, bloqueos ni fallas.

| Participante | TC-UAT-01 <300 s | TC-UAT-02 | TC-UAT-03 | Encuesta completada | Hallazgo/INC | Estado |
|---|---|---|---|---|---|---|
| U01 | pasó; 76.15 s | pasó; 18 s | pasó; 47 s | sí | El acceso al mapa debe ser más visible | tareas completadas |
| U02 | pasó; 123.43 s | pasó; 29 s | pasó; 65 s | sí | Mapa es el cambio prioritario; necesitó ayuda mínima para ubicar y denunciar el reporte | tareas completadas |
| U03 | pasó; 10 s | falló; 300 s; reejecución pasó; 176 s | pasó; 112.12 s | sí | INC-3: la reejecución completó el mapa, aunque con dificultad | tareas completadas; conservar hallazgo de usabilidad |
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
