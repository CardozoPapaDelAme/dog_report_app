# Backlog de pruebas — Etapa 4 (Pruebas)

Este archivo es la **fuente de verdad** del trabajo de pruebas de la Etapa 4.
Cubre **todo el repositorio**: documenta las pruebas que ya existen y define lo
que falta. El Google Docs del entregable solo resume y enlaza a los archivos de
`docs/testing/`.

## Cómo usar este backlog

- **Personas:** P1–P5. El equipo decide quién es quién; el backlog no lleva nombres.
- **Jira:** cada tarea tiene un ID fijo (`T1`…`T14`) y un campo `Jira:` que se
  llena al crear el ticket (ej. `TD-120`). El ticket copia el título, objetivo,
  alcance y criterios de aceptación de la tarea.
- **Ramas:** se nombran con la clave de Jira (`TD-120-...`), como el resto del
  repo. Un agente que trabaje en esa rama busca la clave en este archivo y
  resuelve exactamente esa tarea.
- **Estado:** `pendiente` → `en curso` → `hecho`. Una tarea pasa a `hecho` solo
  con su PR fusionado y sus criterios de aceptación cumplidos; el PR se anota
  como evidencia.
- **Regla del test log:** una tarea que ejecuta casos (T5–T9, T14) no pasa a
  `hecho` hasta que sus ejecuciones estén registradas en `docs/testing/TEST_LOG.md`.
  T10 la cumple con sus filas en la sección de la CI del test log (una por suite),
  no con filas por caso.
- **Regla de incidentes:** en cuanto un caso falla, la tarea que lo ejecutó abre el
  incidente (`INC-<n>`) en `docs/testing/INCIDENTS.md` y su ticket de bug en Jira,
  sin esperar a T11. Así las correcciones pueden fusionarse antes de la regresión
  final (T10).
- **Orden:** las fases van en orden. Dentro de una fase, las tareas pueden ir en
  paralelo si sus dependencias están en `hecho`.
- Abreviatura de rutas: **`B/`** = `supabase/functions/api/`.

## Asignación y creación de tickets en Jira

1. El equipo decide quién es cada persona y lo anota aquí (en un PR):

   | Persona | Integrante | Tareas |
   |---|---|---|
   | P1 | Fabián Fuentes | T1, T3, T4, T13 |
   | P2 | Juan Pablo De León Gómez | T2, T7, T10 |
   | P3 | Erick Herrera Luna | T5, T11 |
   | P4 | Alan Ruiz Silva | T6, T12, T14 |
   | P5 | Ricardo Becerra Bitar | T8, T9 |

2. Se crea **un ticket por tarea** (14 en total), en el orden de las fases:

   | Campo de Jira | Se llena con |
   |---|---|
   | Resumen | `T<n> · <título de la tarea>` (ej. `T5 · Casos funcionales A — Reportero público`) |
   | Descripción | Objetivo + Alcance de la tarea, más el enlace a este archivo |
   | Criterios de aceptación | La línea **Aceptación** de la tarea |
   | Responsable | El integrante asignado a su persona (P1–P5) |
   | Dependencias | Cada tarea de **Depende de** como enlace "bloqueado por" |

3. Se anota la clave de cada ticket en el campo `Jira:` de su tarea (en un PR),
   y las ramas se crean con esa clave (`TD-120-...`).

## Qué pide la entrega

Entregables: plan de pruebas; casos y datos de prueba; reporte con resumen y
resultados; reporte de incidentes.

Cómo los espera el profesor (adaptado a lo que ya tiene el repo):

| Entregable | Forma esperada | Archivo | Tarea |
|---|---|---|---|
| Plan de pruebas | Tabla Qué / Dónde / Cómo / Quién / Cuándo / Herramienta, una fila por nivel de prueba, más un diagrama de Gantt | `docs/testing/PLAN.md` | T3 |
| Casos de prueba | Tabla de entrada → resultado esperado (como "piedra, papel o tijera": cada combinación de entradas tiene su salida esperada) | `docs/testing/cases/` | T5, T6 (más T7–T9, T14) |
| Datos de prueba | Los inputs de los casos | `docs/testing/data/` | T5, T6 |
| Reporte con resumen y resultados | **Test log**: registro de cada ejecución de casos, más un resumen | `docs/testing/TEST_LOG.md` | T12 |
| Reporte de incidentes | Cada falla del test log se documenta y se abre un ticket de bug en Jira para arreglarla | `docs/testing/INCIDENTS.md` | T11 |

| Criterio de la rúbrica | Puntos |
|---|---|
| C1 Validación de requerimientos (incluye la visión del cliente y su negocio) | 25 |
| C2 Pruebas alfa y de regresión | 15 |
| C3 Pruebas dinámicas integradas al proceso de desarrollo | 15 |
| C4 Pruebas funcionales: mínimo, máximo, promedio y excepciones | 20 |
| C5 Inclusión de usuarios generales | 14 |
| C6 Pruebas no funcionales | 11 |

## Punto de partida (verificado el 2026-10-07)

- 95 archivos de test con ~435 casos automatizados: unitarias del móvil
  (Deno y `node:test`), UI con Playwright (`tests/ui/`), backend con Deno
  (`B/`) y suites opcionales de PostgreSQL/PostGIS (`B/tests/`).
- No hay CI: no existe `.github/`, ni hooks, ni un comando que corra todo.
- No hay pruebas en dispositivo, ni con usuarios, ni de rendimiento o carga.
- `docs/TESTING.md` es una estrategia, no un plan formal. `docs/TRACEABILITY.md`
  cita 12 nombres de archivo de test que no existen (ver T4).
- Requerimientos: RF01–RF24, RNF01–RNF36 y HU-01–HU-24 (cada HU-nn corresponde
  al RF-nn). `docs/product/APPROVED-CLARIFICATIONS.md` no retira ni agrega IDs.
- Historial: 12 commits `fix` de 197, fuente de incidentes históricos (T11).

### Comandos actuales

| Suite | Comando |
|---|---|
| Deno (móvil + backend) | `deno test --no-lock --config supabase/functions/api/deno.json models services controllers hooks i18n scripts supabase/functions/api` |
| Solo backend | `deno test --no-lock --config supabase/functions/api/deno.json supabase/functions/api` |
| `node:test` | `npm run test:auth` y `node --test models/associationWorkbook.test.js` |
| Playwright | `npx playwright install chromium`, luego `npx playwright test` |
| PostgreSQL (opcional) | Una base PostGIS local nueva por suite, vía `CONFIGURATION_TEST_DATABASE_URL`, `ZONE_TEST_DATABASE_URL`, `DUPLICATE_TEST_DATABASE_URL`, `FLAG_TEST_DATABASE_URL`, `PUBLIC_MAP_TEST_DATABASE_URL` (ver `docs/TESTING.md`) |
| Empaquetado | `CI=1 EXPO_NO_TELEMETRY=1 npx expo export --platform all` |

---

## Fase 1 — Arranque

### T1 · Convenciones y plantillas de pruebas
- **Persona:** P1 · **Estado:** pendiente · **Jira:** TD-114 · **Criterios:** base para todos
- **Depende de:** nada. **Bloquea:** T3, T4, T5, T6, T7, T8, T9 (T2 puede arrancar en paralelo).
- **Objetivo:** que todos documenten casos e incidentes con el mismo formato.
- **Alcance:**
  - Crear la estructura de `docs/testing/`: `PLAN.md`, `cases/`, `data/`,
    `ALPHA.md`, `UAT.md`, `ACCEPTANCE.md`, `NON-FUNCTIONAL.md`, `TEST_LOG.md`,
    `INCIDENTS.md`.
  - Formato de ID de caso: `TC-<módulo>-<n>` (ej. `TC-MAPA-03`).
  - Plantilla de caso (tabla de entrada → resultado esperado): ID, requerimiento(s),
    tipo (`mínimo`/`máximo`/`promedio`/`excepción`/`normal`), precondiciones, datos
    de entrada, pasos, resultado esperado, y test automatizado (archivo + nombre del
    test) o evidencia manual. El resultado obtenido de cada ejecución va en el test log.
    Ejemplo (límites reales de `cantidad_aprox` para manada: 2–1000, verificados el
    2026-10-07 en `models/reportPayload.js`, función que valida `cantidad_aprox`; si
    el código cambia, actualizar el ejemplo): tamaño de manada (RF04) con entrada `1` → error; `2` → aceptado
    (mínimo); `500` → aceptado (promedio); `1000` → aceptado (máximo); `1001` → error
    (excepción).
  - Plantilla de test log (`TEST_LOG.md`), una fila por ejecución: fecha, ID de caso,
    ejecutado por, entorno (local, CI, dispositivo, staging), resultado
    (pasó/falló/bloqueado), incidente vinculado (`INC-<n>`) y notas. Todas las
    tareas que ejecutan casos agregan sus filas aquí.
  - Las corridas automáticas de la CI van en una sección aparte del test log, una
    fila por suite con fecha, suite, totales (pasaron/fallaron/omitidos) y enlace a
    la corrida. Solo se registran las corridas sobre `main` y la corrida final de
    T10; una corrida en rojo dentro de un PR en curso se corrige en ese mismo PR y
    no es incidente. Las fallas en `main` llevan su `INC-<n>`, que abre P2 (dueño
    de T2 y T10).
  - Regla de rutas: en `cases/`, `PLAN.md` y demás archivos de `docs/testing/`
    (salvo este backlog) escribir siempre la ruta completa desde la raíz del repo
    (`supabase/functions/api/...`), nunca la abreviatura `B/`.
  - Plantilla de incidente: ID `INC-<n>`, fecha, caso y fila del test log que lo
    originó, severidad (crítica/alta/media/baja), módulo, pasos para reproducir,
    esperado vs. obtenido, ticket de bug en Jira, estado, solución, commit o PR.
- **Aceptación:** plantillas y estructura en el repo, aprobadas en un PR.

### T2 · Integración continua y comando único de la suite completa
- **Persona:** P2 · **Estado:** hecho · **Jira:** TD-115 · **Criterios:** C3, C2
- **PR (evidencia):** [#56](https://github.com/CardozoPapaDelAme/dog_report_app/pull/56) — CI en verde, 4 min facturables por corrida.
- **Depende de:** nada.
- **Objetivo:** que **todas** las pruebas existentes corran solas en cada PR.
- **Alcance:**
  - Script `npm test` que corra Deno (móvil + backend), los archivos `node:test` y Playwright.
  - Flujo `.github/workflows/tests.yml` en cada PR y en `main`: instalar dependencias,
    Deno, Chromium de Playwright, correr `npm test` y publicar el reporte de Playwright.
  - Si se puede: suites PostgreSQL con un servicio PostGIS dentro de la CI. Si no,
    documentar por qué quedan como manuales.
  - El repo es privado: anotar en el PR los minutos de Actions por corrida.
  - Sin secretos en la CI: las pruebas usan datos y servicios simulados.
- **Aceptación:** un PR muestra la CI en verde con los totales **por suite**
  (incluidas las de PostgreSQL si corren en la CI); `npm test` en local da el mismo
  resultado que la CI en las suites que no necesitan base de datos.

### T3 · Plan de pruebas del sistema completo
- **Persona:** P1 · **Estado:** pendiente · **Jira:** TD-116 · **Criterios:** C1 · **Entregable:** Plan de pruebas
- **Depende de:** T1.
- **Objetivo:** el plan formal que pide la entrega.
- **Alcance (`docs/testing/PLAN.md`):**
  - **Tabla del plan** (formato del profesor, adaptado a lo que ya usamos). Las
    fechas de "Cuándo" son las del plan del profesor (2026); las filas que él no
    incluyó quedan para que el equipo las defina:

    | Qué | Dónde | Cómo | Quién | Cuándo | Herramienta |
    |---|---|---|---|---|---|
    | Pruebas unitarias | FE: modelos, servicios y hooks · BE: dominio y servicios | Automatizada | Developers | 10 sep – 9 oct | Deno test, `node:test` |
    | Pruebas de integración | BE: endpoints (controladores Hono vía HTTP) y base de datos (suites PostgreSQL/PostGIS) | Automatizada | Developers | 10 sep – 9 oct | Deno test (equivalente a SuperTest), PostGIS |
    | Pruebas de sistema | FE: UI | Automatizada + manual con casos de prueba (alfa en dispositivo) | QA | 6 oct – 10 oct | Playwright, casos de prueba |
    | Pruebas de regresión | Todo el repo | Automatizada en cada PR | CI | Continua | GitHub Actions (`npm test`) |
    | Pruebas de carga | BE: endpoints públicos | Automatizada | QA | 6 oct – 10 oct | k6 |
    | Otras no funcionales | FE y BE: rendimiento, compatibilidad, accesibilidad, seguridad | Mixta | QA | _por definir_ | Cronómetro en dispositivo, TalkBack, tests existentes |
    | Pruebas con usuarios | FE: UI | Manual | Usuarios generales | _por definir_ | Guion de tareas, encuesta |
    | Pruebas de aceptación | FE: UI | Manual | Socio formador | 15 oct | Casos de prueba |

  - Indicar qué personas (P1–P5) cumplen los roles Developers y QA.
  - **Diagrama de Gantt** con las fases y niveles, como bloque `mermaid` de tipo
    `gantt` (GitHub lo dibuja). Punto de partida con las fechas del profesor; agregar
    las filas que el equipo defina:

    ```mermaid
    gantt
      title Plan de pruebas
      dateFormat YYYY-MM-DD
      axisFormat %d %b
      section Developers
      Pruebas unitarias      :2026-09-10, 2026-10-09
      Pruebas de integración :2026-09-10, 2026-10-09
      section QA
      Pruebas de sistema     :2026-10-06, 2026-10-10
      Pruebas de carga       :2026-10-06, 2026-10-10
      section Socio formador
      Pruebas de aceptación  :2026-10-15, 1d
    ```
  - Breve: alcance y fuera de alcance, entornos (local, CI, staging, dispositivo),
    criterios de entrada y salida, y riesgos. Tomar como base `docs/TESTING.md`
    sin duplicarlo.
- **Aceptación:** la tabla tiene todas las filas con su "Cuándo" lleno, el Gantt
  está incluido, y el plan está aprobado en un PR y enlazado desde `docs/TESTING.md`.

---

## Fase 2 — Ejecución

### T4 · Matriz de trazabilidad completa
- **Persona:** P1 · **Estado:** pendiente · **Jira:** TD-117 · **Criterios:** C1
- **Depende de:** T1, T2 (la comprobación de rutas se suma a `npm test` y corre en la CI).
- **Objetivo:** demostrar que cada requerimiento se valida, incluyendo la visión
  del cliente y del negocio.
- **Alcance:**
  - Mapear los 24 RF, 36 RNF y 24 HU → casos (`TC-...`) → tests o evidencias.
  - Por cada HU, anotar el valor para el cliente/negocio que valida (Asociación de
    Hoteles de Chihuahua, reportero público, Administrator).
  - Corregir en `docs/TRACEABILITY.md` estos nombres que no existen:

    | Líneas | Citado | Real |
    |---|---|---|
    | 148, 151, 160 | `controllers/configuration-controller.test.js` | `B/controllers/configurationController.test.js` |
    | 150, 151 | `services/configuration-service.test.js` | `B/services/configurationService.test.js` |
    | 166 | `tests/identity-configuration.test.js` | `B/tests/identityConfiguration.test.js` |
    | 193 | `domain/zone-set.test.js` | `B/domain/zoneSet.test.js` |
    | 193, 194 | `services/zone-service.test.js` | `B/services/zoneService.test.js` |
    | 194 | `controllers/zone-controller.test.js` | `B/controllers/zoneController.test.js` |
    | 221 | `domain/duplicate-group.test.js` | `B/domain/duplicateGroup.test.js` |
    | 221 | `services/duplicate-service.test.js` | `B/services/duplicateService.test.js` |
    | 222 | `controllers/duplicate-controller.test.js` | `B/controllers/duplicateController.test.js` |
    | 249 | `B/controllers/report-controller.test.js` | `B/controllers/reportController.test.js` |
    | 250, 254 | `B/services/report-service.test.js` | `B/services/reportService.test.js` |
    | 251 | `B/services/trust-service.test.js` | `B/services/trustService.test.js` |

    Corregir también los archivos fuente: líneas 152, 195 y 223
    (`*-repository.js` → `B/repositories/configurationRepository.js`,
    `zoneRepository.js`, `duplicateRepository.js`) y línea 195
    (`domain/zone-set.js` → `B/domain/zoneSet.js`). Los archivos `flag-*` sí
    llevan guion en disco y no se cambian.
  - Los números de línea de la tabla son de referencia (2026-10-07) y pueden
    moverse; ubicar cada cita por el nombre del archivo.
  - Agregar a la matriz los tests de RF03, RF19 y RF20 que existen pero no están listados.
  - Agregar una comprobación automática (script o test) que falle si
    `docs/TRACEABILITY.md` o cualquier archivo de `docs/testing/` cita una ruta de
    archivo que no existe, y sumarla a `npm test` (T2) para que corra en la CI.
    Excluir este `BACKLOG.md`: cita a propósito nombres incorrectos (columna
    "Citado") y usa la abreviatura `B/`.
  - Todas las rutas se resuelven **desde la raíz del repositorio**. Al corregir
    `docs/TRACEABILITY.md`, escribir la ruta completa
    (`supabase/functions/api/controllers/reportController.test.js`), no la forma
    abreviada de la columna "Real" (`B/` es solo una abreviatura de este backlog)
    ni rutas relativas al backend sin prefijo.
- **Aceptación:** cada RF, RNF y HU tiene caso + test/evidencia, o está marcado
  "sin cubrir" con justificación; la comprobación automática de rutas pasa en la CI.

### T5 · Casos funcionales A — Reportero público
- **Persona:** P3 · **Estado:** pendiente · **Jira:** TD-118 · **Criterios:** C4, C1 · **Entregable:** Casos y datos
- **Depende de:** T1, T2 (los tests nuevos deben pasar en la CI), T7 (evidencia en
  dispositivo para cerrar RF09, RF22, RNF08 y RNF12).
- **Requerimientos:** RF01–RF09, RF22, RF24 (y sus HU); RNF08, RNF09 (solo el
  rechazo de reportes fuera de la zona activa; la administración de zonas es de T6),
  RNF10, RNF11, RNF12, RNF27, RNF28, RNF29, RNF32 (solo la respuesta `415`; el
  saneamiento es de T9), RNF36.
- **Objetivo:** cada funcionalidad del reportero probada en mínimo, máximo,
  promedio y excepción.
- **Alcance:**
  - Documentar como casos (`docs/testing/cases/reportero.md`) los tests existentes
    de la tabla de cobertura de abajo.
  - Agregar mínimo/máximo/promedio/excepción donde falte, con datos en `docs/testing/data/`.
  - **Tests nuevos obligatorios:**
    - RF02: aviso de no ingresar datos personales.
    - RF05: acceso rápido para reportar sin foto.
    - RF07: la cámara es la pantalla inicial.
    - RF04: casos límite de manada (mínimo 2, máximo 1000) explícitos.
    - RNF10: el EXIF crudo no se persiste.
    - RNF32: respuesta `415 unsupported_photo_type`.
    - RNF36: validación de `details` en PostgreSQL.
  - RF09, RF22, RNF08 y RNF12: los tests cubren la lógica con datos sintéticos o
    simulados; el modelo real, la detección de color con fotos reales y la cola sin
    conexión (modo avión y sincronización) solo se comprueban en dispositivo. Sus
    casos enlazan la evidencia que registra T7 (`docs/testing/ALPHA.md`).
- **Aceptación:** cada requerimiento listado tiene los 4 tipos de caso (o la
  justificación de por qué no aplica uno); los tests nuevos pasan en la CI; los casos
  de RF09, RF22, RNF08 y RNF12 enlazan su evidencia en dispositivo de T7; la
  ejecución de sus casos está registrada en `TEST_LOG.md`.

### T6 · Casos funcionales B — Mapa y roles autenticados
- **Persona:** P4 · **Estado:** pendiente · **Jira:** TD-119 · **Criterios:** C4, C1 · **Entregable:** Casos y datos
- **Depende de:** T1, T2 (los tests nuevos deben pasar en la CI).
- **Requerimientos:** RF10–RF21, RF23 (y sus HU), configuración y zonas
  (aclaración #5 sobre RF21/RF23/RNF09); RNF07, RNF09 (solo la administración de
  zonas: crear, aprobar y activar; el rechazo de reportes fuera de zona es de T5),
  RNF30, RNF33.
- **Objetivo:** igual que T5, para el mapa, la Asociación y el Administrator.
- **Alcance:**
  - Documentar como casos (`docs/testing/cases/mapa-y-roles.md`) los tests existentes
    de la tabla de cobertura.
  - Agregar mínimo/máximo/promedio/excepción donde falte, con datos en `docs/testing/data/`.
  - **Tests nuevos obligatorios:**
    - RF19: servicio de la cola de moderación en backend y una prueba de UI del Command Center.
    - RF12: tamaño de cluster en la UI (hoy solo se prueba el modelo).
- **Aceptación:** igual que T5: cada requerimiento listado tiene los 4 tipos de caso
  (o la justificación de por qué no aplica uno); los tests nuevos pasan en la CI; la
  ejecución de sus casos está registrada en `TEST_LOG.md`.

### T7 · Prueba alfa en dispositivo
- **Persona:** P2 · **Estado:** pendiente · **Jira:** TD-120 · **Criterios:** C2
- **Depende de:** T1.
- **Objetivo:** validar la app completa en un Android real antes de usuarios externos.
- **Alcance (`docs/testing/ALPHA.md`):** checklist del flujo completo: cámara →
  validación de foto y color (RF09, RF22, RNF08) → reporte → modo avión y
  sincronización (RNF12) → mapa y detalle → denuncia → login de Asociación y
  panel/exportación → login de Administrator y moderación/duplicados/configuración/zonas.
  Lo ejecuta el equipo; cada falla se registra en `INCIDENTS.md`.
- **Aceptación:** fecha, dispositivo y versión de Android, resultado por paso y
  capturas o video; las ejecuciones están en `TEST_LOG.md`.

### T8 · Pruebas con usuarios reales
- **Persona:** P5 · **Estado:** pendiente · **Jira:** TD-121 · **Criterios:** C5 · **Requerimientos:** RNF04
- **Depende de:** T1. Conviene hacerlo después de T7, pero no lo bloquea.
- **Objetivo:** incluir a usuarios generales en el proceso de prueba.
- **Alcance (`docs/testing/UAT.md`):** 3–5 participantes fuera del equipo;
  consentimiento; guion de tareas (hacer un reporte, consultar el mapa, denunciar
  un reporte); cronómetro por tarea (RNF04: reporte en menos de 5 min); encuesta
  corta; observaciones. Hallazgos a `INCIDENTS.md`.
- **Aceptación:** participantes anónimos, tiempos, resultados y hallazgos registrados;
  las ejecuciones están en `TEST_LOG.md`.

### T9 · Pruebas no funcionales
- **Persona:** P5 · **Estado:** pendiente · **Jira:** TD-122 · **Criterios:** C6
- **Depende de:** T1.
- **Requerimientos:** RNF01–RNF03, RNF05, RNF06, RNF13–RNF26, RNF31, RNF32
  (saneamiento), RNF34, RNF35.
- **Objetivo:** evidencia de cada RNF del sistema.
- **Alcance (`docs/testing/NON-FUNCTIONAL.md`):**
  - Documentar como evidencia las pruebas existentes: seguridad y permisos
    (RNF20, RNF21, RNF24, RNF31, RNF34), idiomas (RNF06), minimización de datos
    (RNF13), PostGIS (RNF19), fingerprint (RNF26), saneamiento (RNF32).
  - **Mediciones nuevas:** rendimiento en teléfono (RNF02: mapa en menos de 5 s;
    envío de reporte), tiempo de respuesta de la API, prueba de carga con **k6**
    sobre los endpoints públicos de lectura (RNF03), compatibilidad Android 8+ e iOS 13+ (RNF05; si no hay un iPhone disponible, registrar iOS como "sin cubrir" con justificación), accesibilidad con TalkBack.
  - **Prueba de carga con k6:** scripts en `tests/load/`. Solo endpoints públicos de
    lectura (`/health`, `/public/clusters`, `/public/reports`), nunca crear reportes
    ni denuncias. El proyecto de Supabase es el único que hay (staging, plan Free),
    así que la carga es ligera y corta (pocos usuarios virtuales, pocos minutos)
    para no agotar la cuota de 500k invocaciones; anotar la cantidad de peticiones.
    Registrar latencias (p95) y tasa de error.
  - **Verificación por inspección** (no son tests de código): RNF01, RNF14–RNF18,
    RNF22, RNF23, RNF25 (el monitor de disponibilidad está planeado aparte; si se implementa, enlazarlo aquí).
    Escaneo de que ningún secreto llega al bundle móvil (RNF24).
  - RNF35 (embeddings futuros): fuera de alcance de la Fase 1. Evidencia por
    inspección: confirmar que `db/schema.sql` y `supabase/migrations/` no usan
    `pgvector` ni columnas de embeddings, y citar el requerimiento o decisión que
    lo pospone.
- **Aceptación:** cada RNF listado tiene caso, medición o inspección, y resultado;
  las ejecuciones están en `TEST_LOG.md`.

---

## Fase 3 — Cierre

### T14 · Pruebas de aceptación con el socio formador
- **Persona:** P4 · **Estado:** pendiente · **Jira:** TD-127 · **Criterios:** C1 (visión del cliente)
- **Depende de:** T5, T6, T7 (el sistema ya probado por el equipo).
- **Objetivo:** que el cliente pruebe la app y confirme que cumple lo que pidió.
- **Alcance (`docs/testing/ACCEPTANCE.md`):**
  - Elegir los casos de aceptación: los flujos de las historias de usuario que le
    importan al socio formador (reportar, ver el mapa, panel y exportación de la
    Asociación, moderación).
  - Sesión con el socio formador en un teléfono con la app; él ejecuta los casos.
  - Registrar cada ejecución en `TEST_LOG.md`, sus comentarios y su conformidad
    (aceptado / aceptado con observaciones / rechazado). Fallas a `INCIDENTS.md`.
- **Aceptación:** casos de aceptación ejecutados por el socio formador, con su
  resultado y conformidad registrados; sus ejecuciones están en `TEST_LOG.md`.

### T10 · Corrida final de regresión
- **Persona:** P2 · **Estado:** pendiente · **Jira:** TD-123 · **Criterios:** C2, C3
- **Depende de:** T2, T4, T5, T6, T7, T8, T9, T14 (y las correcciones de sus incidentes
  ya fusionadas, para que la corrida cubra el código que se entrega).
- **Alcance:** correr la suite completa en la CI sobre `main` con todo integrado.
- **Aceptación:** enlace a la corrida en verde y totales por suite, anotados en `TEST_LOG.md`.

### T11 · Reporte de incidentes de todo el repo
- **Persona:** P3 · **Estado:** pendiente · **Jira:** TD-124 · **Entregable:** Reporte de incidentes
- **Depende de:** T5, T6, T7, T8, T9, T10, T14 (reúne lo que registran, incluida la
  corrida final).
- **Alcance (`docs/testing/INCIDENTS.md`):**
  - **Principal:** consolidar los incidentes que ya abrieron T5–T10 y T14 (regla de
    incidentes): revisar que cada fila del test log con resultado "falló" tenga su
    incidente y su **ticket de bug en Jira**, completar los que falten y dejar el
    reporte ordenado por severidad y estado.
  - **Anexo, históricos:** los 12 commits `fix` desde el inicio del proyecto hasta `49290b0`
    (`git log --oneline 49290b0 | grep -E '^[0-9a-f]+ fix([(: !]|$)'`; incluye
    `107f58f`, sin el formato `fix(...)`) y los PRs que los incluyen
    (`gh pr list --state merged --limit 200`).
  - Los `fix` posteriores a `49290b0` (correcciones de T5–T9) se registran como
    incidentes de esta etapa, no como históricos.
- **Aceptación:** toda falla del test log tiene su incidente y su ticket de bug en
  Jira; cada incidente con severidad, estado y el commit o PR que lo corrigió (o
  "abierto" con responsable).

### T12 · Test log con resumen y resultados
- **Persona:** P4 · **Estado:** pendiente · **Jira:** TD-125 · **Entregable:** Reporte con resumen y resultados
- **Depende de:** T4, T7, T8, T9, T10, T14 (resume sus resultados).
- **Alcance (`docs/testing/TEST_LOG.md`):**
  - Revisar que el registro de ejecuciones esté completo (cada caso ejecutado tiene
    su fila con fecha, quién, entorno y resultado) y que cada falla tenga su `INC-<n>`.
  - Arriba del registro, el **resumen**: totales de casos por módulo
    (pasaron/fallaron/bloqueados, como en las filas por caso) y totales por suite de
    la CI (pasaron/fallaron/omitidos, como en la sección de la CI), cobertura por requerimiento (de T4), resultados
    de alfa (T7), usuarios (T8), no funcionales y carga (T9) y aceptación (T14);
    conclusiones y pendientes.
- **Aceptación:** los números del resumen coinciden con el registro y con la corrida de T10.

### T13 · Google Docs del entregable
- **Persona:** P1 · **Estado:** pendiente · **Jira:** TD-126 · **Criterios:** todos
- **Depende de:** T3, T11, T12.
- **Alcance:** sintetizar los 4 entregables (plan, casos y datos, resultados,
  incidentes) con enlaces a `docs/testing/`, PRs y corridas de la CI.
- **Aceptación:** cada criterio de la rúbrica tiene su sección con evidencia enlazada.

---

## Tablas de control (nada sin dueño)

### Rúbrica → tareas

| Criterio | Tareas |
|---|---|
| C1 Validación de requerimientos | T3, T4, T5, T6, T14 |
| C2 Alfa y regresión | T2, T7, T10 |
| C3 Pruebas dinámicas | T2, T10 |
| C4 Funcionales mín/máx/promedio/excepción | T5, T6 |
| C5 Usuarios generales | T8 |
| C6 No funcionales | T9 |

### Entregables → tareas

| Entregable | Archivo | Tareas |
|---|---|---|
| Plan de pruebas (tabla + Gantt) | `docs/testing/PLAN.md` | T3 |
| Casos y datos de prueba | `docs/testing/cases/`, `docs/testing/data/` | T5, T6 (más T7–T9, T14) |
| Reporte con resumen y resultados (test log) | `docs/testing/TEST_LOG.md` | T12 (con las filas de T5–T10 y T14) |
| Reporte de incidentes (con tickets de bug en Jira) | `docs/testing/INCIDENTS.md` | T11 |

### Requerimientos → tarea responsable

T4 traza **todos** los IDs; esta tabla dice qué tarea los **prueba**.

| ID (HU-nn = RF-nn) | Nombre | Tarea | Tests existentes (verificados) |
|---|---|---|---|
| RF01 | Reporte anónimo sin cuenta, offline | T5 | `B/controllers/reportController.test.js`, `B/services/reportService.test.js`, `B/repositories/reportRepository.test.js`, `services/reportApi.test.js`, `models/reportDraft.test.js`, `hooks/reportDraftQueueController.test.js`, `tests/ui/reportForm.spec.js` |
| RF02 | Sin datos personales del reportante | T5 | Parcial: `models/reportPayload.test.js`, `B/controllers/reportController.test.js`. Falta el aviso |
| RF03 | Foto opcional única, reporte primero | T5 | `B/controllers/photoController.test.js`, `B/services/photoService.test.js`, `B/domain/photoImage.test.js`, `B/repositories/storageRepository.test.js`, `hooks/useReportPhotoUpload.test.js`, `models/photoState.test.js`, `services/reportApi.test.js` |
| RF04 | Perro solitario o manada | T5 | `models/reportPayload.test.js`, `tests/ui/reportForm.spec.js` |
| RF05 | Acceso rápido sin foto | T5 | Ninguno dedicado |
| RF06 | Categoría de incidente | T5 | `B/controllers/reportController.test.js`, `models/reportPayload.test.js`, `tests/ui/reportForm.spec.js` |
| RF07 | Cámara como pantalla inicial | T5 | Ninguno |
| RF08 | Denuncia pública de reporte | T5 | `B/controllers/flag-controller.test.js`, `B/services/flag-service.test.js`, `B/tests/flag-postgres.test.js`, `hooks/reportFlagSubmit.test.js`, `hooks/zoneReports.test.js`, `services/flagApi.test.js`, `models/reportFlag.test.js`, `tests/ui/publicMap.spec.js` |
| RF09 | Validación offline de foto | T5 | `services/photoInference.test.js`, `services/photoPixels.test.js`, `services/photoValidationFlow.test.js`, `models/photoValidation.test.js`, `B/services/photoService.test.js` |
| RF10 | Mapa público aproximado 50 m | T6 | `B/controllers/publicMapController.test.js`, `B/services/publicMapService.test.js`, `B/repositories/publicMapRepository.test.js`, `B/tests/publicMapPostgres.test.js`, `models/publicMap.test.js`, `services/publicMapApi.test.js`, `hooks/publicMapLoader.test.js`, `tests/ui/publicMap.spec.js` |
| RF11 | Agrupación en clusters | T6 | Mismos que RF10 |
| RF12 | Tamaño de cluster proporcional | T6 | `models/publicMap.test.js` |
| RF13 | Severidad máxima y conteos | T6 | `models/publicMap.test.js`, `tests/ui/publicMap.spec.js`, `B/services/publicMapService.test.js`, `B/tests/publicMapPostgres.test.js` |
| RF14 | Zoom progresivo hasta pines | T6 | Mismos que RF10 |
| RF15 | Cuentas provisionadas de Asociación | T6 | `controllers/loginController.test.js`, `services/authService.test.js`, `services/secureSessionStorage.test.js`, `models/session.test.js`, `tests/ui/login.spec.js`, `B/routes/identityRoutes.test.js`, `B/controllers/identityController.test.js`, `B/services/identityService.test.js` |
| RF16 | Estadísticas de Asociación | T6 | `B/controllers/associationController.test.js`, `B/services/associationService.test.js`, `B/repositories/associationReportRepository.test.js`, `models/associationSummary.test.js`, `hooks/associationReportLoader.test.js`, `tests/ui/associationDashboard.spec.js` |
| RF17 | Exportación CSV/Excel | T6 | `models/associationWorkbook.test.js`, `models/associationReport.test.js`, `tests/ui/associationDashboard.spec.js` |
| RF18 | Login de Administrator | T6 | Mismos que RF15, más `B/tests/identityConfiguration.test.js` |
| RF19 | Cola y contexto de moderación | T6 | `models/moderation.test.js`, `services/moderationApi.test.js`. Falta backend y UI |
| RF20 | Ocultar o eliminar lógicamente, auditado | T6 | `B/controllers/moderationController.test.js`, `B/domain/reportModeration.test.js`, `models/moderation.test.js`, `B/services/retentionService.test.js` |
| RF21 | Auto-ocultamiento por denuncias | T6 | `B/services/flag-service.test.js`, `B/tests/flag-postgres.test.js`, `B/domain/reportModeration.test.js`, `B/domain/configuration.test.js` |
| RF22 | Color automático, tamaño y collar | T5 | `models/dogColor.test.js`, `services/photoColorFlow.test.js`, `models/reportPayload.test.js`, `tests/ui/reportForm.spec.js` |
| RF23 | Resolución manual de duplicados | T6 | `B/domain/duplicateGroup.test.js`, `B/services/duplicateService.test.js`, `B/controllers/duplicateController.test.js`, `B/tests/duplicatePostgres.test.js`, `models/duplicateCandidate.test.js`, `services/duplicateApi.test.js`, `tests/ui/duplicateManagement.spec.js` |
| RF24 | Formulario dinámico con `details` | T5 | `B/controllers/reportController.test.js`, `models/reportPayload.test.js`, `tests/ui/reportForm.spec.js` |
| Config. y zonas | Aclaración #5 | T6 | `models/configuration.test.js`, `tests/ui/configuration.spec.js`, `B/services/configurationService.test.js`, `B/tests/configurationPostgres.test.js`, `models/zoneSet.test.js`, `tests/ui/zoneSet.spec.js`, `B/services/zoneService.test.js`, `B/tests/zonePostgres.test.js` |

| RNF | Tarea | RNF | Tarea | RNF | Tarea |
|---|---|---|---|---|---|
| RNF01 Disponibilidad | T9 | RNF13 Minimización de datos | T9 | RNF25 Monitoreo | T9 |
| RNF02 Mapa < 5 s | T9 | RNF14 Respaldos RPO/RTO | T9 | RNF26 Fingerprint hash 30 días | T9 |
| RNF03 Escalabilidad | T9 | RNF15 Supabase Free | T9 | RNF27 Honeypots | T5 |
| RNF04 Reporte < 5 min | T8 | RNF16 HTTPS/TLS | T9 | RNF28 Confianza versionada | T5 |
| RNF05 Android 8+/iOS 13+ | T9 | RNF17 Sin SSH | T9 | RNF29 Integridad de denuncias | T5 |
| RNF06 Bilingüe | T9 | RNF18 Restauración aislada | T9 | RNF30 Duplicados sugeridos | T6 |
| RNF07 Roles hermanos | T6 | RNF19 PostgreSQL/PostGIS | T9 | RNF31 Límites de tasa | T9 |
| RNF08 Modelo on-device | T5 | RNF20 RLS y privilegios | T9 | RNF32 Saneamiento, 415 | T9 (415 en T5) |
| RNF09 Geofence obligatorio | T5 (rechazo fuera de zona) · T6 (administración de zonas) | RNF21 API Hono, SQL parametrizado | T9 | RNF33 Auditoría append-only | T6 |
| RNF10 Sin EXIF crudo | T5 | RNF22 Sin gateway propio | T9 | RNF34 JWT corto | T9 |
| RNF11 Atributos estructurados | T5 | RNF23 Frontera Supabase | T9 | RNF35 Embeddings futuros | T9 |
| RNF12 Cola local idempotente | T5 | RNF24 Secretos fuera del móvil | T9 | RNF36 Validación JSON en PG | T5 |

La asignación de personas a tareas está en [Asignación y creación de tickets en Jira](#asignación-y-creación-de-tickets-en-jira).
