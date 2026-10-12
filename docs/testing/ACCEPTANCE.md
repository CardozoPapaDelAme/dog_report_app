# Aceptación ejecutada por el equipo

Estado: casos de T14 / TD-127 preparados (`TC-ACEPTACION-01` a `TC-ACEPTACION-12`);
la ejecución y los resultados quedan pendientes hasta que el equipo los ejecute.
Depende de T5, T6 y T7. Fuente: `docs/testing/BACKLOG.md`, T14.
Convenciones: `docs/testing/README.md`.

**Decisión (2026-10-12):** los casos de aceptación los ejecuta el equipo de
desarrollo (responsable: Alan Ruiz, P4), no el socio formador. No hay sesión con
el socio ni fecha fija; la conformidad del socio formador no se obtuvo por
decisión del equipo, y lo que se registra en la sección Conformidad es el
veredicto del equipo.

## Ejecución

Decisiones ya tomadas: la ejecución es en Chihuahua, dentro del geofence de prueba
de staging; las cuentas de Asociación y Administrator ya existen en staging, con
credenciales fuera de Git. Fecha, commit/build exacto, dispositivo y versiones
siguen pendientes y se anotan el día de la ejecución.

| Campo | Valor |
|---|---|
| Fecha, hora y zona | <pendiente> |
| Ejecutado por | Alan Ruiz (equipo) |
| Lugar | Chihuahua, dentro del geofence de prueba de staging |
| Commit/build de la app | <pendiente: build final de `main` en `8895099` o posterior (incluye `f18ba0b`); SHA completo (`git rev-parse HEAD`), versión, paquete y tipo de build> |
| Dispositivo y versión del sistema | <pendiente> |
| API/entorno | <pendiente: staging con servicios reales> |
| Datos sembrados (UUID de reportes) | <pendiente> |
| Observaciones de la ejecución | <pendiente> |

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
   dispositivo, ejecutado por «Alan Ruiz (equipo)», lo observado y la ruta de
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
| TC-ACEPTACION-01<br>normal | HU-01, HU-02, HU-03, HU-04, HU-06, HU-07; RF01, RF02, RF03, RF04, RF06, RF07, RF24 | App cerrada, con red y ubicación; escena ESC-A; entrada `acept-01-reporte-con-foto` (Avistamiento, Solitario) | 1. Abrir la app desde su ícono; 2. Tomar la foto del perro; 3. En el formulario, leer el aviso de datos personales; 4. Elegir «Avistamiento» y «Solitario»; 5. Escribir en «Descripción Opcional» el texto `Prueba de aceptación`; 6. Tocar «Enviar reporte» | La app abre directamente en la cámara; la foto se acepta; el formulario muestra el aviso «No ingreses datos personales» y no pide nombre, teléfono ni correo; aparece «Reporte enviado» con un UUID, sin pedir cuenta | <pendiente: RUN-n en docs/testing/TEST_LOG.md> | <pendiente> |
| TC-ACEPTACION-02<br>normal | HU-04, HU-05; RF04, RF05 | Cámara abierta, con red; entrada `acept-02-sin-foto-manada` (Manada, cantidad 5) | 1. Tocar «Reportar sin foto»; 2. Elegir «Avistamiento» y «Manada»; 3. Escribir la cantidad `5`; 4. Tocar «Enviar reporte» | El formulario indica «Sin foto»; al elegir «Manada» se pide la cantidad; aparece «Reporte enviado» | <pendiente: RUN-n en docs/testing/TEST_LOG.md> | <pendiente> |
| TC-ACEPTACION-03<br>excepción | HU-04; RF04 | Formulario de manada abierto; entrada `acept-03-cantidad-fuera-de-rango` (cantidad 1001) | 1. Escribir la cantidad `1001`; 2. Tocar «Enviar reporte» | Aparece «Escribe un número entero entre 2 y 1000.»; el reporte no se envía ni queda guardado para después | <pendiente: RUN-n en docs/testing/TEST_LOG.md> | <pendiente> |
| TC-ACEPTACION-04<br>excepción | HU-09; RF09 | Cámara abierta con el indicador «Validación offline lista»; escena ESC-B (sin perro) | 1. Tomar la foto de la escena sin perro | Aparece «No detectamos un perro en la foto.» con la opción «Tomar otra»; no se crea un reporte con esa foto | <pendiente: RUN-n en docs/testing/TEST_LOG.md> | <pendiente> |
| TC-ACEPTACION-05<br>normal | HU-01; RF01, RNF12 | Modo avión activado; entrada `acept-05-sin-red` (Avistamiento, Solitario; con foto ESC-A o sin foto) | 1. Crear el reporte y tocar «Enviar reporte»; 2. Volver a la cámara y ver el aviso; 3. Desactivar modo avión; 4. Esperar o tocar «Reintentar ahora» | Sin red aparece «Reporte guardado para sincronizar» y el aviso con el conteo; al volver la red pasa a «Reportes sincronizados» y el aviso de pendientes desaparece (conteo en 0); se anota el UUID mostrado y, en TC-ACEPTACION-11, la cola de moderación muestra un solo reporte con ese UUID, sin duplicados | <pendiente: RUN-n en docs/testing/TEST_LOG.md> | <pendiente> |
| TC-ACEPTACION-06<br>normal | HU-10, HU-11, HU-12, HU-13, HU-14; RF10, RF11, RF12, RF13, RF14, RNF13 | Con red y sin sesión; reportes sembrados y los de TC-ACEPTACION-01 y 02 aprobados | 1. Tocar «Ver mapa»; 2. Observar los círculos; 3. Tocar un círculo y leer el detalle; 4. Acercar con los dedos hasta ver pines; 5. Tocar un pin | Los reportes cercanos se agrupan en círculos con su número; un círculo con más reportes se ve más grande y su color indica la mayor gravedad; el detalle muestra «Mayor gravedad» y el conteo de las seis categorías; al acercar aparecen pines con tipo, color y fecha y hora en ubicación aproximada | <pendiente: RUN-n en docs/testing/TEST_LOG.md> | <pendiente> |
| TC-ACEPTACION-07<br>excepción | HU-10; RF10 | Modo avión activado | 1. Abrir el mapa sin red; 2. Desactivar modo avión; 3. Tocar «Reintentar» | Aparece «El mapa no está disponible sin conexión» y que se pueden seguir creando reportes; al volver la red, «Reintentar» muestra el mapa | <pendiente: RUN-n en docs/testing/TEST_LOG.md> | <pendiente> |
| TC-ACEPTACION-08<br>normal | HU-15, HU-16; RF15, RF16 | Sesión cerrada; cuenta de Asociación (credenciales fuera de Git); reportes aprobados en los últimos 7 días; entrada `acept-08-panel-periodo` | 1. En la cámara, tocar «Acceso de personal»; 2. Iniciar sesión con la cuenta de Asociación; 3. Elegir «Últimos 7 días»; 4. Tocar «Consultar»; 5. Revisar el resumen y una tarjeta | Abre «Panel de la Asociación» sin opción de registro; muestra el total, el resumen por fecha de aceptación y tarjetas solo con datos de negocio (ID, fechas, coordenadas, características del perro y detalles), sin datos de moderación ni de operadores | <pendiente: RUN-n en docs/testing/TEST_LOG.md> | <pendiente> |
| TC-ACEPTACION-09<br>normal | HU-17; RF17 | Consulta con resultados de TC-ACEPTACION-08; entrada `acept-09-exportacion` | 1. Tocar «CSV» y guardar o compartir el archivo; 2. Repetir con «XLSX»; 3. Abrir ambos archivos en el teléfono o en una computadora | Se generan los dos archivos; cada uno tiene una fila de encabezado con las 12 columnas `id`, `accepted_at`, `occurred_at`, `incident_type`, `sighting_type`, `details`, `predominant_color`, `size`, `has_collar`, `longitude`, `latitude` y `has_sanitized_photo`; el número de filas de datos (sin encabezado) es igual al «Total de reportes» del panel; el ID de al menos una tarjeta del panel aparece en ambos archivos con la misma fecha de aceptación | <pendiente: RUN-n en docs/testing/TEST_LOG.md> | <pendiente> |
| TC-ACEPTACION-10<br>excepción | HU-16, HU-17; RF16, RF17 | Panel de la Asociación abierto; entrada `acept-10-rangos` | 1. Elegir un rango personalizado del `2020-01-01` al `2020-01-02` y consultar; 2. Elegir del `2026-10-10` al `2026-10-01` y consultar | (1) «No hay resultados en este rango.» y la exportación queda deshabilitada; (2) «La fecha final debe ser igual o posterior a la inicial.» y no se consulta | <pendiente: RUN-n en docs/testing/TEST_LOG.md> | <pendiente> |
| TC-ACEPTACION-11<br>normal | HU-18, HU-19, HU-20; RF18, RF19, RF20 | Sesión cerrada; cuenta de Administrator (credenciales fuera de Git); reportes de TC-ACEPTACION-01, 02 y 05 pendientes; entrada `acept-11-moderacion` | 1. «Acceso de personal» e iniciar sesión como Administrator; 2. En «Cola de moderación», ubicar los reportes creados en los casos por su UUID; 3. «Aprobar» los de 01 y 02; 4. «Ocultar» el de 05 con su motivo; 5. «Restaurar» ese mismo reporte con motivo; 6. «Eliminar» ese mismo reporte con motivo | Abre «Command Center» sin el panel ni la exportación de la Asociación; ocultar, restaurar y eliminar piden motivo; ocultar lo deja en la cola y ya no es público; restaurar lo devuelve a «Pendiente» (no público hasta aprobarse); al eliminar, el aviso indica que el reporte dejará de mostrarse pero podrá restaurarse, y el reporte desaparece de la cola (también al actualizarla) y no aparece en el mapa; la reversión de un eliminado no se ejecuta desde la app en esta ejecución porque los eliminados no aparecen en la cola | <pendiente: RUN-n en docs/testing/TEST_LOG.md> | <pendiente> |
| TC-ACEPTACION-12<br>excepción | HU-20; RF20 | Sesión de Administrator; reporte de TC-ACEPTACION-05 pendiente en la cola; entrada `acept-12-motivo-vacio` | 1. Tocar «Ocultar» en ese reporte; 2. Dejar el motivo vacío e intentar confirmar; 3. Cancelar | El botón «Confirmar ocultar» permanece deshabilitado mientras el motivo está vacío; el reporte no cambia de estado | <pendiente: RUN-n en docs/testing/TEST_LOG.md> | <pendiente> |

## Conformidad

Veredicto del equipo, no conformidad del socio formador: el socio no ejecuta los
casos y su conformidad no se obtuvo por decisión del equipo (2026-10-12).

| Fecha y versión evaluada | Veredicto del equipo | Observaciones y condiciones | Evidencia |
|---|---|---|---|
| <pendiente> | <aceptado/aceptado con observaciones/rechazado; solo tras ejecutar los 12 casos> | <pendientes y responsables> | <ruta completa o URL> |

Registrar cada ejecución en `docs/testing/TEST_LOG.md`. Ante una falla, abrir
inmediatamente incidente en `docs/testing/INCIDENTS.md` y bug en Jira. El
veredicto del equipo y el resultado técnico de un caso son registros distintos;
no se registran resultados que no se hayan observado.
