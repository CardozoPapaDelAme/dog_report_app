# Casos de prueba — Aceptación con el socio formador

Estado: casos ejecutados en la sesión del 18 de octubre de 2026; el resultado y
las observaciones del socio están en `docs/testing/ACCEPTANCE.md`. Convenciones:
`docs/testing/README.md`. Casos base: `TC-ACEPTACION-01`, `05`, `06`, `08`, `09` y
`11` de `docs/testing/ACCEPTANCE.md`. Valores exactos en
`docs/testing/data/aceptacion-entradas.json`.

Formato Given / When / Then, con escenario, pasos, entrada, resultado esperado y
postcondiciones. Cinco casos de negocio, todos de tipo `normal`; los límites y
excepciones ya los cubren `docs/testing/cases/reportero.md` y
`docs/testing/cases/mapa-y-roles.md`.

## TC-CLIENTE-01 · Crear un reporte con foto

Requerimientos: HU-01, HU-02, HU-03, HU-06, HU-07; RF01, RF02, RF03, RF06, RF07.

| Campo | Contenido |
|---|---|
| Scenario | **GIVEN** estoy dentro de la zona de prueba, con conexión y sin iniciar sesión. **WHEN** tomo la foto de un perro, completo el formulario y envío el reporte. **THEN** la app confirma el envío y muestra el identificador, sin solicitar mis datos personales. |
| Preconditions | App en la cámara, permisos habilitados y un perro o su imagen nítida disponible. |
| Steps | 1. Abrir la app y tomar la foto. 2. Elegir Avistamiento / Solitario y describir. 3. Enviar y anotar el identificador. |
| Input | Foto nítida de un perro. Tipo: Avistamiento. Clasificación: Solitario. Descripción: Prueba de aceptación. |
| Expected output | «Reporte enviado» y su identificador. No se pide nombre, teléfono ni correo; se muestra el aviso de evitar datos personales. |
| Post-conditions | El reporte queda registrado con el identificador anotado. El reportero no necesita una cuenta. |

## TC-CLIENTE-02 · Reportar sin conexión y sincronizar

Requerimientos: HU-01, HU-05; RF01, RF05, RNF12.

| Campo | Contenido |
|---|---|
| Scenario | **GIVEN** la app está abierta dentro de la zona de prueba y no tengo conexión. **WHEN** envío un reporte sin foto y después recupero internet. **THEN** el reporte se guarda como pendiente y luego se sincroniza una sola vez. |
| Preconditions | Permiso de ubicación habilitado; modo avión activado y acceso a internet al desactivarlo. |
| Steps | 1. Elegir Reportar sin foto y completar el caso. 2. Enviar sin red y comprobar el pendiente. 3. Desactivar modo avión y volver a la app. |
| Input | Sin foto. Tipo: Avistamiento. Clasificación: Solitario. Red: sin conexión y luego con internet. |
| Expected output | Sin red: «Reporte guardado para sincronizar». Con internet: confirmación de sincronización y retiro del pendiente. |
| Post-conditions | El facilitador comprueba un solo reporte con el mismo identificador; ya no queda pendiente en la app. |

## TC-CLIENTE-03 · Consultar zonas de riesgo en el mapa

Requerimientos: HU-10, HU-11, HU-12, HU-13, HU-14; RF10–RF14, RNF13.

| Campo | Contenido |
|---|---|
| Scenario | **GIVEN** tengo internet y hay reportes cercanos, visibles y recientes, de distintas categorías. **WHEN** abro el mapa, selecciono un grupo y acerco hasta abrir un reporte individual. **THEN** veo cantidad, gravedad, conteos por categoría y detalle con ubicación aproximada. |
| Preconditions | Mapa disponible y reportes de prueba preparados para mostrar grupos y reportes individuales. |
| Steps | 1. Entrar a Ver mapa y seleccionar un grupo. 2. Revisar sus conteos y acercar el mapa. 3. Seleccionar un reporte y consultar el detalle. |
| Input | Reportes visibles y recientes. Varios cercanos entre sí. Categorías distintas. Conexión a internet disponible. |
| Expected output | El grupo muestra cantidad, gravedad y conteos por categoría. El reporte muestra tipo, fecha y ubicación aproximada. |
| Post-conditions | Se consultó el detalle sin modificar reportes ni exponer su ubicación exacta. |

## TC-CLIENTE-04 · Consultar y exportar datos de la Asociación

Requerimientos: HU-15, HU-16, HU-17; RF15, RF16, RF17.

| Campo | Contenido |
|---|---|
| Scenario | **GIVEN** tengo cuenta de la Asociación y reportes aceptados y canónicos de los últimos siete días. **WHEN** inicio sesión, consulto ese período y exporto los resultados en CSV y XLSX. **THEN** el panel y ambos archivos contienen los mismos reportes autorizados. |
| Preconditions | Cuenta de la Asociación disponible y datos de prueba dentro del período que se consultará. |
| Steps | 1. Ingresar por Acceso de personal. 2. Consultar Últimos 7 días y revisar el total. 3. Guardar y abrir los archivos CSV y XLSX. |
| Input | Cuenta de la Asociación. Período: Últimos 7 días. Formatos: CSV y XLSX. |
| Expected output | El panel muestra total y resumen por fecha. CSV y XLSX tienen ese total de filas de datos (sin contar encabezados); excluyen moderación y operadores. |
| Post-conditions | Ambos archivos están guardados y se comprobó su coincidencia con la consulta del panel. |

## TC-CLIENTE-05 · Ocultar un reporte con una justificación

Requerimientos: HU-18, HU-19, HU-20; RF18, RF19, RF20.

| Campo | Contenido |
|---|---|
| Scenario | **GIVEN** estoy autenticado como Administrator y hay un reporte de prueba visible que puedo ocultar. **WHEN** selecciono Ocultar, escribo el motivo y confirmo la acción. **THEN** el reporte queda oculto y deja de aparecer en el mapa al actualizarlo. |
| Preconditions | Cuenta Administrator activa y reporte identificado, visible y disponible en moderación. |
| Steps | 1. Seleccionar el reporte y tocar Ocultar. 2. Escribir el motivo y confirmar. 3. Actualizar el mapa y revisar moderación. |
| Input | Cuenta: Administrator. Reporte de prueba identificado. Motivo: Prueba de aceptación: ocultar. |
| Expected output | Reporte oculto y ausente del mapa actualizado. En moderación se reconoce como oculto y ofrece la opción de restaurarlo. |
| Post-conditions | El reporte conserva su contenido; ocultarlo no es borrarlo definitivamente y la acción es reversible. |
