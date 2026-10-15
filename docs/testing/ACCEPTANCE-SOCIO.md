# Test cases para el socio formador

Cinco casos principales con escenario, pasos y resultados (`TC-CLIENTE-01` a
`TC-CLIENTE-05`), en el formato Given / When / Then. Sesión del 15 de octubre de
2026, con el equipo operando el teléfono y el socio formador dictaminando.

| Campo | Valor (se llena el día de la sesión) |
|---|---|
| Fecha, hora y zona | |
| Build / commit de `main` instalado | |
| Dispositivo y versión de iOS (iPhone) | |
| Entorno | Staging (no producción) |
| Opera el teléfono | |
| Socio formador | |

## Condiciones de entrada

1. Build nativo instalado en un iPhone físico (no Expo Go ni simulador), apuntando a
   staging, con el teléfono dentro del geofence de prueba descrito en
   `docs/DEPLOYMENT.md`; ubicación y cámara permitidas. Instalación por development
   build o TestFlight: confirmarla antes de la sesión.
2. Cuentas de Asociación y de Administrator disponibles; las credenciales se teclean
   en el momento y no se escriben en Git ni en capturas.
3. Al menos tres reportes de prueba, de categorías distintas, ya aprobados por el
   Administrator, para que el mapa y el panel tengan contenido.
4. Imagen de un perro (impresa o en otra pantalla). Sin personas, placas ni
   domicilios en cuadro.
5. Aviso: la sesión alfa (`docs/testing/ALPHA.md`) se hizo en Android; en iPhone real
   no se han ejecutado estos flujos. Hacer un ensayo previo, en especial cámara y
   validación de foto (TC-CLIENTE-01), modo avión (02) y guardar/compartir CSV y
   XLSX (04). En iOS el modo avión se activa desde el Centro de control.
6. Duración estimada: 45 a 60 minutos. Orden: 01, 02, 05, 03, 04.

Valores exactos a escribir: `docs/testing/data/aceptacion-entradas.json` (claves
`acept-01-reporte-con-foto`, `acept-05-sin-red`, `acept-08-panel-periodo`,
`acept-09-exportacion`, `acept-11-moderacion`). Casos base:
`docs/testing/ACCEPTANCE.md` y `docs/testing/cases/alpha.md`.

## TC-CLIENTE-01 · Crear un reporte con foto

Requerimientos: HU-01, HU-02, HU-03, HU-06, HU-07; RF01, RF02, RF03, RF06, RF07.
Base: `TC-ACEPTACION-01`.

| Campo | Contenido |
|---|---|
| Scenario | **GIVEN** estoy dentro de la zona de prueba, con conexión y sin iniciar sesión. **WHEN** tomo la foto de un perro, completo el formulario y envío el reporte. **THEN** la app confirma el envío y muestra el identificador, sin solicitar mis datos personales. |
| Preconditions | App en la cámara, permisos habilitados y un perro o su imagen nítida disponible. |
| Steps | 1. Abrir la app y tomar la foto. 2. Elegir Avistamiento / Solitario y describir. 3. Enviar y anotar el identificador. |
| Input | Foto nítida de un perro. Tipo: Avistamiento. Clasificación: Solitario. Descripción: Prueba de aceptación. |
| Expected output | «Reporte enviado» y su identificador. No se pide nombre, teléfono ni correo; se muestra el aviso de evitar datos personales. |
| Post-conditions | El reporte queda registrado con el identificador anotado. El reportero no necesita una cuenta. |

## TC-CLIENTE-02 · Reportar sin conexión y sincronizar

Requerimientos: HU-01, HU-05; RF01, RF05, RNF12. Base: `TC-ACEPTACION-05`.

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
Base: `TC-ACEPTACION-06`.

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
Base: `TC-ACEPTACION-08` y `TC-ACEPTACION-09`.

| Campo | Contenido |
|---|---|
| Scenario | **GIVEN** tengo cuenta de la Asociación y reportes aceptados y canónicos de los últimos siete días. **WHEN** inicio sesión, consulto ese período y exporto los resultados en CSV y XLSX. **THEN** el panel y ambos archivos contienen los mismos reportes autorizados. |
| Preconditions | Cuenta de la Asociación disponible y datos de prueba dentro del período que se consultará. |
| Steps | 1. Ingresar por Acceso de personal. 2. Consultar Últimos 7 días y revisar el total. 3. Guardar y abrir los archivos CSV y XLSX. |
| Input | Cuenta de la Asociación. Período: Últimos 7 días. Formatos: CSV y XLSX. |
| Expected output | El panel muestra total y resumen por fecha. CSV y XLSX tienen ese total de filas de datos (sin contar encabezados); excluyen moderación y operadores. |
| Post-conditions | Ambos archivos están guardados y se comprobó su coincidencia con la consulta del panel. |

## TC-CLIENTE-05 · Ocultar un reporte con una justificación

Requerimientos: HU-18, HU-19, HU-20; RF18, RF19, RF20. Base: `TC-ACEPTACION-11`.

| Campo | Contenido |
|---|---|
| Scenario | **GIVEN** estoy autenticado como Administrator y hay un reporte de prueba visible que puedo ocultar. **WHEN** selecciono Ocultar, escribo el motivo y confirmo la acción. **THEN** el reporte queda oculto y deja de aparecer en el mapa al actualizarlo. |
| Preconditions | Cuenta Administrator activa y reporte identificado, visible y disponible en moderación. |
| Steps | 1. Seleccionar el reporte y tocar Ocultar. 2. Escribir el motivo y confirmar. 3. Actualizar el mapa y revisar moderación. |
| Input | Cuenta: Administrator. Reporte de prueba identificado. Motivo: Prueba de aceptación: ocultar. |
| Expected output | Reporte oculto y ausente del mapa actualizado. En moderación se reconoce como oculto y ofrece la opción de restaurarlo. |
| Post-conditions | El reporte conserva su contenido; ocultarlo no es borrarlo definitivamente y la acción es reversible. |

## Resultados y conformidad del socio

Registrar: pasó, no pasó o bloqueado. Agregar la observación del socio. Completar
únicamente con resultados observados.

| Caso | Resultado | Observación del socio |
|---|---|---|
| 01 Reporte con foto | | |
| 02 Sin conexión y sincronización | | |
| 03 Mapa y zonas de riesgo | | |
| 04 Panel y exportación | | |
| 05 Moderación con motivo | | |

| Veredicto (marcar uno) | Observaciones y condiciones | Fecha / nombre / firma |
|---|---|---|
| ☐ Aceptado ☐ Aceptado con observaciones ☐ Rechazado | | |

## Registro posterior

Cada caso ejecutado se registra como fila `RUN-<n>` nueva en `docs/testing/TEST_LOG.md`.
Un caso que no pase abre un `INC-<n>` en `docs/testing/INCIDENTS.md` y su ticket de bug
en Jira. No se registran resultados que no se hayan observado.
