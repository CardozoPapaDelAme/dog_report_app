# Convenciones y plantillas de pruebas

Base documental de T1 / TD-114 para todo el equipo. El alcance y los responsables
están en [docs/testing/BACKLOG.md](docs/testing/BACKLOG.md). Los enlaces de estos
archivos se escriben desde la raíz del repositorio; al navegar en GitHub, resolver
esas rutas desde la raíz, no desde el directorio del documento.

## Estructura y responsables

| Archivo o directorio | Uso | Tarea que lo completa |
|---|---|---|
| `docs/testing/PLAN.md` | Plan y calendario | T3 |
| `docs/testing/cases/` | Casos: entrada → resultado esperado | T5, T6, T7, T8, T9, T14 |
| `docs/testing/data/` | Datos reproducibles de los casos | T5, T6 |
| `docs/testing/ALPHA.md` | Alfa en dispositivo | T7 |
| `docs/testing/UAT.md` | Usuarios generales | T8 |
| `docs/testing/ACCEPTANCE.md` | Conformidad del socio formador | T14 |
| `docs/testing/NON-FUNCTIONAL.md` | Mediciones e inspecciones RNF | T9 |
| `docs/testing/TEST_LOG.md` | Ejecuciones y resumen | Cada ejecutor; T12 consolida |
| `docs/testing/INCIDENTS.md` | Fallas y correcciones | Cada ejecutor; T11 consolida |

T4 completa la trazabilidad en `docs/TRACEABILITY.md`; T13 reúne los entregables.
Estas plantillas no acreditan ejecución, cobertura, aprobación ni cierre de tareas.

## Identificadores

- Caso: `TC-<módulo>-<n>`, por ejemplo `TC-MAPA-03`. Módulo en mayúsculas,
  sin espacios ni acentos; número positivo con al menos dos dígitos. Usar módulos
  como REPORTE, MAPA, SESION, MODERACION, CONFIGURACION, ZONAS, DUPLICADOS,
  ALPHA, UAT, ACEPTACION y SEGURIDAD. Agregar otros cuando haga falta.
- El número es consecutivo dentro del módulo. Revisar los IDs existentes antes de
  asignarlo; no reutilizar ni renumerar casos retirados. Resolver colisiones en el PR.
- Incidente: `INC-<n>`, consecutivo global, por ejemplo `INC-1`; no reutilizarlo.
- Ejecución de caso: `RUN-<n>`; ejecución CI: `CI-<n>`. Son consecutivos globales
  en sus respectivas secciones y permiten referenciar una fila aunque se reordene.
- Conservar exactamente los IDs RF/RNF/HU de las fuentes: `RF04`, `RNF09`,
  `HU-04`. Indicar la aclaración aplicable sin inventar requerimientos nuevos.

## Casos y datos

Copiar `docs/testing/cases/TEMPLATE.md` a un archivo del módulo. Una fila describe
una combinación de entrada y su salida esperada. No registrar el resultado obtenido
como esperado: cada ejecución tiene su fila en `docs/testing/TEST_LOG.md`.

Tipos: `mínimo` (límite inferior válido), `máximo` (superior válido), `promedio`
(valor representativo intermedio, no una medición estadística), `excepción`
(entrada inválida o condición de error) y `normal` (flujo típico).
Si un tipo no aplica, justificarlo junto al requerimiento; no inventar límites.

Detallar precondiciones, datos, pasos y resultado comprobable. Citar el test por
ruta completa y nombre exacto; si es manual, indicar protocolo y ruta de evidencia
prevista. Tras ejecutarlo, enlazar evidencia real desde el test log. Un test puede
cubrir varias filas, pero su existencia no demuestra que se ejecutó cada caso.

## Rutas, evidencia y resultados

- Toda ruta de archivo se escribe completa desde la raíz del repo, por ejemplo
  `supabase/functions/api/domain/configuration.test.js`. No usar abreviaturas de
  backend, rutas relativas, rutas de la computadora ni solo nombres de archivo.
- Los enlaces Markdown locales también llevan la ruta desde la raíz. Los enlaces
  externos llevan URL completa a PR, corrida, Jira o evidencia con acceso del equipo.
- Datos y evidencias versionados viven en `docs/testing/data/`. Si un artefacto
  está ignorado o fuera de Git, añadir un enlace persistente; una ruta que solo
  existe en la computadora de quien ejecuta no sirve como evidencia compartida.
- Registrar fecha con hora y zona, commit completo probado, entorno y versiones
  relevantes. Separar mocks, SQL real, API desplegada, navegador y dispositivo.
  Exportar bundles no equivale a probar en teléfono; una sesión simulada no prueba JWT real.
- Resultados de caso: `pasó`, `falló`, `bloqueado`. `bloqueado` requiere motivo y
  responsable; no cuenta como éxito. Un caso no ejecutado no tiene una fila de ejecución.
- Una nueva ejecución agrega una nueva fila; nunca reemplaza el resultado anterior.
  No sumar una suite y sus casos como si fueran ejecuciones independientes.
- No publicar tokens, contraseñas, datos personales ni EXIF crudo. Usar datos
  sintéticos y participantes anónimos; describir la procedencia y limitaciones.

## Incidentes y CI

En cuanto falla un caso, quien lo ejecuta registra su fila, abre `INC-<n>` en
`docs/testing/INCIDENTS.md` y crea el ticket de bug en Jira. Enlazar caso,
ejecución e incidente en ambos sentidos. No esperar T10 ni T11. Si Jira no está
accesible, dejar explícito el pendiente y su responsable; el registro queda incompleto.
Una falla del entorno o fixture también se documenta con su causa, sin atribuirla
al producto antes de investigar.

Las corridas CI se registran aparte, una fila por suite, con totales
pasaron/fallaron/omitidos y enlace. Registrar las corridas sobre main y la final de
T10. Una corrida roja de un PR en curso se corrige en ese PR y no genera incidente
por sí sola; una falla en main lleva un incidente que abre P2 (T2/T10).

El incidente conserva severidad, responsable, diagnóstico, solución y commit/PR.
Solo cerrar tras una nueva ejecución de verificación enlazada; conservar la falla
original. El resumen de T12 debe coincidir con las filas y con T10.
