# AUDIT.md — Auditoría de rediseño visual (TD-132, pasada 2)

> **Documento histórico:** describe el estado de la app **antes** del rediseño (2026-10-13) y el plan de trabajo. Los hallazgos `F-nn` y las cifras (90 pruebas, 13 objetos `colors`, 68 hex…) son los de entonces. Qué se hizo con cada punto está en la sección final **"Estado al cierre de TD-134"**; el diseño vigente está en [`../design/DESIGN.md`](../design/DESIGN.md) y las reglas aprobadas en [`TASTE.md`](TASTE.md).

Fecha: 2026-10-13. Solo auditoría y plan: **no se cambió código ni se instaló nada**. Insumos: `BASELINE.md`, `INVENTORY.md`, `CONTRACT.md`, `NOTAS_PASADA1.md`, capturas web (`before/web/{es,en}/`), capturas manuales (`before/manual/`), criterio de los skills `mobile-design-review` y `expo-design-system` y `docs/design/DESIGN.md` ("Sierra Guardian").

## 0. Resumen ejecutivo

- La app **no tiene sistema de diseño**: 13 objetos `colors` locales, 68 hex distintos (dos verdes primarios), ≥ 20 radios, 28 tamaños de fuente, botones/tarjetas/chips redefinidos por pantalla, cero íconos (todo es texto: `×`, `▼`, `R`). Por eso el **Paso 0** (theme + tipografía + íconos + componentes base) es obligatorio antes de cualquier pantalla.
- Problemas de uso real (sol, una mano, teclado): contraste de clusters/pines verde y naranja con texto blanco **falla AA (2.7–2.8:1)**, texto de 10–12 px, objetivos táctiles < 44 pt, el login pierde el botón de cámara con el teclado, y las alertas rosas aparecen aun con valor 0.
- La base funcional es sólida (estados loading/vacío/error/offline existen y 90 pruebas Playwright los protegen). El rediseño es **de presentación**; el contrato (`CONTRACT.md`) limita sobre todo la estructura de Configuración, los roles con nombre y los textos.

### Limitaciones de la evidencia (leer antes de confiar en un hallazgo)

| Tema | Detalle |
|---|---|
| Android fuera de alcance | **Decisión del usuario: no se capturará Android** (filas 16, 17, 18 descartadas). Alcance de dispositivo = solo iPhone; Android queda como riesgo aceptado. |
| Captura 14 | `14_formulario_texto_grande_ios_es.PNG` es **idéntica byte a byte a la 13** (teclado, tamaño normal). **Texto grande NO verificado**; la app no define `allowFontScaling`/`maxFontSizeMultiplier`. |
| Idioma | **Todas las capturas manuales están en inglés** (los sufijos "_es" del nombre son solo del plan). Cubre longitud de textos en `en` y hace innecesaria la captura 20. El español solo se vio en web (`before/web/es/`); **no se vio `es` en dispositivo** (textos más largos: riesgo). |
| Artefactos de dev build | El engranaje gris flotante (esquina sup. der.) es el dev menu de Expo, no la app; tapa "Staff login" en cámara. El toast "MapLibre Native [ERROR]…" en la 19 es de desarrollo. No son hallazgos. |
| Captura 05 | Se tomó **antes de TD-133**: el teclado tapaba "Details". Ya corregido (web verificado; falta confirmar en dispositivo). |
| Login + teclado | No hay captura; se infiere del código (ver F-03). Falta reproducir. |
| Capturas duplicadas | `03…es1` (lista de la zona) y `15…es1` (scroll) son capturas complementarias, se usan ambas. |
| Arnés web | Sheets recortados y barra "Demo local" son del fixture, no de la app. |
| Sin calcular | Contraste del vidrio de la cámara (depende de la imagen). |

## 1. Hallazgos (ordenados por impacto)

Formato: **F-nn · impacto · pantalla** — evidencia → problema → propuesta. Impacto: **Alto** = usabilidad/accesibilidad real o bloquea consistencia; **Medio** = jerarquía/consistencia visible; **Bajo** = pulido.

### Alto

- **F-01 · Alto · Sistema** — `NOTAS_PASADA1` (grep). Sin theme: 13 `const colors` locales, 249 hex literales, 68 distintos; `#00450D` (DESIGN.md `primary`) convive con `#005A25` (dashboard, otros). Tokens de DESIGN.md (`danger-alert #D32F2F`, `map-cluster-*`, `surface-container-*`) existen pero no se usan; se usan `#a51e1e`, `#ba1a1a`, `#ffdad6` ad hoc. → Paso 0: un `theme/` único.
- **F-02 · Alto · Mapa (01, 02)** — Texto blanco sobre cluster verde (~#4CAF50) = **2.78:1** y sobre pin naranja (~#F57C00) = **2.70:1**: falla AA incluso para texto grande (3:1). Al sol es peor. Además los clusters rojos y verdes dependen solo del color (sin forma/ícono por gravedad). → Colores de cluster con ≥ 4.5:1 (p. ej. blanco sobre `#2E7D32` = 5.13) o borde/ícono; conservar la escala de diámetro (contrato RF12).
- **F-03 · Alto · Login** — `screens/loginScreen.js:52-57`: el botón "Volver a cámara" está **arriba** dentro del `KeyboardAvoidingView`; con teclado abierto queda fuera de vista, y no hay otra salida (bug reportado: "login + teclado tapa el botón de cámara"). → Mantener el botón accesible con teclado (cabecera fija o scroll con `keyboardShouldPersistTaps`); conservar el rol `button` "Volver a cámara" y su ocultación en carga/sin handler. **Por reproducir en dispositivo.**
- **F-04 · Alto · Transversal (texto al sol)** — 10 px (×4), 11 px (×15), 12 px (×33), grises `#5D6859`/`#61705E` (5.6–5.9:1, pasa AA pero es frágil bajo sol), etiquetas "EXACT LOCATION", chips "Trust/Flags/Photo" (15), dateLabel del dashboard (`#61705e`, 11 px). → Mínimo 13 px para texto de apoyo, 12 px solo para overlines en mayúsculas; grises más oscuros (`on-surface-variant` ≈ `#46503F`).
- **F-05 · Alto · Transversal (accesibilidad de fuente)** — Sin `allowFontScaling`/`maxFontSizeMultiplier` definido y captura 14 vacía: se desconoce cómo reflujan chips "Sí/No/No sé", métricas y botones de cámara. → Verificar con texto grande antes y después; layouts con `minHeight` y `flexWrap`, no alturas fijas.
- **F-06 · Alto · Command Center (15)** — Cabecera verde con **4 botones apilados en 4 filas** ("Manage duplicates / zones / thresholds / Sign out") ocupa ~45 % de la primera pantalla y empuja la cola (la tarea principal) bajo el pliegue. Las métricas "Flagged 0" y "High priority 0" salen en **rosa de alerta con valor cero** (falsa alarma). → Acciones secundarias en una fila compacta/menú; color de alerta solo si el valor > 0. Contrato: Moderación se localiza por texto/rol, y cada métrica debe ser solo `<valor><etiqueta>`.
- **F-07 · Alto · Cámara (07–10)** — Los botones de vidrio (`rgba(18,18,18,0.56)`, sin blur ni gradiente) se leen bien en 07/09/10 pero sobre pared clara (08) "Staff login"/"View map" dependen solo del 56 % negro; no hay scrim superior ni inferior. En 10 el contenedor "Validating photo…" y el obturador atenuado se ven débiles sobre imagen cambiante. → `expo-linear-gradient` como scrim top/bottom; considerar `expo-blur`.

### Medio

- **F-08 · Medio · Mapa — sheets (03, 03-es1, 04)** — Tres patrones distintos: modal centrado con fondo gris (03, "Web Modal"), sheet de lista con grabber (03-es1) y sheet de detalle (04). En 04 la lista y el detalle **se apilan y se solapan**, ambos con grabber **sin gesto** (el grabber promete arrastre que no existe); DESIGN.md pide alturas 40/90 %. `PinSheet` no cierra al tocar fuera (TD-133 solo arregló denuncia y zona). → Componente `Sheet` base con backdrop (invisible a accesibilidad para no duplicar "Cerrar"), un solo patrón, grabber solo si hay gesto.
- **F-09 · Medio · Mapa — offline (19)** — El banner ámbar cubre ~1/6 del mapa; "Retry" es un botón verde pequeño dentro de un amarillo (el mensaje que explica la acción, "Puedes seguir creando reportes…", queda debajo del botón). Clusters y etiquetas siguen visibles (tiles en caché), lo cual está bien. → Banner compacto con jerarquía mensaje → acción; conservar roles `Reintentar` y textos.
- **F-10 · Medio · Mapa — clusters (01)** — Cluster "2" se solapa sobre "7" (colisión sin desagrupar); sin controles visibles Acercar/Alejar en el mapa nativo (el rol "Acercar" existe en el fallback); atribución y logo MapLibre se solapan con el texto en la esquina inferior izquierda. → Revisión visual del cluster (borde blanco ya correcto); reubicar controles.
- **F-11 · Medio · Mapa/Cámara — cabeceras inconsistentes** — Mapa: "Back to camera" + título + engranaje; Cámara: píldoras de vidrio; Formulario: `×` + título centrado; Command Center: cabecera verde grande. Cuatro cabeceras, cuatro botones "volver". → `ScreenHeader` + `IconButton` comunes.
- **F-12 · Medio · Formulario (12, 13)** — Aviso de privacidad ocupa ~30 % de la primera pantalla antes de cualquier campo; foto = miniatura recortada sin acción de cambiar; el selector de incidente usa `▼` de texto; los chips `choice` tienen `minHeight: 38` (< 44 pt); "dorado" (color) sin traducir dentro de UI en inglés (datos vs i18n: fuera del alcance visual, solo anotar). Positivo: en iOS el botón fijo "Submit report" queda sobre el teclado y el formulario hace scroll al campo (13) — **no regresar esto**; `ReportFormScreen` no debe perder esa mecánica.
- **F-13 · Medio · Cámara — permiso (06)** — La tarjeta blanca flota sobre negro vacío (70 % de la pantalla sin uso) y las píldoras de "View map/Staff login" asoman **detrás** de la tarjeta (recorte visible arriba). Dos acciones secundarias son enlaces de texto sin área definida. → Pantalla de permiso a pantalla completa con ícono de cámara, CTA y secundarios claros.
- **F-14 · Medio · Cámara — avisos (08, 09, 11)** — Mismo ámbar para foto rechazada y para "Retry scheduled" (cola); no se distinguen por tipo. El de cola (11) queda pegado a las píldoras superiores. Los dos rechazos (sin perro / borrosa) usan plantilla idéntica; en 09 el mensaje combina dos frases ("We did not detect a dog… The photo is blurry"). → `Banner` con variantes (advertencia/info/error) e ícono; DESIGN.md pide el toast en el tercio superior y anillo rojo para ataque.
- **F-15 · Medio · Command Center — tarjeta (15, 15-es1)** — Avatar "R" verde decorativo sin significado (¿R de "Reporte"?, no aporta); chips PENDING/Trust/Flags/Photo con peso visual idéntico; fecha mezcla idioma ("30–sep, 10:10 p.m." en UI inglesa: formato por locale); coordenadas de 5 decimales en bloque azul grande sin tabular-nums. Botones Approve/Hide/Delete con área ≥ 44 (OK). → `StatusBadge`, ícono por tipo de incidente en lugar de "R".
- **F-16 · Medio · Dashboard Asociación** (solo web/código) — Sin `fontFamily` en gran parte (cae a sistema/serif en web; `NOTAS_PASADA1`), `#005A25` en vez de primary, 33 hex; mini-labels 11 px. Contrato: tarjetas en móvil, tabla en ≥ 1280, ambos `testID`.
- **F-17 · Medio · Fuentes en web** — El fixture solo registra Jakarta 400/700; `SemiBold` (600) y textos sin `fontFamily` caen a serif en web (visible en `before/web`). En dispositivo la fuente sí carga (se ve Jakarta en todas las capturas), pero 600 vs 700 no se distingue bien. → Resolver con Paso 0 (nombres de familia únicos; actualizar fixture con aprobación).
- **F-18 · Medio · Botones, tarjetas y chips caseros** — `primaryButton/secondaryButton/backButton/adminButton/permissionButton` redefinidos por pantalla con minHeight 42/44/46/48 y radios 8/14/999; tarjetas con radios 12/14/16/18 y bordes `#E0E0E0` o `#C0C9BB`; backdrops `rgba(17,25,15,0.55/0.45/0.25)`. DESIGN.md: radios 16 (botones/cards) y 8 (inputs). → `AppButton`, `AppCard`, `AppTextField`, `Chip`.
- **F-19 · Medio · Tabulares** — Ningún `fontVariant: ['tabular-nums']`: conteos, métricas, fechas, coordenadas, contador `N/1000`. DESIGN.md pide Work Sans con `data-number`. → Estilo `type.number`.

### Bajo

- **F-20 · Bajo · Íconos** — Toda la iconografía es texto (`×`, `!`, `▼`, `⚑` en banderas, `C` del logo de login). → lucide.
- **F-21 · Bajo · Es/En** — `es.json` tiene `"title": "Command Center"` en inglés (cambiar el valor rompe specs que esperan solo `Cola de moderación`; decidir con equipo). Solo `language.spec.js` cubre inglés: etiquetas largas en es (dashboard, chips) sin prueba visual.
- **F-22 · Bajo · Código muerto** — `screens/ReportDraftScreen.js` (138 líneas, 12 hex) no se importa en ningún lado. No rediseñar; decisión del equipo.
- **F-23 · Bajo · Sin dark mode** — `userInterfaceStyle: "light"`; DESIGN.md define `surface-dark` pero sin requisito. Fuera de alcance salvo decisión.
- **F-24 · Bajo · Glassmorphism/pin** — DESIGN.md pide blur real, pin con ícono de perro y cluster `map-cluster-*`; hoy: fondo semitransparente sin blur, pin de gota con punto blanco (02: legible, orientación correcta), cluster con colores propios.

### Áreas táctiles (44 pt)

Cumplen: la mayoría de botones (≥ 44), Approve/Hide/Delete, obturador, `backButton` (minHeight 44 + `hitSlop`). Incumplen o por revisar: chips `choice` del formulario (38), `adminButton` de cámara (42), `×` de cierre del formulario (texto sin área explícita), "Mostrar" del login, enlaces de texto "View map"/"Staff login" de la pantalla de permiso (06), "Retry" del banner offline.

### Matriz de estados (loading / vacío / error / offline)

| Pantalla | Estados vistos | Falta ver |
|---|---|---|
| Login | default, loading, pending, no-back (web) | error de credenciales; teclado |
| Cámara | permiso, en vivo, validando, 2 rechazos, banner cola (dispositivo) | modelo no disponible (08b) |
| Mapa | clusters, pines, zona, pin, denuncia, offline (dispositivo); vacío/500 (web) | modal de cluster en dispositivo |
| Formulario | con foto, teclado (dispositivo); errores 400/500, cola (web) | texto grande (14) |
| Command Center | cola real (dispositivo); vacío/403/500 (web) | — |
| Configuración, Zonas, Duplicados, Asociación | todos los estados vía web | dispositivo real |

### Contraste calculado (WCAG, pasada 2)

| Par | Ratio | Veredicto |
|---|---|---|
| `#00450D` sobre `#F7FBF1` | 10.78 | AAA |
| `#005A25` sobre `#FFFFFF` | 8.44 | AAA |
| `#a51e1e` sobre `#FFFFFF` | 7.49 | AAA |
| `#5D6859` sobre `#FFFFFF` | 5.85 | AA |
| `#5D6859` sobre `#F7FBF1` | 5.58 | AA |
| `#ba1a1a` sobre `#ffdad6` | 5.00 | AA |
| Blanco sobre `#2E7D32` | 5.13 | AA |
| **Blanco sobre `#4CAF50` (cluster verde)** | **2.78** | **Falla** |
| **Blanco sobre `#F57C00` (pin naranja)** | **2.70** | **Falla** |
| Vidrio de cámara `rgba(18,18,18,.56)` | — | No medible (depende de la imagen) |

Los colores del cluster/pin son aproximados a partir de la captura; confirmar con los hex del código en el Paso 0.

## 2. Contrato intocable

Detalle completo en [`CONTRACT.md`](./CONTRACT.md) (regenerar si cambia un spec). Resumen de lo que más restringe el diseño:

- **Estructura**: Configuración con **exactamente 8 `<input>`** (la nota de cambio es `TextInput multiline` → `<textarea>`); sin desbordamiento horizontal a 390 y 1200 px; dashboard Asociación = tarjetas en móvil / tabla ≥ 1280, nunca ambos; foco al primer campo inválido; el desplegable de incidente no desplaza `report-sighting_type-solitario`; honeypot oculto con la técnica actual (`position:absolute; 1×1; opacity:0; left:-9999`, no `display:none`); nunca campos de identidad del reportante.
- **`testID`** por pantalla (cámara, cola, formulario `report-*`, mapa, asociación, `configuration-*`, `zone-*`, `duplicate-*`) y `id`/`nativeID` `report-<campo>`. Command Center **no tiene testID**: se prueba por texto/rol.
- **Roles con nombre (es)**: todos los botones/radios deben seguir con `accessibilityRole="button"|"radio"` y el nombre actual (p. ej. `Volver a cámara`, `Acercar`, `Cerrar` exacto, `Denunciar`, `Aprobar/Ocultar/Restaurar/Eliminar`, `Últimos 7 días`, `Calcular checksum`…). Los backdrops de sheets deben ser invisibles a accesibilidad (`accessible={false}`, `aria-hidden`) para no crear un segundo "Cerrar".
- **Textos**: llaves i18n existentes sin cambiar su valor (se pueden añadir llaves nuevas). Las métricas del Command Center: etiqueta + número como único contenido de la tarjeta.
- **Cluster**: diámetro `2·(18+30·min(1, ln(n)/ln(1000)))`, mín 36, máx 96; texto = N; `accessibilityLabel` "N reportes, gravedad X".
- **Comportamiento**: un solo envío con doble toque, reintento tras 500/offline, 401/403/sin sesión ocultan datos y controles, contador `N/1000`, CSV/XLSX deshabilitados sin datos, `canRetryNow` en el banner de cola.
- **Entorno de pruebas**: bundle con **esbuild** (`.web.js,.js,.jsx,.json`; sin `.ts/.tsx`), `.ttf` como archivo, `pageerror` = fallo, el fixture solo registra Jakarta 400/700.
- **Fuera de alcance**: `models/`, `hooks/`, `controllers/`, `dao/`, `db/`, `services/`, `supabase/`, llaves i18n existentes, navegación `useState` de `App.js`, `tests/` (cualquier cambio con aprobación). No añadir features ni Expo Router/NativeWind/Paper.

## 3. Orden de trabajo (simple → pesada)

Regla común: cada paso termina con `npx playwright test` en verde (base **90/90**), capturas "after" en `docs/redesign/after/…`, y un commit por paso. Sin mezclar con TD-133.

### Paso 0 — Fundaciones (antes de cualquier pantalla)

1. **Theme** (`theme/` en la raíz, sin `src/`; archivos `.js`): `colors` (consolida los 68 hex en tokens de DESIGN.md: `primary #00450D`, superficies, `danger-alert #D32F2F`, `map-cluster-*`, textos ≥ AA), `spacing` (4-pt: 4/8/12/16/20/24/32), `radius` (8/16/pill), `type` (rampa con mínimo 13 px, `number` con tabular-nums), `shadows`, `motion`. Un solo punto de entrada. Un literal que se repite dos veces es token.
2. **Tipografía y decisión Work Sans.** Hoy solo hay Plus Jakarta Sans; DESIGN.md exige Work Sans para labels y datos numéricos. **Recomendación: adoptarla** en 400/500/600 solo para `label`/`number` (metadatos, métricas, fechas, coordenadas), Jakarta para títulos y cuerpo. Coste: un paquete pequeño + actualizar el `@font-face` del fixture (cambio en `tests/`, requiere aprobación). Alternativa si no se aprueba: Jakarta con `fontVariant: tabular-nums` y reconocer la desviación de DESIGN.md. Resolver también 600/SemiBold (F-17).
3. **Íconos**: `lucide-react-native` (cerrar, flecha, chevron, ajustes, cámara, bandera, perro/patita, alerta, ubicación…), con una capa `Icon` propia para sustituir en un solo lugar.
4. **Componentes base** (`components/ui/`): `AppButton` (primary/secondary/ghost/destructive, sm/md/lg, estados pressed/disabled/loading, guard anti doble toque), `AppCard`, `AppTextField` (acepta `focus()`, `nativeID`, multiline), `Chip`/`StatusBadge`, `IconButton`, `ScreenHeader`, `Banner` (info/advertencia/error con ícono), `Sheet` + `Backdrop` (incluye KeyboardAvoidingView opcional y backdrop invisible a accesibilidad), `EmptyState`/`ErrorState`/`LoadingState`, `Metric`. Todos con `accessibilityRole` y `style` al final; sin wrappers de nativos que ya tienen diseño.
5. Criterio de salida: ninguna pantalla cambia todavía de aspecto salvo lo que reemplace 1:1; 90/90 y capturas web idénticas o mejoradas.

### Pantallas

| # | Pantalla | Líneas | Riesgo principal | Qué la protege |
|---|---|---|---|---|
| 1 | **Login** | 149 | F-03: arreglar teclado/botón cámara sin romper `Volver a cámara` | `login.spec` (4 estados) |
| 2 | **Configuración** | 200 | 8 inputs exactos, foco al primer inválido, sin overflow | `configuration.spec` |
| 3 | **ZoneSet** | 197 | `zone-*` testIDs, sin overflow, diálogos de salida | `zoneSet.spec` |
| 4 | **Duplicados** | 184 | foco en `duplicate-reverse-note`, roles dinámicos | `duplicateManagement.spec` |
| 5 | **Command Center** | 391 | métricas = valor+etiqueta; sin testID; F-06/F-15 | `commandCenter.spec` |
| 6 | **Dashboard Asociación** | 247 | tarjetas ↔ tabla, fechas, único spec en inglés | `associationDashboard`, `language` |
| 7 | **Mapa + Cámara** | 338 + 229 + sheets | MapLibre nativo no testeable en web; escala de cluster; roles de mapa | `publicMap*`, `reportForm` (cámara parcial) |
| 8 | **ReportForm** | 762 | la más pesada; honeypot, ids, posición del selector, botón fijo con teclado | `reportForm.spec` (alta) |

`ReportDraftScreen`: excluida (código muerto). Mapa/Cámara va casi al final porque dependen de verificación en dispositivo y de `Sheet`, `Banner`, gradientes y blur (los pasos 1–6 maduran los componentes base). Cada pantalla de dispositivo requiere captura "after" manual del usuario.

## 4. Dependencias recomendadas (no instaladas)

Verificar cada una con `npx expo install --check` y contra SDK 57 / RN 0.86 / React 19 **antes** de instalar; añadir alias/stub en `serve-configuration.mjs` si es nativa (cambio de test, con aprobación).

| Paquete | Veredicto | Justificación / costo |
|---|---|---|
| `@expo-google-fonts/work-sans` | **Sí** (si se aprueba Work Sans) | DESIGN.md la exige; se usa en pocas variantes. Fuentes `.ttf` ya soportadas por esbuild. Cambia el fixture de fuentes. |
| `lucide-react-native` + `react-native-svg` | **Sí** | Elimina íconos-texto (F-20). `react-native-svg` es módulo nativo gestionado por Expo; en web necesita alias a `react-native-svg` web (existe) o stub. Tree-shake por ícono. |
| `expo-haptics` | **Sí, opcional** | Obturador, enviar, aprobar: confirmación táctil al sol sin mirar la pantalla. No-op en web. Muy pequeño. |
| `expo-linear-gradient` | **Sí** | Scrims superior/inferior en la cámara (F-07), sin tocar la imagen. Módulo nativo estándar; stub en web (CSS gradient). |
| `expo-blur` | **Opcional / decidir** | Glassmorphism real de DESIGN.md; coste de rendimiento en Android y variación visual. Alternativa: scrim con gradiente (suficiente). Solo si se quiere fidelidad con DESIGN.md. |
| `moti` | **No por ahora** | Solo si se piden microanimaciones; añade dependencia sobre Reanimated. `Animated` de RN basta. |
| `@gorhom/bottom-sheet` | **No** salvo que se exijan gestos reales | Requiere `react-native-gesture-handler` + Reanimated (riesgo en web/esbuild y SDK 57). Los sheets actuales no se arrastran; un `Sheet` propio con backdrop cubre F-08. Si se quiere arrastre real (40/90 %), reevaluar. |

Ya presentes, no instalar: `expo-camera`, `@expo-google-fonts/plus-jakarta-sans`, `expo-constants`, `expo-location`, MapLibre.

## 5. Riesgos

1. **Compatibilidad SDK**: Expo SDK 57, RN 0.86, React 19.2, react-native-web 0.21. Toda librería nueva debe ser compatible con New Architecture y React 19; pinear versiones con `expo install`. Probar `react-native-svg` y `expo-blur` en dev build antes de generalizar.
2. **Pruebas en web (Playwright)**: el bundle usa esbuild con alias; módulos nativos (svg, blur, linear-gradient, haptics) necesitan alias/stub en `tests/ui/serve-configuration.mjs` y `configuration-entry.jsx` (cambios en `tests/`, requieren aprobación). Sin `.ts/.tsx`. Cualquier `pageerror` falla la suite. El fixture solo registra Jakarta 400/700.
3. **Contrato de roles/estructura**: reemplazar `Pressable` por componentes que pierdan `accessibilityRole`, o añadir un `<input>` (p. ej. buscador decorativo) rompe pruebas. Los nuevos botones deben conservar `Cerrar` único; backdrops invisibles a accesibilidad.
4. **Mapa nativo y cámara solo verificables en dispositivo**: MapLibre no renderiza en web; contraste de vidrio no medible sin captura; Android fuera de alcance por decisión del usuario (sin capturas ni verificación). Riesgo de regresión visual no detectada por las pruebas.
5. **Texto grande/Dynamic Type**: no verificado (captura 14 vacía); el rediseño puede romper la rejilla de chips y botones. Verificar antes de empezar el formulario.
6. **Teclado**: `ReportForm` hoy funciona bien en iOS (13); el rediseño no debe tocar la estructura `KeyboardAvoidingView` + botón fijo. Android (`padding` solo en iOS) no se verificará; `ReportFlagSheet` (TD-133) pendiente de comprobar en iPhone.
7. **Estado del árbol**: `docs/redesign/` y los cambios de TD-133 siguen sin commit en la misma rama de trabajo (`TD-133-JP-fix-sheets-mapa`); conviene commitear TD-133 y crear la rama de implementación del rediseño desde `main` + TD-133.
8. **Alcance**: tentación de arreglar datos/i18n (p. ej. `dorado`, `title: Command Center`) que están fuera de presentación o rompen specs.
9. **Fecha/locale**: formatos de fecha mixtos (`30–sep`, `8/10/2026`) vienen de `Intl`/locale; cualquier cambio de formato debe hacerse en la capa de presentación, no en `models/`.

## 6. Decisiones y pendientes para el usuario

1. ¿Adoptar **Work Sans** como en DESIGN.md (requiere tocar el fixture de pruebas)?
2. ¿Se aprueban cambios mínimos en `tests/ui/configuration-entry.jsx` y `serve-configuration.mjs` (fuentes, stubs de svg/blur/gradient) como parte del Paso 0?
3. Capturas pendientes (Android 16–18 y 20 descartadas): la **14 real** (texto grande al máximo) y reproducir **login con teclado** (F-03).
4. ¿`expo-blur` sí/no? ¿Sheets con gesto real (`@gorhom/bottom-sheet`) o solo mejorados?
5. ¿Dark mode dentro o fuera de alcance? ¿Borrar `ReportDraftScreen`? ¿Cambiar `title` de `es.json` (rompe specs)?
6. Confirmar en iPhone TD-133 (cierre al tocar fuera de denuncia/zona y teclado).

---
**Estado:** auditoría terminada. No se ha iniciado el rediseño. Espero aprobación.

## Estado al cierre de TD-134

Resumen por tema (no se re-verificó cada hallazgo `F-nn` uno por uno; las cifras de arriba son las de antes).

### Decisiones de la sección anterior

| Pregunta | Resultado |
|---|---|
| ¿Adoptar Work Sans? | **Sí.** Además se añadió **Fredoka** como voz de marca (títulos); ver [`../design/DESIGN.md`](../design/DESIGN.md) |
| ¿Cambios mínimos en `tests/ui/configuration-entry.jsx` y `serve-configuration.mjs`? | **Sí**, aprobados y registrados en [`CONTRACT.md`](CONTRACT.md) §7 |
| ¿Borrar `ReportDraftScreen`? | **No se tocó.** Sigue sin importarse en ningún archivo (código muerto); decisión del equipo |
| ¿Cambiar `title` de `es.json` ("Command Center")? | **No**: rompe pruebas; se conserva |
| ¿Modo oscuro? | **No se hizo** |

### Dependencias

| Paquete | Estado |
|---|---|
| `@expo-google-fonts/work-sans`, `@expo-google-fonts/fredoka` | Instaladas |
| `lucide-react-native`, `react-native-svg` | Instaladas (íconos, degradados de cámara con `Scrim`, silueta del pin) |
| `expo-haptics`, `expo-linear-gradient`, `expo-blur`, `moti`, `@gorhom/bottom-sheet` | **No se instalaron:** los degradados usan `react-native-svg`, no se adoptó desenfoque, no hay animaciones que lo requieran y las hojas son propias (`Sheet`, `SheetHost`) |

### Qué cambió, por tema

- **Sistema (F-01, F-18, F-19):** existe `theme/` con tokens únicos (un solo verde primario), `components/ui/` con los componentes base y cifras tabulares donde hay datos. Un solo catálogo de íconos (`Icon`).
- **Contraste del mapa:** clusters, pines y etiquetas usan `colors.severity` (rojo `#b71c1c`, naranja `#a64b00`, verde `#2e7d32`), con texto blanco ≥ 4.5:1. Se descartaron los `#F57C00`/`#43A047` de la primera versión de `DESIGN.md`.
- **Login:** el botón "Volver a cámara" ya no se va con el teclado (enlace fijo fuera del scroll).
- **Alertas falsas:** las métricas de Command Center solo se tiñen si valen más de cero.
- **Cámara, Mapa, Formulario, Command Center, Configuración, Zonas, Duplicados, Asociación, Login:** rediseñados; las reglas y lo rechazado están en [`TASTE.md`](TASTE.md).
- **Lecciones técnicas que la auditoría no podía ver** (solo se manifiestan en el teléfono): `StyleSheet.absoluteFillObject` no existe en RN 0.86 y dejaba los overlays en el flujo normal; iOS no puede apilar modales; una `View` transparente o con `aria-hidden` no recibe el toque exterior. Ver reglas 34 a 37 y 46 de `TASTE.md`.

### Sigue abierto

- **Texto grande (accesibilidad) no verificado**: la captura 14 de la pasada 1 era idéntica a la 13.
- **Android y capturas manuales en español**: fuera del alcance de TD-134.
- **Mapa nativo real** (clusters, enfoque, pin): solo se valida en dispositivo.
- **Modo oscuro**: no existe.
- **`ReportDraftScreen`**: código muerto.

