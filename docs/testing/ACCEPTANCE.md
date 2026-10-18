# Aceptación ejecutada por el equipo

Estado: casos de T14 / TD-127 (`TC-ACEPTACION-01` a `TC-ACEPTACION-12`) con
resultado registrado por equivalencia con la prueba alfa T7 y veredicto del equipo
«aceptado con observaciones» (ver Conformidad).
Depende de T5, T6 y T7. Fuente: `docs/testing/BACKLOG.md`, T14.
Convenciones: `docs/testing/README.md`.

**Decisión (2026-10-12):** los casos de aceptación los ejecuta el equipo de
desarrollo (responsable: Alan Ruiz, P4), no el socio formador. No hay sesión con
el socio ni fecha fija; la conformidad del socio formador no se obtuvo por
decisión del equipo, y lo que se registra en la sección Conformidad es el
veredicto del equipo.

**Decisión (2026-10-13):** sin ejecución separada de aceptación en la build
final; resultados por equivalencia con la sesión alfa T7 (RUN-83 a RUN-116) y
RUN-137. Decisión del equipo (Alan Ruiz, responsable de T14), 2026-10-13. No se
agregan filas `RUN-<n>` nuevas a `docs/testing/TEST_LOG.md` para T14: cada caso
cita las filas existentes de T7 y su resultado. La sesión alfa corrió sobre el
commit `fe8da67d23862517ab5878228da5a15ca971b973`, anterior a la build final
`88950993dfb3c60f5a5262357b9ec1de695af307`; solo RUN-137 corrió sobre esta
última.

## Ejecución

No hubo ejecución propia de T14. La tabla registra los datos de las ejecuciones
alfa citadas, tal como constan en `docs/testing/ALPHA.md` y en
`docs/testing/TEST_LOG.md`. Las secciones «Condiciones de entrada», «Orden de
casos», «Evidencia» y «Registro de resultados» describen la ejecución separada que
se había planeado; se conservan como referencia, pero no se ejecutaron.

| Campo | Valor |
|---|---|
| Fecha, hora y zona | Sesión alfa T7: 2026-10-08 a 2026-10-11 según `docs/testing/ALPHA.md`; las filas citadas (RUN-83 a RUN-116) van del 2026-10-08 17:21 al 2026-10-11 01:10 America/Mexico_City. RUN-137: 2026-10-12 18:12 America/Mexico_City |
| Ejecutado por | Erick Herrera (equipo), en dispositivo Android |
| Lugar | No registrado en las filas alfa; `docs/testing/ALPHA.md` indica el geofence de staging vigente |
| Commit/build de la app | RUN-83 a RUN-116: `fe8da67d23862517ab5878228da5a15ca971b973`; RUN-137: `88950993dfb3c60f5a5262357b9ec1de695af307` (incluye `f18ba0b`, PR #64). En ambos: app `1.0.0`, paquete `com.wildogscanner.app`, build nativo development/debug, no Expo Go |
| Dispositivo y versión del sistema | samsung SM-S918B; Android 16 (SDK 36) |
| API/entorno | Staging con servicios reales |
| Datos sembrados (UUID de reportes) | No aplica: sin sesión separada; no se sembraron reportes para T14 |
| Observaciones de la ejecución | Resultados por equivalencia; partes de los casos sin ejecución equivalente señaladas por caso y en Conformidad |

### Condiciones de entrada

Revisarlas antes de ejecutar; si alguna no se cumple, posponer la ejecución en vez
de improvisar.

1. **Build nativo instalado, no Expo Go.** Instalar en el teléfono un build de
   desarrollo o release como en la preparación de `docs/testing/ALPHA.md`. Debe
   ser el build final de `main` en el commit `8895099` o posterior, que ya incluye
   `f18ba0b` (aviso de RF02, corrección de `INC-2`). Anotar el SHA completo
   instalado el día de la ejecución. El mapa nativo y compartir
   archivos no funcionan en Expo Go ni en navegador.
2. **Entorno staging.** La app apunta a staging; el geofence vigente es el de
   prueba descrito en `docs/DEPLOYMENT.md` (Chihuahua, Delicias, Meoqui y Creel).
   La ejecución se realiza en Chihuahua; el teléfono debe estar dentro de esa zona
   y con ubicación y cámara permitidas.
   No usar producción ni cambiar umbrales o zonas durante la ejecución.
3. **Cuentas.** Las cuentas de Asociación y de Administrator ya existen en
   staging. Las credenciales se teclean en el momento; **no se escriben en Git,
   en capturas, en el test log ni en este archivo**.
4. **Datos sembrados.** Antes de ejecutar, el equipo crea desde la app al menos
   tres reportes sintéticos en Chihuahua, dentro del geofence, de categorías
   distintas (por ejemplo avistamiento, manada y ataque a mascota), y los
   **aprueba** como Administrator en el Command Center. Así el mapa
   (TC-ACEPTACION-06) y el panel y la exportación de la Asociación
   (TC-ACEPTACION-08 y 09) tienen contenido además de los reportes creados en los
   casos; el orden de los casos no cambia. Anotar sus UUID en la tabla de
   ejecución.
5. **Entradas y escenas.** `docs/testing/data/aceptacion-entradas.json` lista los
   valores que se escriben o eligen en cada caso. Las escenas de foto son ESC-A
   (perro nítido) y ESC-B (sin perro) de `docs/testing/cases/alpha.md`; llevar
   una imagen impresa de un perro o mostrarla en otra pantalla. Sin personas,
   placas ni domicilios en cuadro.
6. **Material.** Este archivo abierto para anotar, cronómetro opcional y espacio
   para guardar capturas. Duración estimada: 60 a 90 minutos.

### Orden de casos

Antes de ejecutar cada caso, leer su objetivo y resultado esperado para fijar el
criterio; después usar el teléfono como lo haría una persona usuaria.

| Bloque | Casos | Rol en la app | Nota |
|---|---|---|---|
| 1. Reportar | TC-ACEPTACION-01 a 05 | Sin cuenta | Anotar el UUID de cada reporte enviado |
| 2. Moderación | TC-ACEPTACION-12 y luego 11 | Administrator | 12 sobre el reporte de 05 sin cambiarlo; en 11, aprobar los de 01 y 02 y ocultar, restaurar y eliminar solo el de 05; cerrar sesión al terminar |
| 3. Mapa público | TC-ACEPTACION-06 y 07 | Sin cuenta | Requiere los reportes aprobados del bloque 2 y los sembrados |
| 4. Asociación | TC-ACEPTACION-08 a 10 | Asociación | Cerrar sesión al terminar |

### Evidencia

- Capturas o videos cortos del teléfono por caso, guardados como
  `docs/testing/data/aceptacion/<AAAA-MM-DD>/TC-ACEPTACION-<nn>-<descripcion>.<ext>`
  (crear el directorio solo cuando exista evidencia real), o un enlace persistente
  a almacenamiento compartido del equipo.
- Antes de capturar, verificar que no se vean contraseñas, notificaciones
  personales, rostros ni coordenadas exactas de domicilios.
- Los archivos CSV y XLSX de TC-ACEPTACION-09 se conservan junto a las capturas;
  contienen solo datos sintéticos de staging.

### Registro de resultados

1. **Resultado técnico por caso** (`pasó`, `falló` o `bloqueado`): una fila
   `RUN-<n>` nueva en `docs/testing/TEST_LOG.md` con fecha, hora y zona, commit/build,
   dispositivo, ejecutado por «Erick Herrera (equipo)», lo observado y la ruta de
   evidencia. Anotar ese `RUN-<n>` en la columna de ejecución de la tabla.
2. **Comentarios por caso:** en «Comentarios y evidencia», anotar observaciones
   del equipo y la ruta o enlace de la evidencia.
3. **Si un caso falla:** abrir `INC-<n>` en `docs/testing/INCIDENTS.md` y el bug en
   Jira de inmediato, y enlazarlos con el `RUN-<n>`.
4. **Veredicto del equipo:** al cierre, registrar en la tabla de Conformidad el
   veredicto del equipo (aceptado, aceptado con observaciones o rechazado) con
   base en los resultados registrados. No es la conformidad del socio formador y
   no se presenta como tal.

## Casos seleccionados

Flujos de las historias de usuario que el socio formador pidió: reportar, ver el
mapa, panel y exportación de la Asociación y moderación. Cada caso parte de un
caso ya probado por el equipo en `docs/testing/cases/alpha.md` (T7), redactado
desde el punto de vista de una persona usuaria sin conocimientos técnicos. Tipos según
`docs/testing/README.md`; los límites numéricos (mínimo/máximo) ya los cubren
T5 y T7, por eso aquí solo hay casos `normal` y `excepción`. Entradas exactas:
`docs/testing/data/aceptacion-entradas.json`.

| Caso | Requerimientos | Precondiciones y entrada | Pasos | Resultado esperado | Ejecución y resultado obtenido | Comentarios y evidencia |
|---|---|---|---|---|---|---|
| TC-ACEPTACION-01<br>normal | HU-01, HU-02, HU-03, HU-04, HU-06, HU-07; RF01, RF02, RF03, RF04, RF06, RF07, RF24 | App cerrada, con red y ubicación; escena ESC-A; entrada `acept-01-reporte-con-foto` (Avistamiento, Solitario) | 1. Abrir la app desde su ícono; 2. Tomar la foto del perro; 3. En el formulario, leer el aviso de datos personales; 4. Elegir «Avistamiento» y «Solitario»; 5. Escribir en «Descripción Opcional» el texto `Prueba de aceptación`; 6. Tocar «Enviar reporte» | La app abre directamente en la cámara; la foto se acepta; el formulario muestra el aviso «No ingreses datos personales» y no pide nombre, teléfono ni correo; aparece «Reporte enviado» con un UUID, sin pedir cuenta | Por equivalencia, parcial: TC-ALPHA-01 (RUN-83, pasó: abre en la cámara); TC-ALPHA-03 (RUN-85, pasó: foto nítida aceptada); TC-ALPHA-14 (RUN-96, falló: sin aviso RF02; RUN-137, pasó en `8895099`: aviso RF02 visible y sin campos de nombre, teléfono ni correo); TC-ALPHA-12 (RUN-94, pasó: «Avistamiento» «Solitario» sin cantidad y reporte enviado); TC-ALPHA-08 (RUN-90, pasó: reporte con foto enviado y UUID anotado); TC-ALPHA-13 (RUN-95, pasó: enviado sin pedir cuenta). Escribir texto en «Descripción Opcional»: sin ejecución equivalente (TC-ALPHA-08 se envió sin descripción) | Resultado efectivo de TC-ALPHA-14: pasó en RUN-137 (`INC-2` corregido); RUN-96 queda como histórico. Evidencia: `docs/testing/data/alpha/2026-10-11/TC-ALPHA-01-permiso-camara.jpg`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-03-foto-nitida.jpg`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-08-manada-2.jpg`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-12-solitario-categorias.jpg`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-13-reporte-sin-foto.jpg`<br>`docs/testing/data/alpha/2026-10-12/TC-ALPHA-14-aviso-rf02-visible.jpg` |
| TC-ACEPTACION-02<br>normal | HU-04, HU-05; RF04, RF05 | Cámara abierta, con red; entrada `acept-02-sin-foto-manada` (Manada, cantidad 5) | 1. Tocar «Reportar sin foto»; 2. Elegir «Avistamiento» y «Manada»; 3. Escribir la cantidad `5`; 4. Tocar «Enviar reporte» | El formulario indica «Sin foto»; al elegir «Manada» se pide la cantidad; aparece «Reporte enviado» | Por equivalencia, en flujos separados: TC-ALPHA-13 (RUN-95, pasó: «Reportar sin foto» y reporte enviado); TC-ALPHA-08 (RUN-90, pasó: «Manada» con cantidad 2 enviada) y TC-ALPHA-09 (RUN-91, pasó: cantidad 1000 enviada). Un mismo reporte sin foto con «Manada» y cantidad `5`: sin ejecución equivalente | Cada elemento del resultado esperado está en el resultado esperado de un caso alfa que pasó, pero no en un solo flujo. Evidencia: `docs/testing/data/alpha/2026-10-11/TC-ALPHA-13-reporte-sin-foto.jpg`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-08-manada-2.jpg`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-09-manada-1000-enviado.jpg` |
| TC-ACEPTACION-03<br>excepción | HU-04; RF04 | Formulario de manada abierto; entrada `acept-03-cantidad-fuera-de-rango` (cantidad 1001) | 1. Escribir la cantidad `1001`; 2. Tocar «Enviar reporte» | Aparece «Escribe un número entero entre 2 y 1000.»; el reporte no se envía ni queda guardado para después | Por equivalencia: TC-ALPHA-10 (RUN-92, pasó: la cantidad 1001 se rechaza por rango; su resultado esperado incluye que no se envía ni se guarda en la cola) | Evidencia: `docs/testing/data/alpha/2026-10-11/TC-ALPHA-10-manada-1001-error.jpg` |
| TC-ACEPTACION-04<br>excepción | HU-09; RF09 | Cámara abierta con el indicador «Validación offline lista»; escena ESC-B (sin perro) | 1. Tomar la foto de la escena sin perro | Aparece «No detectamos un perro en la foto.» con la opción «Tomar otra»; no se crea un reporte con esa foto | Por equivalencia: TC-ALPHA-04 (RUN-86, pasó: foto sin perro rechazada y sin reporte creado) | Evidencia: `docs/testing/data/alpha/2026-10-11/TC-ALPHA-04-foto-sin-perro.jpg` |
| TC-ACEPTACION-05<br>normal | HU-01; RF01, RNF12 | Modo avión activado; entrada `acept-05-sin-red` (Avistamiento, Solitario; con foto ESC-A o sin foto) | 1. Crear el reporte y tocar «Enviar reporte»; 2. Volver a la cámara y ver el aviso; 3. Desactivar modo avión; 4. Esperar o tocar «Reintentar ahora» | Sin red aparece «Reporte guardado para sincronizar» y el aviso con el conteo; al volver la red pasa a «Reportes sincronizados» y el aviso de pendientes desaparece (conteo en 0); se anota el UUID mostrado y, en TC-ACEPTACION-11, la cola de moderación muestra un solo reporte con ese UUID, sin duplicados | Por equivalencia, parcial: TC-ALPHA-15 (RUN-97, pasó: reporte en modo avión guardado para sincronizar); TC-ALPHA-16 (RUN-98, pasó: sincronización confirmada al recuperar la red, sin duplicado observado); TC-ALPHA-17 (RUN-99, pasó: la cola sobrevive al cierre y sincroniza). La captura `docs/testing/data/alpha/2026-10-11/TC-ALPHA-16-sincronizacion.jpg` muestra «Reports synced — The local queue is up to date.» sin aviso de pendientes visible; un conteo numérico en 0 no aparece: sin ejecución equivalente para esa parte | RUN-98 registra que no se observó duplicado; el resultado esperado de TC-ALPHA-16 pide comprobarlo en la cola de moderación. Evidencia: `docs/testing/data/alpha/2026-10-11/TC-ALPHA-15-reporte-modo-avion.jpg`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-15-modo-avion-sync.mp4`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-16-sincronizacion.jpg`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-17-cola-tras-cierre.jpg` |
| TC-ACEPTACION-06<br>normal | HU-10, HU-11, HU-12, HU-13, HU-14; RF10, RF11, RF12, RF13, RF14, RNF13 | Con red y sin sesión; reportes sembrados y los de TC-ACEPTACION-01 y 02 aprobados | 1. Tocar «Ver mapa»; 2. Observar los círculos; 3. Tocar un círculo y leer el detalle; 4. Acercar con los dedos hasta ver pines; 5. Tocar un pin | Los reportes cercanos se agrupan en círculos con su número; un círculo con más reportes se ve más grande y su color indica la mayor gravedad; el detalle muestra «Mayor gravedad» y el conteo de las seis categorías; al acercar aparecen pines con tipo, color y fecha y hora en ubicación aproximada | Por equivalencia: TC-ALPHA-18 (RUN-100, pasó: clusters y pines al acercar); TC-ALPHA-19 (RUN-101, pasó: detalle con conteos y mayor gravedad); TC-ALPHA-20 (RUN-102, pasó: detalle de pin con ubicación aproximada) | Sobre reportes aprobados en la sesión alfa, no sobre reportes sembrados para T14. Evidencia: `docs/testing/data/alpha/2026-10-11/TC-ALPHA-18-mapa-clusters.jpg`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-19-detalle-cluster.jpg`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-20-detalle-pin.jpg` |
| TC-ACEPTACION-07<br>excepción | HU-10; RF10 | Modo avión activado | 1. Abrir el mapa sin red; 2. Desactivar modo avión; 3. Tocar «Reintentar» | Aparece «El mapa no está disponible sin conexión» y que se pueden seguir creando reportes; al volver la red, «Reintentar» muestra el mapa | Por equivalencia: TC-ALPHA-21 (RUN-103, pasó: mensaje de mapa sin conexión y se puede seguir creando reportes) | La recuperación con «Reintentar» forma parte del resultado esperado de TC-ALPHA-21; lo observado en RUN-103 no la describe por separado. Evidencia: `docs/testing/data/alpha/2026-10-11/TC-ALPHA-21-mapa-sin-conexion.jpg` |
| TC-ACEPTACION-08<br>normal | HU-15, HU-16; RF15, RF16 | Sesión cerrada; cuenta de Asociación (credenciales fuera de Git); reportes aprobados en los últimos 7 días; entrada `acept-08-panel-periodo` | 1. En la cámara, tocar «Acceso de personal»; 2. Iniciar sesión con la cuenta de Asociación; 3. Elegir «Últimos 7 días»; 4. Tocar «Consultar»; 5. Revisar el resumen y una tarjeta | Abre «Panel de la Asociación» sin opción de registro; muestra el total, el resumen por fecha de aceptación y tarjetas solo con datos de negocio (ID, fechas, coordenadas, características del perro y detalles), sin datos de moderación ni de operadores | Por equivalencia: TC-ALPHA-24 (RUN-106, pasó: login de Asociación abre el panel) y TC-ALPHA-25 (RUN-107, pasó: consulta de últimos 7 días con solo datos de negocio) | Evidencia: `docs/testing/data/alpha/2026-10-11/TC-ALPHA-24-login-asociacion.mp4`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-25-panel-7-dias.jpg` |
| TC-ACEPTACION-09<br>normal | HU-17; RF17 | Consulta con resultados de TC-ACEPTACION-08; entrada `acept-09-exportacion` | 1. Tocar «CSV» y guardar o compartir el archivo; 2. Repetir con «XLSX»; 3. Abrir ambos archivos en el teléfono o en una computadora | Se generan los dos archivos; cada uno tiene una fila de encabezado con las 12 columnas `id`, `accepted_at`, `occurred_at`, `incident_type`, `sighting_type`, `details`, `predominant_color`, `size`, `has_collar`, `longitude`, `latitude` y `has_sanitized_photo`; el número de filas de datos (sin encabezado) es igual al «Total de reportes» del panel; el ID de al menos una tarjeta del panel aparece en ambos archivos con la misma fecha de aceptación | Por equivalencia, parcial: TC-ALPHA-27 (RUN-109, pasó: controles y archivos de exportación CSV/XLSX verificados). La captura `docs/testing/data/alpha/2026-10-11/TC-ALPHA-27-export-csv.jpg` muestra un encabezado de 12 columnas (A–L) en el orden esperado, de `id` a `has_sanitized_photo` (varios encabezados truncados por el ancho), y 8 filas de datos; `docs/testing/data/alpha/2026-10-11/TC-ALPHA-25-panel-7-dias.jpg` muestra «Total reports 8» para «Last 7 days». Son capturas separadas: no se muestra que la exportación provenga de esa misma consulta. Mismo ID con la misma fecha de aceptación: sin ejecución equivalente (las fechas aparecen truncadas). Las capturas no permiten distinguir el archivo CSV del XLSX | Los archivos CSV y XLSX exportados no están versionados; solo hay capturas. Evidencia: `docs/testing/data/alpha/2026-10-11/TC-ALPHA-27-export-botones.jpg`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-27-export-csv.jpg`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-27-export-xlsx.jpg` |
| TC-ACEPTACION-10<br>excepción | HU-16, HU-17; RF16, RF17 | Panel de la Asociación abierto; entrada `acept-10-rangos` | 1. Elegir un rango personalizado del `2020-01-01` al `2020-01-02` y consultar; 2. Elegir del `2026-10-10` al `2026-10-01` y consultar | (1) «No hay resultados en este rango.» y la exportación queda deshabilitada; (2) «La fecha final debe ser igual o posterior a la inicial.» y no se consulta | Por equivalencia: TC-ALPHA-26 (RUN-108, pasó: rango vacío con exportación deshabilitada y fecha final anterior a la inicial rechazada) | TC-ALPHA-26 cubre las entradas (a) y (c) de este caso. Evidencia: `docs/testing/data/alpha/2026-10-11/TC-ALPHA-26-rangos-invalidos-vacios.jpg` |
| TC-ACEPTACION-11<br>normal | HU-18, HU-19, HU-20; RF18, RF19, RF20 | Sesión cerrada; cuenta de Administrator (credenciales fuera de Git); reportes de TC-ACEPTACION-01, 02 y 05 pendientes; entrada `acept-11-moderacion` | 1. «Acceso de personal» e iniciar sesión como Administrator; 2. En «Cola de moderación», ubicar los reportes creados en los casos por su UUID; 3. «Aprobar» los de 01 y 02; 4. «Ocultar» el de 05 con su motivo; 5. «Restaurar» ese mismo reporte con motivo; 6. «Eliminar» ese mismo reporte con motivo | Abre «Command Center» sin el panel ni la exportación de la Asociación; ocultar, restaurar y eliminar piden motivo; ocultar lo deja en la cola y ya no es público; restaurar lo devuelve a «Pendiente» (no público hasta aprobarse); al eliminar, el aviso indica que el reporte dejará de mostrarse pero podrá restaurarse, y el reporte desaparece de la cola (también al actualizarla) y no aparece en el mapa; la reversión de un eliminado no se ejecuta desde la app en esta ejecución porque los eliminados no aparecen en la cola | Por equivalencia, parcial: TC-ALPHA-28 (RUN-110, pasó: Command Center sin exportación de Asociación); TC-ALPHA-29 (RUN-111, pasó: aprobar, ocultar, restaurar y eliminar con motivo según correspondía). Aviso de eliminar que indica que podrá restaurarse y desaparición del reporte de la cola al actualizarla: sin ejecución equivalente (no están en el resultado esperado de TC-ALPHA-29) | En T7 los comandos se aplicaron a reportes propios de la sesión alfa, no a los de TC-ACEPTACION-01, 02 y 05. Evidencia: `docs/testing/data/alpha/2026-10-11/TC-ALPHA-28-login-administrator.jpg`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-29-moderacion.jpg` |
| TC-ACEPTACION-12<br>excepción | HU-20; RF20 | Sesión de Administrator; reporte de TC-ACEPTACION-05 pendiente en la cola; entrada `acept-12-motivo-vacio` | 1. Tocar «Ocultar» en ese reporte; 2. Dejar el motivo vacío e intentar confirmar; 3. Cancelar | El botón «Confirmar ocultar» permanece deshabilitado mientras el motivo está vacío; el reporte no cambia de estado | Por equivalencia, parcial: TC-ALPHA-29 (RUN-111, pasó: cada comando exige motivo donde corresponde). «Confirmar ocultar» deshabilitado con motivo vacío y cancelar sin cambio de estado: sin ejecución equivalente | Evidencia: `docs/testing/data/alpha/2026-10-11/TC-ALPHA-29-moderacion.jpg` |

## Conformidad

Veredicto del equipo, no conformidad del socio formador: el socio no ejecuta los
casos y su conformidad no se obtuvo por decisión del equipo (2026-10-12).

| Fecha y versión evaluada | Veredicto del equipo | Observaciones y condiciones | Evidencia |
|---|---|---|---|
| 2026-10-13; por equivalencia con `fe8da67d23862517ab5878228da5a15ca971b973` (RUN-83 a RUN-116) y `88950993dfb3c60f5a5262357b9ec1de695af307` (RUN-137) | aceptado con observaciones | (1) Sin ejecución separada de aceptación en la build final; la sesión alfa corrió en un commit anterior a `8895099`, salvo RUN-137. (2) Partes sin ejecución equivalente: descripción escrita (TC-ACEPTACION-01); conteo numérico de pendientes en 0 (05; la captura muestra la cola al día sin aviso de pendientes); origen de la exportación en la misma consulta, cruce de ID y fecha, y distinción CSV/XLSX en las capturas (09; las capturas muestran 12 columnas y 8 filas, igual al total del panel); aviso de eliminar y desaparición de la cola al actualizar (11); botón «Confirmar ocultar» deshabilitado y cancelar sin cambio (12). TC-ACEPTACION-02 está cubierto solo en flujos separados. (3) TC-ALPHA-14 falló en RUN-96 (`INC-2`) y pasó en RUN-137. Ninguna parte cubierta tiene una ejecución fallida sin aprobación posterior. No se planeó ejecución adicional (decisión 2026-10-13) | `docs/testing/ALPHA.md`; `docs/testing/TEST_LOG.md` (RUN-83 a RUN-116, RUN-137); `docs/testing/data/alpha/2026-10-11/`; `docs/testing/data/alpha/2026-10-12/` |

Registrar cada ejecución en `docs/testing/TEST_LOG.md`. Ante una falla, abrir
inmediatamente incidente en `docs/testing/INCIDENTS.md` y bug en Jira. El
veredicto del equipo y el resultado técnico de un caso son registros distintos;
no se registran resultados que no se hayan observado.

## Sesión con el socio formador (2026-10-18)

Los casos `TC-CLIENTE-01` a `TC-CLIENTE-05` (`docs/testing/cases/aceptacion-socio.md`)
se ejecutaron con el socio formador el 18 de octubre de 2026. Reporte de la sesión:
`docs/testing/data/aceptacion/2026-10-18/reporte-aceptacion-socio.pdf`. Esta sesión
reemplaza la conformidad por equivalencia de la sección Conformidad: el veredicto
del socio es **aceptado con observaciones**.

| Caso | Resultado | Observación del socio |
|---|---|---|
| TC-CLIENTE-01 Crear un reporte con foto | pasó | — |
| TC-CLIENTE-02 Reportar sin conexión y sincronizar | pasó | — |
| TC-CLIENTE-03 Consultar zonas de riesgo en el mapa | pasó | Los íconos de patitas deben verse desde antes, sin hacer mucho zoom. |
| TC-CLIENTE-04 Consultar y exportar datos de la Asociación | pasó | La cuenta de Administrador también debe poder descargar los datos. |
| TC-CLIENTE-05 Ocultar un reporte con una justificación | pasó | — |

Las dos observaciones son solicitudes de cambio, no fallas de los casos: no abren
`INC-<n>`. La segunda (exportación para Administrator) contradice la regla vigente de
`AGENTS.md` (el Administrator no hereda BI/exportación) y requeriría una aclaración
aprobada en `docs/product/APPROVED-CLARIFICATIONS.md` antes de implementarse. En esta
sesión no se agregaron filas `RUN-<n>` a `docs/testing/TEST_LOG.md`.
