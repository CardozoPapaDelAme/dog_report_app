# Inventario de pantallas y componentes × cobertura Playwright

> **Estado:** actualizado al final de TD-134 (rama `TD-134-JP-rediseno-paso0`, 109 pruebas Playwright). La versión de la pasada 1 (antes del rediseño) está en el historial de Git.

Navegación: `useState('screen')` en `App.js`. Arnés de pruebas: `tests/ui/configuration-entry.jsx` (el query string elige el fixture) servido por `tests/ui/serve-configuration.mjs`.

## Pantallas

| Pantalla | Líneas | Fixture (`?…`) | Specs que la cubren | Cobertura |
|---|---|---|---|---|
| `CameraScreen` | 238 | `?camera[&no-permission\|rejected\|blurry\|validating]` (stubs de `expo-camera` y `useCameraCapture`) | reportForm, cameraNotice | Buena: con permiso, sin permiso, rechazo (sin perro y borrosa), validando y aviso que se retira solo. Atajo de moderación y aviso de cola en la cámara: sin cubrir |
| `loginScreen` | 151 | `?login[&loading\|pending\|no-back]` | login | Buena (4 estados); error de credenciales sin cubrir |
| `PublicMapScreen` | 401 | `?map[&expo-go]` | publicMap, publicMapFocus, publicMapPhoto, publicMapClusterSize | Alta (clusters, enfoque al siguiente umbral, tarjeta compacta, vacío, error, offline, zona, ficha con foto completa, denuncia, fallback Expo Go) |
| `ReportFormScreen` | 843 | `?report[&photo=sample&color]`, `?offline-queue` | reportForm, reportFormPicker | Alta (selector en hoja, miniatura con vista completa, resultado) |
| `ReportDraftScreen` | 138 | — | — | **Sin cobertura y sin uso**: no se importa en ningún archivo (código muerto anterior al rediseño; **no tocado**, a decisión del equipo) |
| `CommandCenterScreen` | 360 | `?command-center[&tools]` | commandCenter | Alta (cola, esqueleto de carga, acciones, errores, sin sesión) |
| `ConfigurationScreen` | 210 | (por defecto) | configuration | Alta |
| `ZoneSetScreen` | 234 | `?zones` | zoneSet | Alta |
| `DuplicateManagementScreen` | 261 | `?duplicates` | duplicateManagement, duplicatesPagination | Alta (incluye paginación de 3) |
| `associationDashboardScreen` | 277 | `?association`, `?association-preview` | associationDashboard, associationPagination, language (en) | Alta (incluye paginación de 5 y único spec en inglés) |

## Componentes

| Componente | Specs | Cobertura |
|---|---|---|
| `components/ui/*` (AppButton, AppTextField, Banner, Chip, Icon, IconButton, Pager, PawTrail, PhotoViewer, PinGlyph, Scrim, Sheet, SheetHost, StateView) | uiKit (`?ui-kit`) más las pantallas que los usan | Buena para el kit; `PhotoViewer`, `SheetHost`, `Scrim` y `PinGlyph` solo vía pantallas |
| `DraftQueueBanner` | reportForm (`draft-queue-banner`, `draft-queue-retry`, estados pendiente/sincronizado/terminal) | Buena; estados "reintento programado" y "sincronizando" sin ver |
| `PublicMapView.js` (nativo, MapLibre) | publicMapClusterSize (stub de MapLibre; `?native-map-clusters`, `?native-map-pins` para revisión visual) | **Solo tamaño de cluster y revisión visual**; mapa real, atribución y enfoque: no renderizable en web |
| `PublicMapView.web.js` (fallback web) | publicMap, publicMapFocus (`?map` usa este) | Buena |
| `RecentReportsList` | publicMap (fallback Expo Go) | Parcial vía fallback |
| `ReportFlagSheet` | publicMap (muchos casos) | Alta |
| `ZoneReportsSheet` | publicMap | Alta |
| `associationDatePicker` | associationDashboard, language | Parcial (selección de fechas en modal) |
| `associationReportCard` | associationDashboard (`association-report-card`) | Buena |
| `associationSummaryCard` | associationDashboard (`association-total`, barras por día/mes) | Buena |

## Sin cobertura / riesgo (vigente)

1. `ReportDraftScreen` — sin imports ni pruebas (candidato a borrar; decisión pendiente del equipo).
2. `PublicMapView.js` nativo — el enfoque, el halo y el pin real solo se ven en dispositivo.
3. **Todo lo que depende de la capa nativa de React Native** no lo ve la web: la prueba `noRemovedStyleApis` guarda el caso conocido (`absoluteFillObject`), pero la verificación de superposiciones, teclado, hojas apiladas (`SheetHost`) y bordes de pantalla es **en iPhone**.
4. Modo oscuro y tamaños de fuente grandes: ninguna prueba ni captura (el texto grande no se verificó).
5. Android: fuera del alcance de TD-134.
6. `tests/load/public-read.js` no es UI.
