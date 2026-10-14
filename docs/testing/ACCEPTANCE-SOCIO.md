# Matriz de pruebas de aceptación con el socio formador

Sesión de aceptación del **15 de octubre de 2026**. El equipo opera el teléfono;
el socio formador observa y dictamina. Esta matriz es la versión para el socio de
los casos `TC-ACEPTACION-01` a `TC-ACEPTACION-12` de `docs/testing/ACCEPTANCE.md`
(más la denuncia, `TC-ALPHA-22` y `TC-ALPHA-23` de `docs/testing/cases/alpha.md`).
Convenciones: `docs/testing/README.md`.

| Campo | Valor (se llena el día de la sesión) |
|---|---|
| Fecha, hora y zona | |
| Build / commit de `main` instalado | |
| Dispositivo y versión de Android | |
| Entorno | Staging (no producción) |
| Opera el teléfono | |
| Socio formador | |

## Condiciones de entrada

1. Build nativo instalado (no Expo Go), apuntando a staging, con el teléfono dentro
   del geofence de prueba descrito en `docs/DEPLOYMENT.md`; ubicación y cámara permitidas.
2. Cuentas de Asociación y de Administrator disponibles; las credenciales se teclean
   en el momento y no se escriben en Git ni en capturas.
3. Al menos tres reportes de prueba, de categorías distintas, ya aprobados por el
   Administrator, para que el mapa y el panel tengan contenido.
4. Imagen de un perro (impresa o en otra pantalla) y una escena sin perro. Sin
   personas, placas ni domicilios en cuadro.
5. Duración estimada: 60 a 90 minutos. Orden sugerido: 01–05, 12–13, 06–08, 09–11.

Valores exactos a escribir en cada caso: `docs/testing/data/aceptacion-entradas.json`
(claves `acept-nn-...`). Para la denuncia: motivo «Otro» y detalle `Prueba de aceptación`.

## Matriz

Las columnas **Pasó / No pasó** y **Comentario** van vacías: se llenan durante la sesión.

| ID | Actor | Qué valida para el negocio | Req. | Tipo | Qué haremos | Qué debe ocurrir | Datos de entrada | Pasó / No pasó | Comentario |
|---|---|---|---|---|---|---|---|---|---|
| TC-SOCIO-01 | Reportero público | Cualquier persona reporta un perro en segundos, sin cuenta ni datos personales | HU-01, HU-02, HU-03, HU-06, HU-07; RF01, RF02, RF03, RF06, RF07 | normal | Abrir la app, tomar la foto del perro, leer el aviso, elegir «Avistamiento» y «Solitario», escribir una descripción y enviar | La app abre en la cámara; la foto se acepta; el aviso pide no ingresar datos personales y no hay campos de nombre, teléfono ni correo; aparece «Reporte enviado» | `acept-01-reporte-con-foto`; perro nítido | | |
| TC-SOCIO-02 | Reportero público | Se puede reportar rápido aunque no haya foto | HU-04, HU-05; RF04, RF05 | normal | Tocar «Reportar sin foto», elegir «Avistamiento» y «Manada», escribir cantidad 5 y enviar | El formulario indica «Sin foto»; pide la cantidad de la manada; aparece «Reporte enviado» | `acept-02-sin-foto-manada` | | |
| TC-SOCIO-03 | Reportero público | Los datos absurdos no ensucian la información de la Asociación | HU-04; RF04 | excepción | En una manada, escribir cantidad 1001 y enviar; repetir con 1 | «Escribe un número entero entre 2 y 1000.»; el reporte no se envía ni se guarda | `acept-03-cantidad-fuera-de-rango`; también `1` | | |
| TC-SOCIO-04 | Reportero público | Solo entran fotos de perros; la revisión ocurre en el teléfono | HU-09; RF09 | excepción | Tomar la foto de una escena sin perro | «No detectamos un perro en la foto.» con opción «Tomar otra»; no se crea reporte | `acept-04-foto-sin-perro` | | |
| TC-SOCIO-05 | Reportero público | En zonas con mala señal el reporte no se pierde ni se duplica | HU-01; RF01, RNF12 | normal | Activar modo avión, crear y enviar un reporte; volver a la cámara; desactivar modo avión y esperar la sincronización | Sin red: «Reporte guardado para sincronizar» y aviso de pendientes; con red: «Reportes sincronizados» y el aviso desaparece; el reporte aparece una sola vez en la cola de moderación | `acept-05-sin-red` | | |
| TC-SOCIO-06 | Público general | El mapa muestra dónde hay problemas sin revelar ubicaciones exactas | HU-10, HU-11, HU-12, HU-13, HU-14; RF10–RF14, RNF13 | normal | Tocar «Ver mapa»; observar los círculos; tocar uno; acercar hasta ver pines; tocar un pin | Los reportes cercanos se agrupan con su número; más reportes, círculo más grande; el color indica la mayor gravedad; el detalle muestra el conteo por categoría; los pines muestran tipo, fecha y ubicación aproximada | Reportes aprobados de las condiciones de entrada | | |
| TC-SOCIO-07 | Público general | Sin internet la app lo dice con claridad y sigue permitiendo reportar | HU-10; RF10 | excepción | Con modo avión, abrir el mapa; desactivar modo avión y tocar «Reintentar» | «El mapa no está disponible sin conexión» y se puede seguir creando reportes; al volver la red, el mapa aparece | Modo avión | | |
| TC-SOCIO-08 | Público general | La comunidad ayuda a detectar reportes falsos sin tener cuenta | HU-08; RF08, RNF29 | normal y excepción | Abrir un reporte de prueba propio y tocar «Denunciar»; enviar sin motivo; enviar con motivo «Otro» y detalle; denunciar otra vez | Sin motivo no se puede enviar; con motivo aparece «Gracias. Revisaremos el reporte.»; la segunda vez dice «Ya denunciaste este reporte.» | Motivo «Otro»; detalle `Prueba de aceptación` | | |
| TC-SOCIO-09 | Asociación de Hoteles | La Asociación consulta solo datos de negocio, con cuenta provisionada | HU-15, HU-16; RF15, RF16 | normal | En la cámara, «Acceso de personal»; iniciar sesión como Asociación; elegir «Últimos 7 días» y «Consultar»; revisar resumen y una tarjeta | Abre «Panel de la Asociación» sin opción de registro; muestra total, resumen por fecha y tarjetas con datos del perro y del hecho, sin datos de moderación ni de operadores | `acept-08-panel-periodo`; cuenta de Asociación | | |
| TC-SOCIO-10 | Asociación de Hoteles | La Asociación se lleva la información a Excel o CSV para sus propios análisis | HU-17; RF17 | normal | Con la consulta anterior, tocar «CSV» y guardar; repetir con «XLSX»; abrir ambos archivos | Se generan los dos archivos con las mismas columnas; el número de filas es igual al «Total de reportes» del panel | `acept-09-exportacion` | | |
| TC-SOCIO-11 | Asociación de Hoteles | Consultas sin resultados o con fechas erróneas no confunden | HU-16, HU-17; RF16, RF17 | excepción | Consultar del 2020-01-01 al 2020-01-02; después del 2026-10-10 al 2026-10-01 | (1) «No hay resultados en este rango.» y la exportación queda deshabilitada; (2) «La fecha final debe ser igual o posterior a la inicial.» | `acept-10-rangos` | | |
| TC-SOCIO-12 | Administrator | Solo reportes revisados llegan al mapa y a la Asociación; cada acción queda justificada | HU-18, HU-19, HU-20; RF18, RF19, RF20 | normal | Iniciar sesión como Administrator; en «Cola de moderación» aprobar dos reportes; ocultar, restaurar y eliminar un tercero, escribiendo motivo | Abre «Command Center» sin el panel de la Asociación; cada acción pide motivo; ocultar lo retira del mapa; restaurar lo devuelve a «Pendiente»; eliminar es reversible y lo quita de la cola | `acept-11-moderacion`; cuenta de Administrator | | |
| TC-SOCIO-13 | Administrator | No se puede ocultar un reporte sin dejar el porqué | HU-20; RF20 | excepción | Tocar «Ocultar» en un reporte pendiente, dejar el motivo vacío y cancelar | «Confirmar ocultar» permanece deshabilitado sin motivo; el reporte no cambia de estado | `acept-12-motivo-vacio` | | |

Fuera de esta sesión: duplicados (RF23), umbrales y zonas del Administrator; ya
probados en la sesión alfa (`docs/testing/ALPHA.md`).

## Veredicto del socio formador

| Veredicto (marcar uno) | Observaciones y condiciones | Fecha | Nombre y firma |
|---|---|---|---|
| ☐ Aceptado ☐ Aceptado con observaciones ☐ Rechazado | | | |

## Registro posterior

Cada caso ejecutado se registra como fila `RUN-<n>` nueva en `docs/testing/TEST_LOG.md`.
Un caso que no pase abre un `INC-<n>` en `docs/testing/INCIDENTS.md` y su ticket de bug
en Jira. No se registran resultados que no se hayan observado.
