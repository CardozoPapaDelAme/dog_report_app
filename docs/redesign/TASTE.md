# Taste: cómo se transformó el Login y qué reglas salen para las demás pantallas

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

## Reglas para las siguientes pantallas

1. **Recomponer, no solo reestilizar.** Cada pantalla debe cambiar su estructura visual, no solo su paleta o fuente.
2. **Verde de marca a pantalla completa en las pantallas de entrada** (Login y similares). Las pantallas de trabajo con muchos datos (Configuración, Duplicados, Asociación) pueden usar fondo claro, pero con el mismo vocabulario: Fredoka en títulos, campos oscuros o de borde claro, amarillo para la acción principal. *Esto es una inferencia mía, a confirmar con la primera pantalla de datos.*
3. **Varias tipografías en una misma pantalla, cada una con rol fijo:** Fredoka = título y botón principal; Plus Jakarta Sans = texto corrido; Work Sans = etiquetas, números, enlaces pequeños.
4. **Que se note que es de perros.** Huellas como motivo recurrente (rastro, fondo, estados vacíos), puntas hacia arriba. Nada que lea como militar, montaña, señalética ni corporativo frío.
5. **Esquinas moderadas:** botones 12 px, campos 8 px, tarjetas 16 px. Evitar píldoras salvo chips y el obturador.
6. **Amarillo `#e9e600` solo para la acción principal** de la pantalla (una por pantalla). El resto de la acción en blanco, borde o verde.
7. **Sin huecos sin intención:** si queda espacio, se llena con el motivo de marca (rastro de huellas) o se reparte la composición. Nunca un bloque vacío.
8. **Posición del contenido:** el formulario o la acción principal en la zona media, al alcance del pulgar, ni pegada arriba ni al fondo.
9. **Teclado:** el encabezado se compacta y los adornos desaparecen mientras se escribe; los botones de salida (volver) nunca salen de vista.
10. **Contraste mínimo 4.5:1** en todo texto, 7:1 o más donde se pueda (uso al sol). Los estados deshabilitados se diferencian por forma/transparencia, no solo por opacidad.
11. **Sin eyebrows en mayúsculas ni insignias decorativas.** Se eliminó "PANEL PRIVADO" y la "C" del logo.
12. **Se mantiene el contrato:** testIDs, roles con nombre, textos y llaves i18n, 8 inputs de Configuración y sin desbordamiento horizontal (ver `CONTRACT.md`).

## Piezas reutilizables ya hechas

`theme/` (colores, tipografía, espaciado), `components/ui/` (AppButton con variante `signal`, AppTextField con `tone="dark"`, Banner, Chip, Sheet, StateView `tone="dark"`, PawTrail, Icon), fuentes en `theme/fonts.js`.
