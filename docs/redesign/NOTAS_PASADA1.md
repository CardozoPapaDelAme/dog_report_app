# Notas de trabajo de la pasada 1 (insumo para AUDIT.md; no es la auditoría)

> **Histórico:** mediciones del código **antes** del rediseño. Casi todo lo que describe como carencia (theme compartido, Work Sans, íconos, componentes base, pin con perro, sheets) ya existe; ver [`TASTE.md`](TASTE.md) y [`../design/DESIGN.md`](../design/DESIGN.md).

Datos medidos con grep sobre `screens/`, `components/`, `App.js` (2026-10-13). Criterio: skill `mobile-design-review` (checklist de greps) y `expo-design-system` (deriva de tokens); sin apoyo de `design-taste-frontend`/`frontend-design`, por indicación.

## Sistema de diseño
- **No existe theme compartido.** Cada archivo define su propio `const colors = {…}` (13 definiciones) y su `StyleSheet.create` (19 archivos).
- 249 usos de hex literal, **68 hex distintos**; los más repetidos: `#FFFFFF`×28, `#005A25`×16, `#191D17`×15, `#5D6859`×14, `#00450D`×14. Dos verdes primarios conviven (`#00450D` = DESIGN.md `primary`, `#005A25` en dashboard Asociación y otros).
- Tokens de DESIGN.md existentes pero no usados como tales: `danger-alert #D32F2F`, `map-cluster-*`, `surface-container-*`. Se usan `#a51e1e`, `#ba1a1a`, `#ffdad6` ad hoc.
- Radios: 12(29), 14(25), 999(12), 8, 16, 18, 10, 22, 21, 20, 9, 6, 5… (≥ 20 valores). DESIGN.md: 16 (cards/botones), 8 (inputs), pill.
- Espaciado: 12, 16, 10, 14, 8, 20, 18 — gutter DESIGN.md 16/margen 20; 10/14/18/13 rompen la rejilla de 4.
- Tipografía: solo Plus Jakarta Sans (400/600/700) hardcodeada por nombre en 18 archivos. **Work Sans no existe** en el proyecto (DESIGN.md la exige para labels y `data-number`). Tamaños: 28 valores distintos; **10 px (4) y 11 px (15)** y 12 px (33) son muy pequeños para uso al sol.
- Sin `fontVariant: tabular-nums` en ningún lado (conteos, métricas, fechas).
- Sin `allowFontScaling`/`maxFontSizeMultiplier` (usa el default: escala); no se ha verificado el reflow (ver captura 14).
- Sin íconos: toda la iconografía es texto (`×`, `!`, `▼`, `C` en logo de login). No hay librería de íconos.
- Sin modo oscuro (`userInterfaceStyle: "light"`); DESIGN.md define `surface-dark` pero no hay requisito de dark mode → decisión pendiente.
- Fuentes en web: las pruebas solo registran 400 y 700; `PlusJakartaSans_600SemiBold` y los textos sin `fontFamily` caen a **serif del navegador** (visible en "Zoom 13", "Motivo", etiquetas de métricas, chips) → en dispositivo se vería sistema/otra fuente: **inconsistencia real** a confirmar con capturas nativas.

## Componentes caseros repetidos
- Botones: `primaryButton`/`secondaryButton`/`backButton`/`adminButton`/`permissionButton` redefinidos por pantalla (minHeight 42/44/46/48, radios 8/14/999). Ningún `<Button>` compartido. 76 `Pressable`, 0 `TouchableOpacity`.
- Modales/sheets: backdrops `rgba(17,25,15,0.55)`, `0.45`, `0.25` repetidos (DuplicateManagement, ZoneSet, associationDatePicker, PublicMapScreen) con radios 20/22. Patrón "Web Modal" centrado en vez de sheet.
- Tarjetas: cada pantalla define su propia (radios 12/14/16/18, borde `#E0E0E0` o `#C0C9BB`).
- Chips/estado ("PENDIENTE", "Oculto", tipo de incidente) sin componente común.
- Error/vacío/cargando: hay `ActivityIndicator` en 12 archivos y banners de error con estilos propios por pantalla; estados cubiertos en general, pero sin patrón visual único.

## Áreas táctiles (44 pt)
- La mayoría de botones ≥ 44, pero: `choice` del formulario `minHeight: 38`; `adminButton` de cámara `minHeight: 42`; `closeText` ×; chips/"Mostrar" del login por revisar. 48 declaraciones `minHeight 44+`/`hitSlop`.

## Contraste y sol
- Ratios de contraste **aún no calculados** (pendiente para la pasada 2, con `#5D6859`/`#61705E` sobre `#F7FBF1` y los placeholders). Botones de vidrio de cámara `rgba(18,18,18,0.56)` dependen de la imagen: **no medible sin captura nativa** (filas 7, 20). Etiquetas de 10–11 px en gris sobre cards son el riesgo mayor.

## i18n/consistencia es–en
- `es.json` tiene `"title": "Command Center"` en inglés (la llave existe; no se puede cambiar sin riesgo para pruebas que ya esperan `Cola de moderación` solamente; verificar si algún spec depende del título). Etiquetas largas en es empujan botones (a revisar en en/es del dashboard).
- Solo `language.spec.js` (1 prueba) cubre inglés.

## Estructura / código muerto
- `screens/ReportDraftScreen.js` (138 líneas, 12 hex) **no se importa en ningún lado** (sin pruebas) → no rediseñar; decidir con el equipo.
- `ReportFormScreen.js` (762 líneas, 34 hex, 28 `fontFamily`) y `CommandCenterScreen.js` (391) son los más pesados; `associationDashboardScreen.js` (33 hex) es el segundo más inconsistente (no usa `fontFamily` → ver capturas: usa fuente del sistema/serif en partes).

## Contra DESIGN.md (resumen)
- Cumple: verde primario `#00450D`, fondo `#F7FBF1`, Plus Jakarta Sans, botón de captura circular con anillo verde, radios ~16 en cards de admin, dashboard con tarjetas blancas + borde, toast ámbar de validación.
- No cumple: Work Sans ausente; sin glassmorphism real (solo fondo semitransparente, sin blur); sin grabber en sheets ni alturas 40/90 %; sin pin con ícono de perro (pin de gota sin ícono); cluster con colores propios en vez de `map-cluster-*`; sin chips "Ataque" en `danger-alert` consistentes; sin captura con anillo que pulse en rojo para ataque; botones y radios no sigue 16/8; gutter 16/margen 20 sin sistema.
