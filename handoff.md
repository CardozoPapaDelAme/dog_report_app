# Handoff — Wildogscanner / Fabián (`fab`)

Actualizado: 2026-09-22. Entrega local de L4 / TD-105 / FAB-4.

## Estado

- Repositorio: `/Users/fabianfuentes/Documents/RetoFronEnd/RepoJP/dog_report_app`.
- Rama: `TD-105-fab-4-pantalla-de-configuracion-de-umbrales`.
- Base: `dd2614f`, main actualizado con L1, L2, L3 y el PR #17 de reportes de Erick.
- L2 está fusionado mediante PR #15 (`0a2a579`) y L3 mediante PR #16 (`43688e8`).
- L4 está implementado y probado en commits pequeños `FAB-4`.
  Consultar `git log origin/main..HEAD` para los hashes exactos.
- Sin push, PR, merge, despliegue ni cambios de Supabase para L4.
- La prueba con Administrador real continúa aplazada por Fabián.
- El handoff del Escritorio corresponde al cierre local de L2 y es histórico;
  no usar sus pendientes de publicación como estado actual.

## Alcance entregado

Pantalla de configuración de umbrales conectada a FAB-1 desde el botón
**Configurar umbrales** de la cola de moderación. Conserva estilo, fuentes e i18n
español/inglés de la app. No incluye las pantallas de zonas (L5) o duplicados (L6).

La guía `../GuiaDeConstruccion.md` dice nueve valores. El contrato ya aclarado
por FAB-1 es **ocho umbrales numéricos más change_note**, nueve campos en total.
No se inventó un noveno umbral ni se alteró el backend.

- Carga valores actuales y muestra versión activa, entorno y motivo anterior.
- El motivo para la nueva publicación siempre empieza vacío.
- Valida rangos, enteros, precisión decimal, confianza media menor que alta y
  motivo significativo de hasta 1000 caracteres Unicode.
- Acepta punto/coma decimal, convierte a números y envía el body completo de FAB-1.
- Los errores locales son específicos por campo; los del servidor en
  `error.details.fields` se muestran literalmente junto al campo correspondiente.
- Hace foco en el primer error y anuncia validación/éxito para accesibilidad.
- Al guardar, muestra la nueva versión activa devuelta por el servidor y limpia
  el nuevo motivo. No reutiliza el motivo anterior.
- Previene doble envío con un bloqueo síncrono, además de deshabilitar el botón.
- No reintenta POST automáticamente: FAB-1 no tiene idempotency key. Ante resultado
  incierto/conflicto, exige consultar de nuevo la versión activa antes de guardar.
- Cambiar sesión/desmontar invalida respuestas antiguas. 401/403 retira el formulario.
- Recargar/salir con cambios pregunta antes de descartarlos. Android hardware back
  usa la misma confirmación; durante guardado se bloquea la salida de la pantalla.

## Arquitectura y archivos

Leer `AGENTS.md` y la precedencia documental antes de modificar. Se conserva
la única API Hono, SQL directo, roles hermanos, RLS/grants y auditoría de FAB-1.
La pantalla no llama directamente a HTTP ni a tablas.

| Archivo | Responsabilidad |
|---|---|
| `models/configuration.js` | Campos, rangos, draft, conversión, errores, respuesta válida |
| `services/configurationApi.js` | GET/POST por `apiClient`, Bearer, preservación de errores |
| `hooks/useConfiguration.js` | Carga, edición, publicación, sesión y resultados tardíos |
| `screens/ConfigurationScreen.js` | Formulario, estados, accesibilidad y confirmación |
| `App.js`, `screens/CommandCenterScreen.js` | Entrada y retorno a moderación |
| `i18n/locales/es.json`, `en.json` | Etiquetas y validaciones localizadas |
| `tests/ui/` y `playwright.config.mjs` | Pruebas de interfaz aisladas del producto |

No hay migraciones ni cambios del contrato API/SQL. El cliente solicita
`/admin/configuration`; `EXPO_PUBLIC_API_BASE_URL` ya incluye `/functions/v1/api`.
No duplicar `/api`.

## Sesión: límite de integración existente

La app recibe `App.accessToken` de la futura/concurrente capa de sesión del equipo.
`index.js` aún no inicia sesión ni suministra un token. L4 reutiliza ese contrato;
no crea usuarios, roles, tokens, login alternativo ni credenciales embebidas.

Sin token, no se consulta configuración. Con token, solo un GET FAB-1 autorizado
habilita el formulario. JWT/perfil/rol se verifican en el servidor; una respuesta
401/403 muestra el estado de acceso correspondiente. La prueba con Administrador
real sigue siendo necesaria antes de afirmar funcionamiento en staging.

## Pruebas ejecutadas

- Deno, cliente + backend: **104 passed, 0 failed, 3 ignored** (SQL opt-in existente).
- Playwright: **8 pruebas aprobadas**, con pantalla/hook/API reales y HTTP simulado.
- Integración del adaptador móvil con Controller/Service reales de FAB-1, usando
  sesión y persistencia en memoria; valida publicación y errores exactos del backend.
- Capturas inspeccionadas en 390 × 844 y 1200 × 900: error junto a GPS, éxito y
  distribución sin desbordamientos. Se generan en `test-results/` (ignorado).
- Exportación Expo correcta para web, Android e iOS; no equivale a prueba en
  dispositivo físico o emulador. Teclado, lector de pantalla y hardware back
  requieren la comprobación manual de desarrollo documentada.
- `npm ci --dry-run` verifica el lockfile sincronizado. Antes faltaban entradas
  de hono, jose y postgres ya declaradas; se repararon sin cambiar sus rangos.
- Nuevas dependencias solo de desarrollo: Playwright y esbuild para pruebas UI.
  El bundle de producción no importa fixtures, sesiones de prueba ni esas herramientas.

Comandos y validación administrada pendientes: `docs/TESTING.md`, sección FAB-4.
Deno local disponible en caché:
`/Users/fabianfuentes/.npm/_npx/05b6ef7b13673c57/node_modules/deno/deno`.
No asumir que esa ruta existe en otro equipo. Usar `--no-lock` en las pruebas Deno.

## Decisiones anteriores que siguen vigentes

- L3 resuelve solo grafos conectados de candidatos pending; no agrupación aleatoria.
- Fabián confirmó que revertir L3 conserva moderación y reabre candidatos, sin
  modificar reportes/fotos. Candado de duplicados: `pg_advisory_xact_lock(103003,1)`.
- L2 crea borrador y activa por separado con evidencia de aprobación de Asociación.
- Nunca guardar secretos, modificar una migración publicada o aplicar el snapshot
  completo `db/schema.sql` a una BD existente.

## Siguiente paso

Revisión/entrega de L4; publicar o fusionar solo cuando Fabián lo indique.
La autorización de merge de L3 no cubre automáticamente L4. El siguiente ticket
funcional de la guía es L5 (pantalla de zonas), fuera de esta entrega.
