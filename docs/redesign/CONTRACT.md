# Contrato intocable (extraído de `tests/ui/*.spec.js`)

> **Estado:** vigente y verificado contra la rama `TD-134-JP-rediseno-paso0` (109 pruebas Playwright en verde). Los `testID`, roles y textos de abajo existen tal cual en el código actual. La sección 7 lista lo que cambió respecto al contrato original y por qué.

El rediseño de `screens/` y `components/` **no puede cambiar nada de lo siguiente**. Los textos vienen de las llaves i18n existentes (`i18n/locales/es.json`, `en.json`); las pruebas las leen en español salvo `language.spec.js` (en-US). Extraído con grep de los specs; regenerar si un spec cambia.

## 1. Reglas estructurales (no son strings)

| Regla | Dónde | Implicación para el diseño |
|---|---|---|
| Configuración renderiza **exactamente 8 `<input>`**; el 9.º campo (`configuration-change_note`) NO puede ser un `<input>` (hoy es `TextInput multiline` → `<textarea>`, en `ConfigurationScreen.js`). Con 401/403/sin sesión: **0 inputs**. | configuration.spec:28,72,81 | No añadir buscadores/inputs decorativos, ni convertir la nota en input de una línea. |
| Sin desbordamiento horizontal: `scrollWidth <= innerWidth` a 390 px y a 1200 px | configuration, zoneSet, duplicates | Anchos máximos/`flexWrap` obligatorios; no fijar anchos > viewport. |
| Dashboard Asociación: **tarjetas** en móvil, **tabla** en ≥ ancho amplio (1280); nunca ambos | associationDashboard:36,85 | Mantener el punto de quiebre y los dos `testID`. |
| Foco: al fallar validación se enfoca el primer campo inválido (`configuration-gps_accuracy_max_meters`); al exigir nota de reversión se enfoca `duplicate-reverse-note` | configuration:34, duplicates:59 | No reordenar el foco ni reemplazar los `TextInput` por componentes que no acepten `focus()`. |
| La posición del control `report-sighting_type-solitario` no cambia al abrir el selector de incidente | reportForm:59-63 | El desplegable de incidente no debe empujar el contenido (overlay o espacio reservado). |
| Campos honeypot (`report-honeypot-contact`, `-website`) existen, están ocultos y aceptan `fill(force)` | reportForm | Conservar la técnica actual (`position:absolute; 1×1; opacity:0; left:-9999`, estilo `honeypot` de `ReportFormScreen.js`); no usar `display:none`. |
| `#report-reporter_name/phone/email` y `report-reporter_*` **no existen** (RF02) | reportForm:32-36 | Nunca añadir campos de identidad. |
| Los `id` de formulario web `report-<campo>` se exponen | reportForm:98 | Conservar `nativeID`/`id`. |
| Cluster: diámetro `2·(18+30·min(1, ln(n)/ln(1000)))`, mín 36, máx 96 px; botón con `accessibilityLabel` "N reportes, gravedad X" y texto = N | publicMapClusterSize, `models/publicMap.js` | Tamaño de cluster es contrato (RF12). Se puede cambiar color/borde/halo, no la escala: el halo es un anillo exterior y el botón interno conserva el diámetro medido. |
| El pin de un reporte es un solo elemento accesible "Reporte: <tipo>" (`PinGlyph` dentro) y el aviso del mapa/atribución no cambian | publicMap | El dibujo del pin es libre; el nombre accesible y el toque son contrato. |
| No se usa `StyleSheet.absoluteFillObject` (no existe en RN 0.86; en el teléfono deja los overlays sin `position: absolute` y la web no lo detecta) | `noRemovedStyleApis.spec.js` | Usar `StyleSheet.absoluteFill`. |
| Sin errores de página (`pageerror`) en ninguna prueba | todos | Fuentes/íconos nuevos no deben lanzar excepciones en react-native-web. |
| El bundle web se construye con **esbuild** (`alias react-native→react-native-web`, `.ttf` como `file`, `jsx:automatic`) y solo resuelve `.web.js, .js, .jsx, .json` | `serve-configuration.mjs` | Toda dependencia nueva (fuentes, íconos, blur) debe poder empaquetarse con esbuild y tener alias/stub si es nativa; **no** archivos `.tsx`/`.ts`. |
| Fuentes: el fixture registra por `@font-face` las ocho familias de `theme/fonts.js` (Plus Jakarta Sans 400/600/700, Work Sans 500/600/700, Fredoka 500/600); cualquier otra cae a fuente por defecto en web | `configuration-entry.jsx` | Si cambian o se añaden familias, el fixture de pruebas debe actualizarse **a la par** (archivo de test: requiere aprobación). |

## 2. `testID` por pantalla

- **Cámara**: `camera-screen`, `camera-preview`, `camera-without-photo` (también `camera-capture` en código)
- **Cola de borradores**: `draft-queue-banner`, `draft-queue-retry`
- **Formulario de reporte**: `report-submit`, `report-privacy-warning`, `report-incident_type-select`, `report-incident_type-<valor>` (`avistamiento_simple`, `ataque_humano`, …), `report-sighting_type-<solitario|manada>`, `report-tipo_animal`, `report-cantidad_aprox`, `report-cantidad_afectada`, `report-descripcion`, `report-situacion-atrapado`, `report-resulto_herido-si`, `report-hubo_mordida-si`, `report-has_collar-si`, `report-dog_size-<chico|grande|no_se>`, `report-dog_color-<negro|dorado|…>`, `report-dog_color-detected`, `report-photo-pending`, `report-honeypot-contact`, `report-honeypot-website`, `report-error`, `report-error-back`, `report-error-retry`, `report-queued`, `report-queued-back`, `report-success`, `report-success-back`
- **Mapa**: `cluster-modal`, `zone-sheet`, `pin-sheet`, `flag-sheet`, `recent-reports`, `expo-go-notice`, `cluster-count-<n>` (fixture nativo), `public-map-stub`
- **Asociación**: `association-total`, `association-report-card`, `association-report-table`
- **Configuración**: `configuration-<key>` (8 claves + `change_note`), `configuration-save`
- **Zonas**: `zone-<key>` (`content`, `name`, `source_uri`, `source_version`, `association_approval_reference`), `zone-pick`, `zone-create`, `zone-activate`, `zone-activated`, `zone-created`, `zone-draft-status`, `zone-checksum-preview`, `zone-checksum-active`
- **Duplicados**: `duplicate-select-<id>`, `duplicate-canonical-<id>`, `duplicate-group-<id>`, `duplicate-reverse-<id>`, `duplicate-confirm-reverse`, `duplicate-reverse-note`, `duplicate-resolve`, `duplicate-resolution-note`, `duplicate-graph-error`
- Moderación (Command Center) **no usa `testID`**: se localiza por texto/rol (ver §3), así que sus textos y roles son el contrato.

## 3. Roles con nombre (es) — `getByRole(role, {name})`

- **Login**: button `Volver a cámara` (oculto en carga/sin handler; `disabled` en pendiente)
- **Mapa**: button `Acercar` (controles del mapa y del fallback web; **la tarjeta del cluster ya no tiene `Acercar`**: la cámara se acerca sola al tocar el cluster), `Foto del reporte` (abre la foto completa), `Cerrar`, `Reintentar` (exacto), `Denunciar` (exacto), `Enviar denuncia`, `Ver reportes de la zona`, `Reporte: Ataque a mascota`, `Reporte: Avistamiento`, `/Reporte:/`, `/gravedad/`, `N reportes, gravedad alta|baja`; radio `Foto falsa`, `Burla u ofensa`, `No es un perro callejero`, `Otro`
- **Asociación**: button `Últimos 7 días`, `Personalizado`, `Consultar`, `CSV`, `XLSX` (exactos, `disabled` sin datos), `Mes anterior`, `/Hasta:/`, `<día> de <mes> de 2026` y `<día>…: N reporte(s) aceptado(s)`, `<mes> de 2026: N reportes aceptados`; en: `Last 7 days`, `Custom`, `Search`, `/^From:/`, `/^To:/`
- **Command Center**: button `Aprobar`, `Ocultar`, `Restaurar`, `Eliminar`, `Confirmar ocultar`, `Confirmar restaurar`, `Cargar más` (todos `exact`)
- **Configuración**: button `Consultar versión activa`, `Reintentar carga`, `Seguir editando`, `Descartar y continuar`, `/Volver a moderación/`
- **Zonas**: button `Calcular checksum`, `Activar esta versión`, `Consultar zona activa`, `Preparar otro borrador`, `Continuar`, `Permanecer aquí`
- **Duplicados**: button `Actualizar candidatos y grupos`, `Revisar selección (2)`, `Consultar estado antes de continuar`, `Reintentar carga`, `Seguir editando`, `Descartar y continuar`
- Todos deben seguir siendo `accessibilityRole="button"`/`radio` (los `Pressable` no semánticos rompen `getByRole`). Los botones de prueba (`Cerrar sesión de prueba`, `Otra sesión de prueba`, `Abrir formulario de prueba`) y el aviso demo pertenecen al fixture, no a la app.

## 4. Textos (es) que las pruebas esperan visibles

- **Login**: `Inicia sesión`, `Comprobando sesión…`
- **Mapa / zona / denuncia**: `© OpenMapTiles © OpenStreetMap contributors`, `Zoom 17`, `No pudimos cargar el mapa.`, `El mapa no está disponible sin conexión`, `Puedes seguir creando reportes; se enviarán cuando haya conexión.`, `7 reportes en esta zona`, `Mayor gravedad: Ataque a persona`, `Reportes de la zona`, `No hay reportes visibles en esta zona`, `No pudimos cargar los reportes de la zona.`, `No hay reportes en esta zona`, `No pudimos cargar los reportes.`, `La comunidad marcó este reporte`, `Manada`, `Cerca del mercado`, `negro`, `Gracias. Revisaremos el reporte.`, `Enviaste muchas denuncias. Intenta de nuevo en 2 min.`, `El detalle no puede superar 1000 caracteres.`, `1000/1000`, `1001/1000`, `Sin conexión. Intenta de nuevo.`, aviso Expo Go `El mapa interactivo requiere la development build`
- **Formulario/cola**: `Nuevo Reporte`, `Sin foto`, `Foto adjunta`, `No ingreses datos personales` (+ `teléfonos`, `anónimo`), `Para esta categoría no hay preguntas adicionales.`, `Payload congelado`, `Código: <code>` (sin mostrar `request_id`), `Reporte guardado para sincronizar`, `Reportes guardados para sincronizar`, `Reportes sincronizados`, `Un reporte no pudo sincronizarse`
- **Asociación**: `Periodo de reportes`, `N reportes en este rango`, `Por día`, `Por mes`, `<fecha> · N reporte(s) aceptado(s)`, `Cantidad aproximada de perros: 1` (nunca JSON crudo), `No hay resultados en este rango.`, `Cargando todos los reportes del rango…`, `Consulta este periodo para actualizar los resultados.`; en: `Report period`
- **Command Center**: `Cola de moderación`, `En esta página`, `Con banderas`, `Prioridad alta`, `Ataque a persona`, `Banderas: 1`, `Pendiente`, `Oculto`, `27.75320, -107.63550`, `Requiere atención: se detectaron señales sospechosas.`, `No hay reportes pendientes en esta página.`, `No pudimos actualizar la cola`, `Toca para intentar nuevamente.`, `Sesión de administrador requerida`
  - Las métricas se localizan como `<valor><etiqueta>` en un mismo contenedor (texto concatenado `^3En esta página$`): la etiqueta y el número deben ser el **único** contenido de la tarjeta de métrica.
- **Configuración**: `Versión N activa`, `Versión 2 guardada y activa.`, `Debe estar entre 5 y 500.`, `No pudimos cargar los umbrales`, `¿Descartar los cambios sin guardar?`, `Inicia sesión como Administrador`, `/No se pudo confirmar la publicación/`; error de servidor literal `Must be a number between 5 and 500.`
- **Zonas**: `01 · Crear borrador`, `Borrador · todavía no activo` (`zone-draft-status`), `Zona anterior · Versión 1`, `¿Salir de este borrador?`, `Resultado pendiente de confirmar`, `Calcula el checksum del contenido actual antes de guardar.`, `El contenido no es JSON válido.`, `Acceso no permitido`, `/La zona activa consultada no coincide/`; errores literales del servidor (`Self-intersection at 0.5 0.5`, `Approval reference rejected by server`)
- **Duplicados**: `Gestión de duplicados`, `Candidatos pendientes`, `Sugerencia N · M reportes conectados`, `Elige como canónico uno de los reportes seleccionados.`, `no están conectados` (en `duplicate-graph-error`), `Resolución confirmada. El grupo está activo.`, `Reversión confirmada. Los candidatos vuelven a revisión; la moderación se conserva.`, `¿Descartar esta selección?`, `No hay sugerencias disponibles para resolver.`, `El servicio no está disponible por el momento.`, `Oculto`, `/La operación fue confirmada, pero la lista no pudo actualizarse/`, `/No se confirmó el resultado/`

## 5. Comportamientos visibles que no se pueden eliminar

- Doble toque en enviar/denunciar/resolver/activar envía **una sola** petición (botones deben deshabilitarse/bloquearse de inmediato; no sustituir por componentes asíncronos que cambien el timing sin un guard).
- Reintento tras error 500 / offline en mapa, zona, fallback Expo Go, configuración, duplicados.
- Estados 401/403/sin sesión **ocultan** datos y controles (nada de "estado deshabilitado" que deje inputs en el DOM).
- Cierre de sesión / cambio de sesión descarta resultados tardíos.
- Contador de detalle `N/1000` bloquea envío > 1000.
- Banner de cola: reintentar visible solo si `canRetryNow`; en estado terminal no hay botón.
- Exportación CSV/XLSX deshabilitada mientras carga o sin datos.

## 6. Fuera de alcance del rediseño (no tocar)

`models/` (incl. Value Objects), `hooks/`, `controllers/`, `dao/`, `db/`, `services/`, `supabase/`, llaves i18n existentes (se puede **añadir** llaves nuevas; cambiar el texto de una llave existente rompe pruebas), `App.js` (navegación `useState`), `tests/` (cualquier cambio requiere aprobación y se declara; ver sección 7).

## 7. Cambios al contrato durante TD-134 (todos declarados al usuario)

Cambios en `tests/` hechos con aprobación del usuario o por diseño aprobado por él:

| Archivo | Cambio | Por qué |
|---|---|---|
| `configuration-entry.jsx`, `serve-configuration.mjs` | Registro de las ocho fuentes por `@font-face`, `define: { global: 'globalThis' }`, parámetros de fixture (`?camera&no-permission\|rejected\|blurry\|validating`, `?report&photo=sample`, `?command-center&tools`, `?native-map-pins`, `?ui-kit`, contenedor flex en `?map`) | Paso 0 y capturas de estados que el fixture no podía mostrar |
| `expo-camera-stub.js`, `use-camera-capture-stub.js` | Estados de permiso y de validación simulables | Probar los avisos de la cámara |
| `associationDashboard.spec.js` | Al elegir la fecha inicial se abre sola la fecha final | Decisión del usuario sobre el selector de rango |
| `publicMap.spec.js` | Dos pruebas nuevas de TD-133 (cierre al tocar fuera, sin llaves duplicadas) | Corrección de errores del mapa |
| `commandCenter.spec.js` | Sin cambios: las métricas siguen siendo `<valor><etiqueta>` | — |

Pruebas nuevas (no sustituyen a las anteriores): `uiKit`, `reportFormPicker`, `cameraNotice`, `duplicatesPagination`, `associationPagination`, `publicMapFocus`, `publicMapPhoto`, `noRemovedStyleApis`.

Cambio de comportamiento aprobado que afecta a una prueba existente: la tarjeta del cluster ya no ofrece "Acercar" (la prueba `publicMapFocus` comprueba que no está y que sí está "Ver reportes de la zona").
