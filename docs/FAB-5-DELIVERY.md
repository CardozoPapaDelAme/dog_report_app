# TD-106 · FAB-5 / L5 — Pantalla de zone-sets

Entrega local: 2026-09-29. Rama: `TD-106-fab-5-pantalla-de-zone-sets`.
Base: `afef615` de `origin/main`, con L4 ya integrado mediante PR #18.

## Resultado

Desde **Gestionar zonas**, en moderación, el Administrador puede seleccionar un
archivo GeoJSON o pegar su contenido, calcular/ver su checksum, completar los
datos de procedencia y guardarlo como borrador. La zona activa anterior se conserva.
El segundo paso solo aparece disponible tras la respuesta de creación: muestra la
versión y checksum guardados, exige referencia de aprobación de la Asociación y
envía una petición independiente para activar. Solo una respuesta confirmada del
servidor muestra la nueva zona como activa.

Se siguieron `../GuiaDeConstruccion.md` (externa al repositorio), ambos handoffs
L4 de 2026-09-22 (repositorio y Escritorio), `AGENTS.md`, las aclaraciones aprobadas,
`docs/API.md` y el procedimiento de `docs/product/GEOFENCE-CANDIDATE.md`.
Los handoffs son antecedentes; sus pendientes de publicación de L4 estaban
superados por el merge existente en Git.

## Decisiones de implementación

- Misma arquitectura: pantalla → hook → modelo/adaptadores → FAB-1/FAB-2. La
  pantalla no accede a tablas ni llama HTTP directamente.
- `GET /admin/configuration` verifica acceso y obtiene entorno/zona activa.
  `POST /admin/zone-sets` crea el borrador; `POST /admin/zone-sets/:id/activate`
  lo activa con `association_approval_reference`. No se combinan.
- El checksum es SHA-256 del JSON normalizado a MultiPolygon, exactamente como
  FAB-2. No es el hash de los bytes originales del archivo: espacios y orden de
  claves no lo cambian. Las pruebas comprueban paridad con el dominio backend.
- Se aceptan geometrías directas Polygon/MultiPolygon, WGS84, hasta 1 MiB como
  límite del lector móvil. Feature/FeatureCollection y metadatos CRS no se
  descartan silenciosamente: se pide exportar la geometría revisada. La
  validación topológica completa permanece en PostGIS.
- `source_uri` se captura como procedencia original; no se envía la URI temporal
  del selector. Se muestran ID, versión, checksum y fuente del borrador guardado.
- El campo de aprobación no aprueba por sí mismo: la evidencia debe obtenerse
  fuera de la aplicación sobre la versión/checksum exactos.
- Errores locales traducidos español/inglés; `details.fields` del servidor se
  conserva literalmente. Doble envío bloqueado y respuestas tardías descartadas
  al cambiar sesión o salir. 401/403 retira datos y controles.
- El nuevo `main` había cambiado las URLs a `zoneSets` durante un renombrado de
  archivos. Se restablecieron las URLs documentadas y se mantuvieron los alias
  camelCase con los mismos controles, sin cambiar el servicio ni persistencia.

## Verificación

- Deno: **156 aprobadas, 0 fallidas, 5 omitidas** (SQL opt-in).
- L5 aporta **6 pruebas de modelo/API/integración**; sesión y repositorio de la
  integración son simulados, Controller y Service son reales.
- Playwright: **23 aprobadas**, 15 L5 y 8 regresiones L4. Incluyen archivo real
  del navegador, separación de endpoints, referencia obligatoria, permanencia
  de zona anterior, errores, permisos, doble envío y respuestas inciertas.
- Capturas revisadas a 390 × 844 y 1200 × 900.
- Exportación Expo correcta en web, Android e iOS; no equivale a ejecución nativa.
- Comandos reproducibles y revisión manual: [TESTING.md](TESTING.md).

## Límites pendientes

La prueba con Administrador real sigue aplazada según lo acordado. `index.js`
aún no suministra una sesión; la pantalla consume `App.accessToken` de la capa de
sesión del equipo. Falta comprobar el selector, teclado, accesibilidad y botón
atrás en un development build físico/emulador.

FAB-2 no tiene consulta/listado de borradores. El borrador se puede activar en la
sesión actual de esta pantalla; al salir, la versión guardada permanece en el
servidor pero no puede recuperarse aquí. Se advierte antes de salir y se ofrece
su ID. Una creación incierta requiere revisión del operador antes de repetirla.
Una activación incierta solo se confirma consultando la zona activa y comparando
ID/checksum; si no coincide, permanece bloqueada para revisión. No se afirma que
un resultado incierto haya fallado ni se reintenta automáticamente.

No se hizo push, PR, merge, despliegue, migración, activación real ni cambio de
Supabase en esta entrega. Los datos de prueba son geometrías sintéticas aisladas,
nunca una delimitación oficial de producción.
