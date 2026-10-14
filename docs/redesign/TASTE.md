# Taste: lo que se aprobó y se rechazó, y las reglas que salen de ello

> **Estado:** documento vivo, actualizado con el estado real de la rama `TD-134-JP-rediseno-paso0`. Está en orden cronológico por pantalla; cuando una regla posterior corrige a una anterior, la anterior lo dice. **Las reglas vigentes de cada pantalla son las de su sección "vigente" y las numeradas más recientes.** El sistema visual de referencia está en [`../design/DESIGN.md`](../design/DESIGN.md) y el contrato de pruebas en [`CONTRACT.md`](CONTRACT.md).

![Antes y ahora del Login](after/login_antes_vs_ahora.png)

Capturas web en español (`before/web/es/login_default.png` y `after/web/es_login_default.png`). El Login se rediseñó en 6 iteraciones; este documento resume qué se rechazó, qué se aceptó y qué reglas se derivan. Los commits están en la rama `TD-134-JP-rediseno-paso0`.

## Antes → ahora

| | Antes | Ahora |
|---|---|---|
| Composición | Pantalla clara, todo apilado y alineado a la izquierda | Pantalla completa en verde de marca, título arriba, formulario al alcance del pulgar |
| Identidad | Cuadro verde con una "C" | Rastro de huellas que sube hacia la derecha, con las puntas hacia arriba |
| Tipografías | Fuente de sistema (el login no declaraba `fontFamily`) | Tres a la vez: Fredoka (título y botón), Plus Jakarta Sans (texto), Work Sans (etiquetas) |
| Acción principal | Botón verde, 12 px de radio, deshabilitado = verde pálido | Botón amarillo pelota `#e9e600` con texto verde oscuro, 12 px de radio |
| Campos | Blancos sobre fondo claro | Verde profundo `#0a3a12` con borde claro, 8 px de radio |
| "Volver a cámara" | Píldora arriba que el teclado sacaba de vista | Enlace con flecha, fijo arriba fuera del scroll |
| Teclado | El formulario se apretaba | El título se compacta y las huellas se ocultan |
| Texto pequeño | 13 px en gris | Etiquetas 13 px en Work Sans, contraste ≥ 8:1 |

## Lo que se rechazó, y por qué (en palabras del usuario)

1. **Limpieza con la misma composición** ("la neta se ve igual, ocupaba un cambio más radical"): cambiar fuente, colores y componentes sin tocar la composición no cuenta como rediseño.
2. **Encabezado verde con hoja clara redondeada** ("sigue teniendo este ai-slop feeling"): se lee como plantilla genérica.
3. **Tipografía condensada tipo señalética, curvas de nivel y amarillo fosforescente** ("así parece algo militar o muy de montañas"): la app es de perros, no de senderismo.
4. **Formulario pegado abajo, luego demasiado arriba, luego "un poco más abajo"**: el formulario va en la mitad superior-media, no anclado al fondo.
5. **Esquinas muy redondas en botones** ("las curvas de los botones, que sea menos agresiva").
6. **Espacio vacío abajo** ("abajo se ve muy vacío"): no se deja un hueco sin intención.

## Reglas para las siguientes pantallas (1 a 12, del Login; siguen vigentes salvo lo que corrijan las posteriores)

1. **Recomponer, no solo reestilizar.** Cada pantalla debe cambiar su estructura visual, no solo su paleta o fuente.
2. **Verde de marca a pantalla completa en las pantallas de entrada** (Login y similares). Las pantallas de trabajo con muchos datos (Configuración, Zonas, Duplicados, Asociación, Command Center) usan cabecera verde y cuerpo claro, con el mismo vocabulario: Fredoka en títulos, huella grande de fondo, amarillo para la acción principal. *Confirmado con las pantallas de datos.*
3. **Varias tipografías en una misma pantalla, cada una con rol fijo:** Fredoka = títulos, números protagonistas y botón principal; Plus Jakarta Sans = texto corrido; Work Sans = etiquetas, números de datos, enlaces pequeños (ver regla 38).
4. **Que se note que es de perros.** Huellas como motivo recurrente (rastro, fondo, estados vacíos), puntas hacia arriba. Nada que lea como militar, montaña, señalética ni corporativo frío.
5. **Esquinas moderadas:** botones 12 px, campos 8 px, tarjetas 16 px. Evitar píldoras salvo chips y el obturador.
6. **Amarillo `#e9e600` solo para la acción principal** de la pantalla (una por pantalla). El resto de la acción en blanco, borde o verde.
7. **Sin huecos sin intención:** si queda espacio, se llena con el motivo de marca (rastro de huellas) o se reparte la composición. Nunca un bloque vacío.
8. **Posición del contenido:** el formulario o la acción principal en la zona media, al alcance del pulgar, ni pegada arriba ni al fondo.
9. **Teclado:** el encabezado se compacta y los adornos desaparecen mientras se escribe; los botones de salida (volver) nunca salen de vista.
10. **Contraste mínimo 4.5:1** en todo texto, 7:1 o más donde se pueda (uso al sol). Los estados deshabilitados se diferencian por forma/transparencia, no solo por opacidad.
11. **Sin eyebrows en mayúsculas ni insignias decorativas.** Se eliminó "PANEL PRIVADO" y la "C" del logo.
12. **Se mantiene el contrato:** testIDs, roles con nombre, textos y llaves i18n, 8 inputs de Configuración y sin desbordamiento horizontal (ver `CONTRACT.md`).

## Configuración (pantalla de datos): lo que se aprobó y lo que se rechazó

Primer intento (rechazado: "las huellas siguen amontonadas, el layout no me gusta, los botones se ven feos, se sigue viendo ai-slop"): encabezado verde con rastro de seis huellas, cada sección con un círculo con ícono, campos apilados todos iguales, barra inferior con dos botones lado a lado, uno translúcido.

Segundo intento (aprobado: "perfecto"), commit `48c404c`:
- **Un solo motivo grande, no un patrón repetido:** una huella enorme recortada en la esquina del encabezado, muy tenue. El rastro de huellas queda solo para pantallas con espacio vacío (Login).
- **Listas agrupadas en vez de campos apilados:** cada ajuste es una fila con nombre, rango y ayuda a la izquierda y el **número grande a la derecha** (Work Sans 24, verde claro). Menos scroll, se lee como tablero.
- **Títulos de sección grandes en Fredoka, sin círculos con ícono ni numeración "01, 02".**
- **Dato principal destacado:** la versión activa en amarillo, grande, en el encabezado.
- **Barra inferior con una sola acción amarilla** en una línea. La acción secundaria (recargar) pasa a **botón de ícono con borde y nombre accesible**, no a un segundo botón de texto.
- **Fondo claro para el cuerpo y verde de marca para encabezado y barra:** confirma la regla 2 para pantallas de datos.
- **Hojas inferiores en lugar de modales centrados** (descartar cambios).

### Reglas añadidas (13 a 18)

13. **Un solo elemento memorable por pantalla.** El resto sobrio. Si hay un motivo de marca (huella), que sea uno grande o un rastro con aire, nunca varios pequeños apretados.
14. **Evitar patrones repetidos de plantilla:** círculo con ícono en cada sección, tarjetas idénticas apiladas, numeración sin secuencia real.
15. **Para listas de ajustes: filas con el valor grande a la derecha** y separadores finos dentro de un contenedor agrupado.
16. **Una sola acción amarilla por barra o pantalla;** las demás, de ícono con borde o enlace. Sin botones translúcidos sobre verde.
17. **Los botones de acción principal caben en una línea** (verificar con el texto más largo en español).
18. **Revisar cada estado en captura** (cargando, sin acceso, error, campo inválido, escritorio) antes de dar la pantalla por buena.

## ZoneSet (aprobada, commits `2d6b16c` y `7d74a9d`)

- **Flujo en pasos = ruta con línea vertical y puntos** (rellenos en el paso en curso, atenuado el que espera). La numeración "01 · / 02 ·" solo se usa porque es una secuencia real.
- **Datos técnicos largos (URI, ID, huella digital) en lista agrupada y plegados detrás de "Ver detalles"**; a la vista solo lo esencial en una línea. El contenido plegado sigue en el DOM (display none), por el contrato.
- **Una acción amarilla en la barra inferior que cambia con el paso** (Guardar borrador, luego Activar esta versión).
- Mismo encabezado verde con una huella grande recortada que Configuración.

### Reglas añadidas (19 a 21)

19. **Plegar lo secundario:** si un bloque informativo empuja la tarea principal fuera del primer vistazo, se resume en una línea con un control "Ver detalles".
20. **Pasos reales = ruta con puntos y línea;** pasos inexistentes no se numeran.
21. **La barra inferior verde lleva la acción principal de la pantalla** y cambia de texto según el estado, en lugar de repetir botones dentro del contenido.

## Duplicados (aprobada, commits `1d5fc62` a `3560da5` y el de conexiones)

- **Comparar es mejor lado a lado que apilado:** cada sugerencia es una tira horizontal deslizable de tarjetas con los mismos datos en el mismo lugar; la tira llega al borde de la pantalla para que se note que se desliza.
- **Un control debe decir lo que hace:** el círculo suelto de "canónico" se rechazó; ahora es una píldora con la palabra "Canónico" que se llena al elegirla.
- **Paginar listas largas** (3 por página) con el `Pager` reutilizable; la selección persiste entre páginas.
- **Datos técnicos en bruto (pares de ID con distancia y tiempo) se resumen en una línea** ("N conexiones · hasta X m · hasta Y min") que se despliega a una tabla alineada, ordenada de la más cercana a la más lejana. Con plural correcto (`_one` / `_other`).
- **Panel de decisión verde oscuro con el único botón amarillo.**

### Reglas añadidas (22 a 25)

22. **Si la tarea es comparar, las opciones van en horizontal y alineadas;** si es leer, en vertical.
23. **Nada de iconos o controles sin palabra** cuando su función no es obvia (el radio solo).
24. **Los datos crudos se resumen y se pliegan;** el detalle se despliega a demanda, en columnas alineadas con cifras tabulares.
25. **Las cantidades llevan plural correcto** ("1 conexión", "2 conexiones") con las formas `_one` y `_other` de i18n.

## Command Center (cola de moderación)

Recorrido histórico (lo rechazado):
1. **Tarjetas con borde, chips de colores, bloque azul de ubicación y tres botones con marco** ("las tarjetas se siguen viendo muy ai-slop").
2. **Filas de bandeja pegadas, con barra lateral de gravedad:** se fundían en un solo bloque. La tarjeta redondeada con banda de color también se rechazó como plantilla.
3. **Cabecera "sobria" sin identidad** (sin huella, tres columnas iguales, todo en Plus Jakarta): "se ve peor, no tiene identidad y se ve super AI-slop". Quitar elementos no es rediseñar; sin la huella perdió lo que lo hacía reconocible.
4. **Tres tamaños de número distintos** y **tres columnas iguales** ("se ve feo"): ninguna de las dos funcionó. El botón "Aprobar" relleno y más grande tampoco ("no me gusta que se vea más grande").

### Vigente (aprobado)

- **Encabezado verde con la huella grande de fondo** (tenue, recortada a la derecha), título en Fredoka y botón de cerrar sesión de ícono en la misma línea.
- **Resumen en dos tamaños, centrado entre sí:** "En esta página" como número grande a la izquierda; a la derecha, "Prioridad alta" arriba y "Con banderas" debajo, **del mismo tamaño**. Los dos de la derecha se tiñen de rosa solo si valen más de cero (sin falsa alarma). La jerarquía se lee por orden y color, no por un tercer tamaño.
- **Barra de herramientas** (duplicados, zonas, umbrales) bajo el resumen: ícono blanco y etiqueta, tres celdas separadas por líneas finas, sobre una banda ligeramente más oscura. Sin mosaicos, sin íconos amarillos.
- **Cada reporte, una tira a todo el ancho** con líneas arriba y abajo y hueco de fondo claro entre una y otra, sin esquinas redondeadas.
- **El pin del mapa (`PinGlyph`) es la marca de cada reporte**, del color de su gravedad, gris si está oculto y con insignia ámbar si tiene banderas. El mapa y la cola hablan el mismo idioma.
- **Nombre del incidente en Fredoka**, fecha en gris y estado ("Pendiente", "Oculto") en texto neutro; el rojo queda para banderas y para lo grave.
- **Señales solo si existen:** la confianza siempre (traducida: baja, media, alta), "Banderas: N" solo si hay y "Foto: Sí" solo si la tiene. Sin "Banderas: 0", sin barras `|`.
- **Coordenadas como texto tabular**, sin ícono (el pin ya dice que es un lugar) y **sin código interno del reporte** (los últimos seis caracteres del UUID no significan nada para quien modera).
- **Acciones como barra plana de tres celdas iguales** con texto de color: Aprobar (verde), Ocultar/Restaurar (tinta o verde), Eliminar (rojo).
- **Carga con esqueleto** de dos tarjetas (nunca solo un indicador de actividad) y `role="progressbar"` con la etiqueta de carga.

### Reglas añadidas (26 a 30, vigentes; la 30 corrige a la anterior)

26. **Las listas de elementos de decisión van como filas de bandeja** (a todo el ancho, con separadores) y no como tarjetas apiladas.
27. **Las acciones por fila van como barra plana con texto de color,** no como botones con marco, y **todas del mismo tamaño**: el peso lo da el color, no el ancho ni un relleno.
28. **Las acciones globales (cerrar sesión) viven en la barra del título,** no flotando solas.
29. **Separar elementos de una lista con huecos de fondo y bordes finos, no con color de cabecera ni esquinas redondeadas.**
30. **Cada elemento repetido se identifica por su contenido y su marca visual** (tipo de incidente, fecha, pin de gravedad), **nunca por un código interno** (fragmentos de UUID, números sin significado). *Corrige la versión anterior, que pedía un número corto visible.*

### Reglas añadidas (38 a 42)

38. **En pantallas de operación Fredoka se usa con medida:** título de pantalla, número protagonista, nombre del elemento y títulos de sección. Texto corrido y acciones en Plus Jakarta Sans; etiquetas y datos en Work Sans. *Corrige la primera versión de esta regla ("solo el título"), que dejaba la pantalla sin identidad.*
39. **La huella grande de fondo es la identidad de toda cabecera verde** (Command Center, Configuración, Zonas, Duplicados, Asociación) y debe verse **completa**, no asomar por debajo de la cabecera. Un solo motivo, nunca varios pequeños.
40. **Un color con significado por acción:** aprobar en verde, eliminar en rojo, lo demás en tinta; el amarillo queda para la acción principal y no para íconos.
41. **Cifras de resumen: como máximo dos tamaños** (uno protagonista y el resto iguales), centrados entre sí. Tres tamaños distintos o tres columnas idénticas se rechazaron.
42. **Mostrar las señales por presencia, no por ausencia:** nada de "Banderas: 0" ni "Foto: No" en cada elemento; valores de datos traducidos al idioma de la pantalla.

## Formulario (rehecho tres veces)

- **v1:** foto como encabezado grande con el título encima. Rechazado: título apretado, foto recortada y desenfocada, "muy ai-slop".
- **v2:** foto limpia con el título debajo. Rechazado: la foto sigue gastando casi 300 px y todo sigue siendo filas de botones iguales.
- **v3 (vigente):** encabezado compacto con el título y la **foto como miniatura a la derecha que se abre a pantalla completa** (idea del usuario). Preguntas cortas como **control segmentado** (una sola pieza), color como **fila de círculos con el color real del pelaje** (el nombre del elegido junto a la etiqueta), tamaño con huellas crecientes. Sin título de sección para una sola pregunta.

### Reglas añadidas (31 a 34)

31. **Una foto de evidencia es una miniatura que se abre completa**, no un encabezado enorme.
32. **Dos o tres opciones cortas = control segmentado**, no botones sueltos.
33. **Un atributo visual (color, tamaño) se elige mirando el atributo**, no leyendo una palabra.
34. **Las hojas propias (`Sheet`) no usan el modal del sistema por defecto:** el modal nativo anima un fondo oscuro que sube y no cerraba al tocar fuera. `Sheet` vive dentro de la pantalla; solo cuando debe cubrir **todo** (selector del formulario, aviso de error) se usa `Sheet modal`, y cuando varias hojas pueden abrirse unas sobre otras, `SheetHost` (regla 46). *Versión anterior: "usar siempre Sheet dentro de la pantalla"; el modo `modal` se añadió después.*

### Lección técnica: hojas y toques en iPhone (reglas 35 y 36)

35. **La zona de cierre de una hoja es el propio fondo difuminado**, una sola vista visible y `collapsable={false}`. Una vista transparente aparte, un `Pressable` con `aria-hidden` o un fondo con los toques desactivados dejaron de recibir el toque exterior en el iPhone aunque funcionaran en la web.
36. **La animación de una hoja arranca en el componente que se monta con el contenido**, nunca antes; si no, la hoja se queda a mitad de subida y sin fundido. Para cubrir siempre toda la pantalla, `Sheet modal`.

### Lección técnica: `StyleSheet.absoluteFillObject` no existe en React Native 0.86 (regla 37)

37. **Usar solo `StyleSheet.absoluteFill`** (en `style={[StyleSheet.absoluteFill, ...]}` o `{ ...StyleSheet.absoluteFill, ... }`). `absoluteFillObject` ya no existe en RN 0.86: el spread queda vacío y los elementos "superpuestos" caen en el flujo normal de la pantalla (hojas arriba o debajo, fondo difuminado ausente, tarjetas que no cierran, botón de enviar a media pantalla). react-native-web sí lo tiene, por eso las pruebas web no lo ven; `tests/ui/noRemovedStyleApis.spec.js` lo vigila.

## Cámara (aprobada)

- **Pantalla de permiso verde** con un solo mensaje y una sola acción, en lugar de botones fantasma detrás de una tarjeta negra.
- **Controles sobre degradados reales** (`Scrim`, `react-native-svg`) arriba y abajo, no sobre un 56 % de negro: se leen sobre cualquier imagen.
- **Obturador de un solo círculo** con contorno blanco; sin anillos dobles ni recuadro de encuadre. Zoom con pellizco (`PanResponder`).
- **Avisos minimalistas:** foto rechazada, validando y cola de borradores son una **cápsula oscura de una línea** (ícono, texto), no un banner. **El aviso de rechazo desaparece solo a los 5 segundos.**

43. **Los avisos sobre la cámara son cápsulas de una línea que no tapan el encuadre** y los transitorios se retiran solos.

## Asociación (aprobada)

- **Encabezado con el total** (número grande) y la gráfica de periodo en el cuerpo, **pestañas de periodo** (Últimos 7 días, Personalizado) y "Personalizado" como botón propio con calendario.
- **Al elegir la fecha inicial se abre sola la fecha final** (decisión del usuario; se ajustó la prueba que esperaba lo contrario).
- **Filas de bandeja** para los reportes, con **paginación de 5** (`Pager`); la tabla de escritorio se conserva a partir de 900 px de ancho.
- **Huella lejos del botón de salir**, para que no parezca parte del control.

## Mapa (aprobado)

- **Pantalla completa:** el mapa ocupa todo y los controles flotan encima. **Control de volver circular**, blanco con sombra suave, sin título (el título se conserva para lectores de pantalla y se dibuja solo en el fallback sin mapa, `ExpoGoFallbackScreen`).
- **Pin = una sola silueta de gota** (`PinGlyph`, SVG): relleno del color de gravedad, **un solo borde blanco continuo**, sombra de la misma forma desplazada, huella centrada e insignia ámbar si tiene banderas. Se rechazaron el círculo con triángulo y píldora de sombra apilados ("se ve como una cosa apilada sobre otra").
- **Clusters:** círculos del color de gravedad con halo; el botón interno conserva el diámetro del contrato RF12.
- **Tocar un cluster enfoca la cámara en él** al siguiente umbral de agrupación del servidor (`nextBandZoom`) y abre una **tarjeta compacta sin fondo difuminado y sin botón "Acercar"** (la cámara ya acercó); la tarjeta solo ofrece "Ver reportes de la zona".
- **Detalle de un reporte como ficha:** foto, franja de gravedad, título y fecha, cuadrícula de 2 columnas con los datos, "Cerrar" como botón y "Denunciar" como enlace rojo con bandera. **Tocar la foto la abre completa** (`PhotoViewer`, el mismo visor del formulario).
- **Hojas apiladas en una sola ventana del sistema** (`SheetHost`): iOS no puede presentar un modal sobre otro, y abrir el detalle desde la lista de zona congelaba la app. `ZoneReportsSheet`, `PinSheet` y `ReportFlagSheet` viven en un único `Modal`; la zona de cierre es el fondo difuminado de cada hoja.

44. **Un marcador que representa un reporte se dibuja siempre con `PinGlyph`** (mapa y cola), no con vistas apiladas.
45. **Si una acción ya ocurrió (el zoom del cluster), el control que la repite se quita.**
46. **Las hojas que pueden abrirse unas sobre otras comparten una sola ventana del sistema** (`SheetHost`), nunca un `Modal` por hoja.

## Campos de texto (corrección transversal)

47. **Los campos de una línea no declaran `lineHeight`** (`type.input`): en iOS un `lineHeight` mayor que el tamaño de letra empuja el texto por debajo del centro del campo. Los campos multilínea fijan su propio `lineHeight` (22).

## Cómo se trabaja con las skills

`frontend-design` ayudó más que el resto: obliga a planear con una paleta, roles de tipografía y un wireframe, a revisar el plan contra los defaults de plantilla y a gastar el riesgo estético en un solo lugar. `design-taste-frontend` sirve como lista de verificación (contraste, estados, etiquetas arriba del campo). `mobile-redesign-screen` da el método (auditar, proponer, arreglar). Para cada pantalla nueva: invocar `frontend-design` primero para el plan.

## Piezas reutilizables ya hechas

- **`theme/`:** `colors`, `spacing` (y `layout`), `radius`, `shadows`, `motion`, `type` (estilos de texto con nombre) y `fonts` (Plus Jakarta Sans, Work Sans, Fredoka). Ninguna pantalla declara hex ni tamaños sueltos salvo excepciones comentadas.
- **`components/ui/`:** `AppButton` (variante `signal`), `AppTextField` (`tone="dark"`), `Banner`, `Chip`, `Icon` (mapa de nombres semánticos a lucide), `IconButton`, `Pager`, `PawTrail`, `PhotoViewer`, `PinGlyph`, `Scrim`, `Sheet` (en pantalla o `modal`), `SheetHost`, `StateView`. `AppCard` y `ScreenHeader` se probaron en el Paso 0 y se retiraron por no usarse en ninguna pantalla.
- **Tokens que existen aunque hoy no los consuma una pantalla** (forman parte de las escalas de `DESIGN.md`): `shadows.none/card/raised`, `motion.fast/slow`, `layout.gutter/safeAreaBottom`, `colors.primaryContainer` y los estilos `type.display/headline/number/numberSmall/labelCaps`.
