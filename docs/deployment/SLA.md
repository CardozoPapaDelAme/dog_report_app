# Acuerdo de nivel de servicio (SLA)

Estado: vigente para la Fase 1 desde el 2026-10-24, con mediciones sobre staging.
Guía de la tarea: [`docs/deployment/BACKLOG.md`](/docs/deployment/BACKLOG.md), D4.

Sistema en Fase 1 sobre Supabase managed Free: el proveedor no ofrece SLA en este
plan. Los compromisos de este documento son del equipo, con las exclusiones
indicadas (RNF01: el 99.9 % es meta futura).

Un SLA (acuerdo de nivel de servicio) dice, con números, qué calidad de servicio se
compromete a dar el equipo a la Asociación de Hoteles de Chihuahua: qué tan rápido
responde, cuánto tiempo está disponible, cuántas personas lo pueden usar a la vez,
cómo se cuidan los datos y qué pasa si algo falla. Cada compromiso indica cómo se
mide y con qué evidencia.

## Resumen

| Compromiso | Objetivo | Medición | Evidencia |
|---|---|---|---|
| Tiempo de respuesta de funciones críticas | API: p95 ≤ 3,000 ms; mapa visible < 5,000 ms; envío de reporte < 5,000 ms | k6, `npm run smoke` (también cada 15 min en el monitor programado), logs de la Function | Sección 1: p95 de lecturas 648–1,095 ms; mapa 3,800 ms; envío 2,380 ms |
| Disponibilidad | 80 % mensual (≈ 292 días/año) | Monitor programado (GitHub Actions) cada 15 min | Sección 2: monitor activo desde el 2026-10-24, primera corrida correcta; 0.05 % de respuestas `5xx` en 24 h |
| Capacidad | 25 usuarios simultáneos sin errores | k6 con usuarios virtuales | Sección 3: 733/733 correctas con 25 usuarios, p95 2,143 ms (tras corregir INC-4) |
| Privacidad | No se almacenan datos personales del reportero | Revisión del diseño y del esquema | Sección 4 |
| Respaldo | Cada 7 días | Registro de exportaciones | Sección 5: exportación completa y restauración ensayada el 2026-10-24 (≈ 3 min) |
| Respuesta a incidentes | Primera respuesta ≤ 24 horas | Registro de incidentes | Sección 6 |

## 1. Tiempo de respuesta de funciones críticas

Fuentes: `docs/testing/NON-FUNCTIONAL.md` (TC-NF-02, TC-NF-03),
`tests/load/public-read.js`.

**Funciones críticas** (las que un usuario espera ver responder):

| Función | Cómo se mide | Medido | Objetivo | Cumple |
|---|---|---|---|---|
| Cargar el mapa (clusters) en la app | Cronómetro en el simulador, abrir Mapa hasta ver clusters (TC-NF-02, RUN-135) | 3,800 ms | < 5,000 ms (RNF02) | Sí |
| Enviar un reporte sin foto | Cronómetro en el simulador hasta la confirmación (TC-NF-02, RUN-136) | 2,380 ms | < 5,000 ms | Sí |
| `GET /public/clusters` (API) | `npm run smoke`, 2026-10-24, 3 corridas | 430–455 ms | p95 ≤ 3,000 ms | Sí |
| `GET /public/reports` (API) | `npm run smoke`, 2026-10-24 | 428–1,044 ms | p95 ≤ 3,000 ms | Sí |
| `GET /health` (API + base) | `npm run smoke`, 2026-10-24 | 255–896 ms (896 = arranque en frío) | p95 ≤ 3,000 ms | Sí |
| Lecturas públicas con 2 usuarios | k6, 60 s, 2026-10-24 08:00 UTC | mediana 429 ms, p90 454 ms, p95 648 ms, máx. 1,072 ms | p95 ≤ 3,000 ms | Sí |
| Todas las peticiones reales de la API | Logs de la Function, 24 h hasta 2026-10-24 07:58 UTC (5,909 peticiones) | tiempo de ejecución p50 515 ms, p95 1,095 ms | p95 ≤ 3,000 ms | Sí |
| Inicio de sesión del personal | — | **Sin medir:** requiere credenciales de una cuenta real de personal, que no se usan para pruebas automáticas | p95 ≤ 3,000 ms | — |

**Objetivo comprometido:** el 95 % de las peticiones a la API responde en 3,000 ms o
menos, y el mapa y el envío de un reporte se completan en menos de 5 segundos. Se
eligió 3,000 ms porque lo medido (p95 ≈ 1,100 ms) deja margen para la red celular de
Creel y para los arranques en frío de la Function.

**Exclusiones:** el primer acceso tras un periodo sin uso (arranque en frío), la red
del teléfono del usuario.

## 2. Disponibilidad

Fuentes: `docs/deployment/MONITORING.md`, `docs/DEPLOYMENT.md`.

- **Métrica:** porcentaje del mes en que `GET /functions/v1/api/health` responde
  correctamente: porcentaje de corridas correctas del monitor programado de GitHub
  Actions, que la revisa cada 15 minutos.
- **Objetivo:** **80 % mensual**, equivalente a unos 292 días al año (≈ 144 horas de
  caída permitidas por mes de 30 días). Es una meta de "mejor esfuerzo" coherente con
  RNF01: el 99.9 % queda como meta futura con un plan de pago.
- **Evidencia hoy:** en las últimas 24 h solo 3 de 5,909 peticiones (0.05 %)
  respondieron `5xx`; la validación de infraestructura pasó
  (`docs/deployment/INFRA-VALIDATION.md`). El monitor programado está activo desde
  el 2026-10-24 (primera corrida correcta); el porcentaje mensual se calcula con su
  historial de corridas en GitHub Actions.
- **Exclusiones:** pausa del proyecto por inactividad del plan Free, mantenimientos e
  incidentes del proveedor (`https://status.supabase.com`), y ventanas de despliegue
  avisadas con 24 h de anticipación.

## 3. Capacidad

- **Métrica:** usuarios simultáneos con 0 % de errores en lecturas públicas (mapa),
  medidos con k6 contra staging (`tests/load/public-read.js`, solo lecturas, una
  petición por segundo por usuario).

| Fecha (UTC) | Usuarios virtuales | Peticiones | Errores | p95 | Resultado |
|---|---|---|---|---|---|
| 2026-10-12 (RUN-145) | 2 | 83 | 0 % | 1,070 ms | Pasó |
| 2026-10-24 08:00 | 2 | 89 | 0 % | 648 ms | Pasó |
| 2026-10-24 08:01 | 5 | 9 | 67 % | 60,000 ms (tiempo límite) | Falló (INC-4) |
| 2026-10-24 07:50 | 10 | 33 | 36 % | 60,000 ms (tiempo límite) | Falló (INC-4) |
| 2026-10-24 07:51 | 25 | 206 | 12 % | 60,000 ms (tiempo límite) | Falló (INC-4) |
| 2026-10-24 08:23 (con la corrección de INC-4) | 2 | 91 | 0 % | 449 ms | Pasó |
| 2026-10-24 08:24 (con la corrección) | 5 | 200 | 0 % | 1,053 ms | Pasó |
| 2026-10-24 08:25 (con la corrección) | 10 | 326 | 0 % | 1,800 ms | Pasó |
| 2026-10-24 08:26 (con la corrección) | 25 | 733 | 0 % | 2,143 ms | Pasó |

- **Objetivo comprometido:** **25 usuarios simultáneos** con 0 % de errores y p95 ≤
  3,000 ms, que es lo demostrado tras corregir INC-4 (PR #91). Las primeras corridas
  con 5 a 25 usuarios fallaron por INC-4 y se conservan en la tabla como evidencia.
- **Más allá de 25:** sin medir; se prueba antes de una temporada alta de turismo,
  cuidando la cuota de invocaciones.
- **Límites del plan Free** que acotan la capacidad: 500k invocaciones al mes (hoy se
  proyectan ≈ 177k), 500 MB de base (21 MB usados), 1 GB de Storage (10 MB usados),
  5 GB de egress y 60 conexiones a PostgreSQL (12 en uso).

## 4. Privacidad

Fuentes: `docs/SECURITY.md` ("Anonymous integrity and privacy", "Location
privacy"), RF02 y RNF13 en `docs/product/ETAPA1-REQUERIMIENTOS-V2.md`.

**Compromiso: no se almacenan datos personales del reportero público.**

| Medida | Cómo se cumple |
|---|---|
| Sin cuenta | El público reporta sin registrarse; el registro público está deshabilitado (`422 signup_disabled`, verificado el 2026-10-24). |
| No se piden datos de contacto | El formulario no solicita nombre, correo, teléfono ni identificador. |
| Sin EXIF | Los metadatos de la foto (incluida la ubicación GPS del archivo) se procesan solo de paso y nunca se guardan; la foto pública es una versión limpia. |
| Ubicación aproximada | El mapa público muestra la posición redondeada a una cuadrícula de 50 m, igual para todos. |
| Huella del dispositivo | Se guarda solo como hash para frenar abusos y se borra a los 30 días. |
| Fotos privadas | El bucket `approved-photos` es privado (`public=false`) y las fotos solo se entregan tras autorización. |
| Personal | Las cuentas de la Asociación y del Administrator se protegen conforme a la LFPDPPP (RNF13). |

**Exclusión:** texto libre o fotos en los que el propio reportero incluya datos de
terceros; para eso existen la denuncia de reportes y la moderación del Administrator.

## 5. Respaldo

Fuentes: `docs/deployment/BACKUP-LOG.md`, RNF14 y RNF18.

- **Compromiso:** una exportación completa **cada 7 días** (base de datos: roles,
  esquema y datos; y las fotos privadas con manifiesto y SHA-256), guardada cifrada
  fuera del repositorio y de Supabase, porque el plan Free no incluye respaldos
  automáticos (RNF18).
- **RPO del prototipo** (cuántos datos se pueden perder como máximo): 7 días.
  **RTO del prototipo** (cuánto tarda volver a operar): ≈ 3 minutos para la base y
  las fotos en un proyecto nuevo (ensayo del 2026-10-24), más unos 5 minutos para
  desplegar la Function y sus secretos; menos de 15 minutos en total.
- **Producción** exige RPO ≤ 24 h y RTO ≤ 4 h demostrados (RNF14); requiere
  respaldos diarios o un plan de pago, y no se ha demostrado.
- **Evidencia:** calendario y registro en `docs/deployment/BACKUP-LOG.md`. La
  primera exportación completa se hizo el 2026-10-24 en unos 3 minutos: roles,
  esquema, datos y las 18 fotos, con conteos y tamaños iguales a la base. La
  restauración se ensayó el mismo día en un proyecto aislado: datos y fotos idénticos
  al origen. Falta cifrar las copias.

## 6. Respuesta a incidentes

Fuentes: `docs/testing/INCIDENTS.md` (severidades), `docs/DEPLOYMENT.md`
("Incident priorities").

**Compromiso: todo incidente reportado recibe primera respuesta en 24 horas o
menos.** Primera respuesta es: confirmar el problema, asignar severidad y
responsable, y avisar a la Asociación si la afecta.

| Severidad | Primera respuesta | Solución objetivo | Ejemplo |
|---|---|---|---|
| Crítica | ≤ 4 h | ≤ 24 h | Exposición de datos o credenciales; el sistema completo no responde. |
| Alta | ≤ 8 h | ≤ 3 días | Un flujo principal falla sin alternativa (INC-4: lecturas que no responden). |
| Media | ≤ 24 h | ≤ 7 días | Falla parcial con alternativa (INC-1: moderación). |
| Baja | ≤ 24 h | Siguiente versión | Defecto menor de presentación o documentación (INC-2). |

- **Canal:** la Asociación reporta al responsable técnico por el canal acordado con
  el equipo; las alertas automáticas llegan por correo desde GitHub cuando falla una corrida
  del monitor programado.
- **Horario:** días hábiles de 9:00 a 18:00 (hora de Chihuahua); fuera de ese horario
  el plazo empieza a contar el siguiente día hábil, salvo incidentes críticos.
- **Responsable de guardia:** el operador técnico del equipo; registro y seguimiento
  con la plantilla de `docs/testing/INCIDENTS.md`.

## Vigencia y revisión

- **Vigencia:** Fase 1 (prototipo en staging y primera operación), desde el
  2026-10-24 hasta el paso a producción o un cambio de plan del proveedor.
- **Revisión:** mensual por el equipo, con el historial del monitor programado, los dashboards
  de Supabase y el registro de incidentes; y obligatoria antes de producción (para
  RPO/RTO).
