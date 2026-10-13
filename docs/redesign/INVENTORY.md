# Inventario de pantallas y componentes × cobertura Playwright

Navegación: `useState('screen')` en `App.js`. Arnés de pruebas: `tests/ui/configuration-entry.jsx` (query string elige el fixture) servido por `tests/ui/serve-configuration.mjs`.

## Pantallas

| Pantalla | Líneas | Fixture (`?…`) | Specs que la cubren | Cobertura |
|---|---|---|---|---|
| `CameraScreen` | 229 | `?camera` (stub de `expo-camera` y `useCameraCapture`) | reportForm (cámara visible, "sin foto") | **Parcial**: solo estado con permiso concedido e inactivo. Sin permiso, validando, rechazo, atajo moderación, cola: no |
| `loginScreen` | 149 | `?login[&loading\|pending\|no-back]` | login | Buena (4 estados); error de credenciales sin cubrir |
| `PublicMapScreen` | 338 | `?map[&expo-go]` | publicMap, publicMapClusterSize | Alta (clusters, vacío, error, offline, zona, pin, denuncia, fallback Expo Go) |
| `ReportFormScreen` | 762 | `?report[&photo&color]`, `?offline-queue` | reportForm | Alta |
| `ReportDraftScreen` | 138 | — | — | **Sin cobertura y sin uso**: no se importa en ningún archivo (código muerto) |
| `CommandCenterScreen` | 391 | `?command-center` | commandCenter | Alta |
| `ConfigurationScreen` | 200 | (por defecto) | configuration | Alta |
| `ZoneSetScreen` | 197 | `?zones` | zoneSet | Alta |
| `DuplicateManagementScreen` | 184 | `?duplicates` | duplicateManagement | Alta |
| `associationDashboardScreen` | 247 | `?association`, `?association-preview` | associationDashboard, language (en) | Alta (+ único spec en inglés) |

## Componentes

| Componente | Specs | Cobertura |
|---|---|---|
| `DraftQueueBanner` | reportForm (`draft-queue-banner`, `draft-queue-retry`, estados pendiente/sincronizado/terminal) | Buena; estados "reintento programado" y "sincronizando" sin ver |
| `PublicMapView.js` (nativo, MapLibre) | publicMapClusterSize (con stub de MapLibre, solo tamaño de cluster) | **Solo tamaño**; mapa real, pines, atribución: no renderizable en web |
| `PublicMapView.web.js` (fallback web) | publicMap (`?map` usa este) | Buena |
| `RecentReportsList` | publicMap (fallback Expo Go) | Parcial vía fallback |
| `ReportFlagSheet` | publicMap (muchos casos) | Alta |
| `ZoneReportsSheet` | publicMap | Alta |
| `associationDatePicker` | associationDashboard, language | Parcial (selección de fechas en modal) |
| `associationReportCard` | associationDashboard (`association-report-card`) | Buena |
| `associationSummaryCard` | associationDashboard (`association-total`, barras por día/mes) | Buena |

## Sin cobertura / riesgo

1. `ReportDraftScreen` — sin imports ni pruebas (candidato a borrar o ignorar; **no tocar sin decisión**).
2. `CameraScreen` — permisos, validación ML, toast de rechazo, atajo de moderación.
3. `PublicMapView.js` nativo — todo salvo el tamaño del cluster.
4. Foto real en `ReportFormScreen` (miniatura/estado de procesamiento de foto) — solo hay "foto pendiente".
5. Modo oscuro y tamaños de fuente grandes: ninguna prueba.
6. `tests/load/public-read.js` no es UI.
