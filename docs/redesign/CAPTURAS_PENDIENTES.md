# Capturas pendientes (solo lo que Playwright/web no pudo mostrar)

**Guárdalas en:** `docs/redesign/before/manual/` con el **nombre de archivo exacto** de la última columna. PNG de pantalla completa del dispositivo (captura nativa, sin recortar ni marcos). Cuando estén, avísame y hago la pasada 2.

**Ya renderizado en web (no lo pidas):** login (4 estados), cámara (stub con permiso), formulario (sin foto, foto + color detectado, errores 400/500, guardado para sincronizar), cola de borradores (pendiente/sincronizada/terminal), mapa web (clusters, modal, zona, pin, denuncia, vacío, error, offline), fallback Expo Go, dashboard Asociación (móvil/desktop/vacío/cargando/error/picker), Command Center, Configuración, Zonas, Duplicados — en es y en, en `before/web/{es,en}/`.

Limitación del arnés web: en `?map` los sheets (zona, pin, denuncia) salen **recortados** a ~244 px porque el contenedor del fixture no ocupa el alto del teléfono; por eso las filas 3, 4 y 5 piden el mapa real. Las pantallas de administrador se vieron con una barra amarilla "Demo local" del fixture que no existe en la app.

Orden = prioridad (1 es lo que más necesito). Idioma por defecto **es**; el dispositivo debe estar en español salvo donde diga *en*. Dispositivo base: iPhone (el que uses a diario). Android solo donde la plataforma cambia el diseño.

| # | Pantalla | Estado exacto | Plataf. | Idioma | Qué necesito tener cargado | Pregunta de diseño que responde | Archivo |
|---|---|---|---|---|---|---|---|
| 1 | Mapa (MapLibre nativo) | Mapa real con clusters de 1, 5 y 20+ reportes (si no hay tantos, los que haya, anota cuántos) | iOS | es | Dev build + backend de staging con reportes públicos visibles (ver §A) | ¿Cómo se ve la escala de cluster (36–96 px), su color por severidad y el contraste sobre los tiles reales? ¿Dónde flotan controles Acercar/Alejar? | `01_mapa_clusters_ios_es.png` |
| 2 | Mapa (MapLibre nativo) | Zoom ≥ 17 con pines individuales (varios incidentes) | iOS | es | Igual que #1; acerca hasta que "Zoom 17+" muestre pines | ¿Legibilidad del pin (forma de gota, color por incidente) sobre el mapa? ¿Pines vs. etiquetas de calles? | `02_mapa_pines_zoom17_ios_es.png` |
| 3 | Mapa | Bottom sheet de **zona** abierto (lista de reportes de la zona) sobre el mapa real | iOS | es | Toca un cluster → "Ver reportes de la zona" | ¿Altura/arrastre del sheet (DESIGN.md: 40 %/90 %), relación con el mapa y safe area inferior? | `03_mapa_sheet_zona_ios_es.png` |
| 4 | Mapa | Sheet de **detalle de pin** con reporte marcado por la comunidad (aviso "La comunidad marcó este reporte") | iOS | es | En la lista de zona toca un reporte con banderas | Jerarquía del detalle, chip de tipo, ubicación de "Denunciar" | `04_mapa_sheet_pin_marcado_ios_es.png` |
| 5 | Mapa | Sheet de **denuncia** (motivo + detalle) con el **teclado abierto** | iOS | es | Desde #4 toca "Denunciar", elige "Otro" y toca el campo de detalle | ¿El teclado tapa "Enviar denuncia"/contador? ¿Cómo se acomoda el sheet? | `05_mapa_sheet_denuncia_teclado_ios_es.png` |
| 6 | Cámara | Permiso de cámara **denegado/pendiente** (tarjeta "Permite el acceso a la cámara") | iOS | es | Ajustes → app → Cámara desactivada (o reinstala la app) | Primera impresión de la app sin cámara: ¿tarjeta blanca sobre fondo oscuro, botones secundarios (mapa, personal)? | `06_camara_permiso_denegado_ios_es.png` |
| 7 | Cámara | Cámara **en vivo** con permiso (barra superior + "Reportar sin foto" + obturador), exterior con sol si puedes | iOS | es | Permiso concedido; apunta a un perro/escena real; idealmente a la luz del día | ¿Contraste de botones de vidrio (fondo 56 % negro) y obturador sobre imagen real y con sol? | `07_camara_en_vivo_ios_es.png` |
| 8 | Cámara | Toast de rechazo: **"No detectamos un perro en la foto."** | iOS | es | Toma una foto de una pared/objeto (el modelo ML debe cargar; ver §B) | Posición/estilo del toast ámbar (DESIGN.md: tercio superior), legibilidad sobre cámara | `08_camara_foto_rechazada_sin_perro_ios_es.png` |
| 9 | Cámara | Toast de rechazo: **"La foto está borrosa."** | iOS | es | Toma una foto de un perro moviendo la cámara con fuerza | ¿Se distingue visualmente de #8 (misma plantilla)? ¿Texto largo en es? | `09_camara_foto_rechazada_borrosa_ios_es.png` |
| 10 | Cámara | Estado **validando** ("Validando foto…" con spinner) | iOS | es | Toma una foto y captura la pantalla de inmediato (graba pantalla y saca un fotograma si hace falta) | Contraste del indicador sobre la imagen congelada | `10_camara_validando_ios_es.png` |
| 11 | Cámara + cola | Banner de cola de borradores sobre la **cámara en vivo** (p. ej. "Reportes guardados para sincronizar") | iOS | es | Modo avión → envía un reporte sin foto → vuelve a la cámara (ver §C) | ¿El banner choca con la barra superior de botones? ¿Se lee sobre imagen en vivo? | `11_camara_banner_cola_ios_es.png` |
| 12 | Formulario de reporte | Con **foto real adjunta** (miniatura/estado) y color detectado, arriba del formulario | iOS | es | Acepta una foto de perro válida desde la cámara | ¿Cómo se muestra la foto en el encabezado? (en web solo hay "Sin foto"/"Foto adjunta") | `12_formulario_con_foto_ios_es.png` |
| 13 | Formulario de reporte | **Teclado abierto** sobre un campo de texto (descripción) con el botón "Enviar reporte" fijo | iOS | es | Elige "Avistamiento", toca "Descripción" | ¿El botón fijo y el teclado se superponen? ¿Hay scroll al campo? | `13_formulario_teclado_ios_es.png` |
| 14 | Formulario de reporte | Texto grande (Ajustes → Accesibilidad → Tamaño de letra: el máximo) en el formulario completo | iOS | es | Cambia el tamaño de letra del sistema, abre "Reportar sin foto" | ¿Se rompe la rejilla (chips "Sí/No/No sé", etiquetas largas) con fuentes grandes? Hoy no hay `allowFontScaling` ni límites | `14_formulario_texto_grande_ios_es.png` |
| 15 | Command Center (Admin) | Cola de moderación con sesión real (cabecera verde + métricas + tarjetas) en teléfono con notch/isla | iOS | es | Inicia sesión con cuenta Administrador (§D) | Safe area superior real, cabecera verde y su relación con la barra de estado (StatusBar es `light`) | `15_commandcenter_cola_ios_es.png` |
| 16 | Cámara | Misma cámara en vivo (#7) en Android | Android | es | `npm run app:android`, permiso concedido | Diferencias de barra de estado/gesto, fuentes (Jakarta) y sombras/elevación en Android | `16_camara_en_vivo_android_es.png` |
| 17 | Mapa (MapLibre nativo) | Mapa con clusters (#1) en Android | Android | es | Igual que #1 en Android | Render de cluster/tipografía/atribución en Android | `17_mapa_clusters_android_es.png` |
| 18 | Formulario de reporte | Formulario con teclado abierto (#13) en Android | Android | es | Igual que #13 | `adjustResize` vs. botón fijo; barra de navegación inferior | `18_formulario_teclado_android_es.png` |
| 19 | Mapa (MapLibre nativo) | Mapa vacío o con error en dispositivo (aviso "No pudimos cargar el mapa" / sin conexión) sobre el **mapa base real** | iOS | es | Modo avión con la app abierta en el mapa (§E) | ¿El banner de error/offline se lee sobre tiles reales o sobre fondo en blanco? | `19_mapa_offline_ios_es.png` |
| 20 | Cámara | Cámara en vivo en **inglés** (comprueba longitud de textos "Reportar sin foto"/"Staff login") | iOS | en | Idioma del iPhone en inglés; permiso concedido | ¿Los botones de vidrio soportan textos más largos en en? | `20_camara_en_vivo_ios_en.png` |

No pido: modo oscuro (la app declara `userInterfaceStyle: "light"` en `app.json`), pantallas de admin en Android, ni capturas ya cubiertas en web.

## Cómo provocar cada estado

**§A — Mapa con clusters/pines (filas 1–5, 17).** `npm run app:ios` (dev build, no Expo Go: en Expo Go solo sale el fallback de lista). El mapa usa `GET /public/clusters` y `/public/reports` del backend de `EXPO_PUBLIC_API_BASE_URL` (ver README "Setup checklist"). Necesitas reportes **aceptados y visibles** dentro de la zona de Creel (sin geocerca activa no se aceptan): crea reportes desde la app y espera a que pasen a visibles, o usa datos de staging que ya tengas. Para clusters de distinto tamaño, necesitas reportes cercanos entre sí (≈1, 5, 20+). Si no los puedes generar, dime y diseño con el cluster stub (`?native-map-clusters` ya muestra 1, 2, 7, 100, 1000, 5000) y lo marco como riesgo.
Pines: acerca con el botón "Acercar" hasta que el indicador diga Zoom 17.

**§B — Foto rechazada (filas 8–9).** El modelo TFLite debe estar versionado en el build; si ves "Falta versionar el archivo TFLite…" o "El modelo todavía no está listo…", captura ese toast también y envíalo como `08b_camara_modelo_no_disponible_ios_es.png`. Sin perro: apunta a una pared. Borrosa: mueve el teléfono durante el disparo con un perro (o imagen de perro en otra pantalla).

**§C — Banner de cola (fila 11).** Activa modo avión → cámara → "Reportar sin foto" → llena el mínimo → "Enviar reporte" (queda "Reporte guardado para sincronizar") → vuelve a la cámara. El banner aparece arriba. Capturas antes de reactivar la red.

**§D — Cuenta Administrador (fila 15).** Las cuentas se aprovisionan manualmente (no hay registro). Usa la que ya tengas (Acceso de personal → inicia sesión → te lleva a moderación). Si no hay reportes en la cola, la pantalla estará vacía: dímelo y la tomamos igualmente.

**§E — Mapa sin conexión (fila 19).** Abre el mapa con red, espera a que cargue, activa modo avión, mueve/acerca el mapa para disparar nueva carga y captura el aviso.

Si alguna fila no se puede reproducir, deja una nota en `before/manual/NOTAS.md` con el número y qué viste; yo ajusto la auditoría con lo disponible.
