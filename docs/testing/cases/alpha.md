# Casos de prueba — módulo ALPHA (prueba alfa en dispositivo)

Estado: casos definidos por T7 / TD-120 y ejecutados en Android real en la sesión
documentada en `docs/testing/ALPHA.md`. Las filas `RUN-83` a `RUN-116` en
`docs/testing/TEST_LOG.md` registran los resultados; este archivo conserva las
entradas y resultados esperados. Convenciones: `docs/testing/README.md`.
Procedimiento, preparación y registro de la sesión: `docs/testing/ALPHA.md`.

Fuentes: `docs/product/ETAPA1-REQUERIMIENTOS-V2.md` (RF01–RF24, RNF04, RNF05,
RNF08, RNF12), `docs/product/APPROVED-CLARIFICATIONS.md` (aclaración 5: zonas y
umbrales del Administrator), textos de pantalla de `i18n/locales/es.json` y
`docs/DEPLOYMENT.md` (geofence de staging «TEST ONLY»).
Responsable: P2 (Juan Pablo De León Gómez) coordina; ejecuta todo el equipo.
Tipos no aplicables: `mínimo`/`máximo`/`promedio` solo existen donde hay un rango
numérico (cantidad de la manada, TC-ALPHA-08 a TC-ALPHA-11); en el resto se usa
`normal` o `excepción`. RF21 (ocultar por denuncias de orígenes distintos) no se
puede ejecutar con un solo teléfono y se cubre con la suite PostgreSQL
`supabase/functions/api/tests/flag-postgres.test.js` (ver límites en `ALPHA.md`).

## Escenas y datos de entrada

La cámara toma fotos en vivo, así que las «fotos» son escenas frente al teléfono.
Usar objetos propios; sin personas, placas, domicilios ni datos personales.

| Clave | Escena |
|---|---|
| ESC-A | Un perro real, o su imagen impresa o en otra pantalla, nítido y con buena luz |
| ESC-B | Una escena sin perro (pared, objeto, paisaje) |
| ESC-C | ESC-A tomada con la cámara en movimiento o desenfocada a propósito |
| ESC-D | Perros de color negro, blanco, café, gris y dorado, uno por captura (vocabulario RF22) |

Cuentas: una de Asociación y una de Administrator, provisionadas manualmente en
staging; las credenciales se piden al equipo y **no se escriben en Git** ni en
capturas. Reportes de la sesión: crear los propios y usar solo esos para denunciar,
ocultar o resolver duplicados; no actuar sobre reportes de otras personas.

## Entrada → resultado esperado

Cada caso cita el test automatizado más cercano solo como referencia: corre en
navegador o con servicios simulados y **no sustituye** la ejecución en dispositivo.
Evidencia manual: captura o video en `docs/testing/data/alpha/` (ver `ALPHA.md`).

### Arranque, cámara y validación de foto

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|
| TC-ALPHA-01 | RF07, RNF05 | normal | Build de desarrollo o release instalado (no Expo Go) en Android 8.0 o superior; permiso de cámara aún no concedido | Ninguna | 1. Abrir la app desde el ícono; 2. Conceder el permiso de cámara cuando se pida | La primera pantalla es la cámara. Sin permiso muestra «Permite el acceso a la cámara» y el botón «Permitir cámara»; al concederlo aparece «Toma una foto clara del perro» | Evidencia manual: captura de la pantalla inicial y de la versión de Android en `docs/testing/data/alpha/` |
| TC-ALPHA-02 | RF05 | normal | Cámara abierta | Ninguna | 1. Sin tocar nada más, localizar el acceso para reportar sin foto | «Reportar sin foto» es visible en la pantalla de cámara sin desplazarse | Evidencia manual: captura. Referencia: `tests/ui/reportForm.spec.js` |
| TC-ALPHA-03 | RF09, RNF08 | normal | Cámara abierta con red | ESC-A | 1. Esperar a que el indicador del modelo diga «Validación offline lista»; 2. Tomar foto de ESC-A | La foto se acepta y se pasa al borrador/formulario; no se pide repetirla; se muestran probabilidad de perro y sin error | Evidencia manual: video corto. Referencia: `services/photoInference.test.js` (`PV-1 dog + sharp photo is accepted (float32 logits, input scaled to 0..1)`) |
| TC-ALPHA-04 | RF09, RNF08 | excepción | Cámara abierta, modelo listo | ESC-B | 1. Tomar foto de ESC-B | Rechazo con «No detectamos un perro en la foto.» y opción «Tomar otra»; no se crea reporte con esa foto | Evidencia manual: captura del mensaje. Referencia: `services/photoInference.test.js` (`PV-1 non-dog class sums below the threshold and is rejected as no_dog`) |
| TC-ALPHA-05 | RF09 | excepción | Cámara abierta, modelo listo | ESC-C | 1. Tomar foto de ESC-C | Rechazo con «La foto está borrosa.» y opción «Tomar otra» | Evidencia manual: captura del mensaje. Referencia: `services/photoInference.test.js` (`PV-1 flat (blurry) dog photo is rejected as blurry; both failures report both reasons`) |
| TC-ALPHA-06 | RF09, RNF08, RNF12 | normal | Modo avión activado antes de abrir la cámara; modelo ya cargado | ESC-A | 1. Activar modo avión; 2. Tomar foto de ESC-A | La validación ocurre en el teléfono sin red: la foto se acepta igual que en TC-ALPHA-03 | Evidencia manual: video con el ícono de modo avión visible |
| TC-ALPHA-07 | RF22 | normal | Foto aceptada de cada color de ESC-D, formulario abierto | ESC-D (negro, blanco, café, gris, dorado) | 1. Tomar la foto; 2. Observar el color sugerido; 3. Cambiarlo manualmente en un caso; 4. Dejar tamaño y collar sin responder en otro | El color predominante se sugiere solo en el teléfono; el usuario puede cambiarlo y su elección prevalece; tamaño y collar son opcionales y el envío no los exige | Evidencia manual: capturas por color. Referencia: `models/dogColor.test.js` |

### Reporte público

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|
| TC-ALPHA-08 | RF01, RF03, RF04, RF06, RF24 | mínimo | Con red; foto aceptada (ESC-A); ubicación concedida y dentro del geofence de staging | Incidente «Avistamiento», «Manada», cantidad aproximada `2`, sin descripción | 1. Llenar el formulario; 2. «Enviar reporte» | «Reporte enviado»; sin «Foto rechazada»; el UUID mostrado se anota para buscarlo después | Evidencia manual: captura con el UUID. Referencia: `models/reportPayload.test.js` (`L7 form requires pack quantity from 2 to 1000 only for avistamiento manada`) |
| TC-ALPHA-09 | RF04 | máximo | Igual que TC-ALPHA-08 | «Manada», cantidad aproximada `1000` | 1. Llenar el formulario; 2. «Enviar reporte» | Aceptado: «Reporte enviado» | Evidencia manual: captura. Referencia: `models/reportPayload.test.js` |
| TC-ALPHA-10 | RF04 | excepción | Formulario de manada abierto | Cantidad aproximada `1001` | 1. Escribir `1001`; 2. «Enviar reporte» | Error «Escribe un número entero entre 2 y 1000.»; no se envía ni se guarda en la cola | Evidencia manual: captura del error. Referencia: `models/reportPayload.test.js` |
| TC-ALPHA-11 | RF04 | excepción | Formulario de manada abierto | Cantidad aproximada `1` | 1. Escribir `1`; 2. «Enviar reporte» | Mismo error de rango; no se envía | Evidencia manual: captura del error. Referencia: `models/reportPayload.test.js` |
| TC-ALPHA-12 | RF04, RF06, RF24 | normal | Formulario abierto con foto aceptada | Una vez «Solitario» con incidente «Avistamiento»; otra con incidente «Ataque a mascota» | 1. Elegir «Solitario» y observar el formulario; 2. Cambiar a «Ataque a mascota» y observar; 3. Enviar uno de los dos | Con «Solitario» no se pide cantidad; cada categoría muestra solo sus preguntas; el reporte enviado se acepta | Evidencia manual: capturas de ambas variantes. Referencia: `tests/ui/reportForm.spec.js` |
| TC-ALPHA-13 | RF01, RF05 | normal | Cámara abierta, con red | Ninguna foto | 1. Tocar «Reportar sin foto»; 2. Llenar los campos obligatorios; 3. «Enviar reporte» | El formulario indica «Sin foto» y el reporte se envía y se acepta sin cuenta ni inicio de sesión | Evidencia manual: captura. Referencia: `tests/ui/reportForm.spec.js` |
| TC-ALPHA-14 | RF02 | normal | Formulario abierto | Ninguna | 1. Recorrer todo el formulario de reporte; 2. Buscar campos de nombre, teléfono, correo u otro dato personal; 3. Buscar un aviso de que foto y texto libre pueden contener información incidental | No hay campos que pidan identificadores personales. Se debe ver el aviso de información incidental que exige RF02; **si no aparece, registrar el hallazgo como incidente** (en `i18n/locales/es.json` no se encontró un texto así para el formulario) | Evidencia manual: capturas del formulario completo |

### Modo avión y sincronización (RNF12)

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|
| TC-ALPHA-15 | RNF12, RF01 | normal | Modo avión activado; foto aceptada (ESC-A) | Avistamiento solitario | 1. Llenar el formulario; 2. «Enviar reporte»; 3. Volver a la cámara | «Reporte guardado para sincronizar»; en la cámara el aviso «Reportes guardados para sincronizar» con el conteo; el reporte conserva su UUID | Evidencia manual: capturas y UUID. Referencia: `hooks/reportDraftQueueController.test.js` |
| TC-ALPHA-16 | RNF12 | normal | Reporte de TC-ALPHA-15 en cola | Ninguna | 1. Desactivar modo avión; 2. Esperar la sincronización automática o tocar «Reintentar ahora» | El aviso pasa por «Sincronizando reportes» a «Reportes sincronizados»; el reporte aparece **una sola vez** en el servidor con el mismo UUID (comprobar en la cola de moderación con TC-ALPHA-29) | Evidencia manual: video y captura de la cola. Referencia: `hooks/draftAutoSync.test.js` |
| TC-ALPHA-17 | RNF12 | excepción | Modo avión activado y un reporte en cola | Cierre forzado de la app | 1. Dejar un reporte en cola; 2. Cerrar la app desde multitarea; 3. Reabrir con modo avión aún activo; 4. Desactivar modo avión | La cola sobrevive al cierre (mismo conteo y UUID) y se sincroniza al recuperar la red, sin duplicar | Evidencia manual: video. Referencia: `hooks/reportDraftQueueController.test.js` |

### Mapa y detalle

Requieren build de desarrollo; Expo Go solo muestra la lista de reportes recientes.

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|
| TC-ALPHA-18 | RF10, RF11, RF12, RF13, RF14 | normal | Con red; al menos un reporte visible (el de TC-ALPHA-08 aprobado, si hizo falta) | Ninguna | 1. «Ver mapa»; 2. Observar clusters; 3. Acercar con «Acercar» o con gestos hasta zoom 17 | Se ven clusters con conteo, tamaño proporcional a la cantidad y color por la mayor gravedad; a zoom 17 pasan a pines individuales | Evidencia manual: capturas a zoom bajo y a zoom 17. Referencia: `tests/ui/publicMap.spec.js` |
| TC-ALPHA-19 | RF13 | normal | Mapa con un cluster | Ninguna | 1. Tocar un cluster | Detalle «N reportes en esta zona», «Mayor gravedad» y los conteos de las seis categorías; «Ver reportes de la zona» lista los reportes del área | Evidencia manual: captura. Referencia: `tests/ui/publicMap.spec.js` |
| TC-ALPHA-20 | RF10 | normal | Pin visible a zoom 17 | Ninguna | 1. Tocar un pin | Muestra tipo de incidente, color y fecha y hora; la ubicación es aproximada (cuadrícula de 50 m), no la coordenada exacta; la foto se muestra solo si el reporte la tiene | Evidencia manual: captura; comparar con las coordenadas del reporte original |
| TC-ALPHA-21 | RF10 | excepción | Modo avión activado | Ninguna | 1. Abrir el mapa sin red | «El mapa no está disponible sin conexión» y «Puedes seguir creando reportes; se enviarán cuando haya conexión.»; «Reintentar» recupera el mapa al volver la red | Evidencia manual: captura y video. Referencia: `tests/ui/publicMap.spec.js` |

### Denuncia

Usar **solo reportes propios de la sesión**: una denuncia puede ocultar el reporte.

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|
| TC-ALPHA-22 | RF08 | normal | Pin de un reporte propio abierto, con red | Motivo «Otro», detalle `Prueba alfa` | 1. «Denunciar»; 2. Elegir motivo; 3. Escribir detalle; 4. «Enviar denuncia» | «Gracias. Revisaremos el reporte.»; no se pidió cuenta; el reporte no se elimina | Evidencia manual: captura. Referencia: `tests/ui/publicMap.spec.js` |
| TC-ALPHA-23 | RF08 | excepción | Mismo pin que TC-ALPHA-22 | (a) sin motivo; (b) detalle de 1001 caracteres; (c) segunda denuncia del mismo teléfono | 1. Intentar enviar sin motivo; 2. Escribir 1001 caracteres; 3. Denunciar otra vez | (a) no se puede enviar; (b) «El detalle no puede superar 1000 caracteres.»; (c) «Ya denunciaste este reporte.» | Evidencia manual: capturas. Referencia: `tests/ui/publicMap.spec.js` |

### Asociación de Hoteles de Chihuahua

Se llega por «Acceso de personal» desde la cámara.

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|
| TC-ALPHA-24 | RF15 | excepción | Pantalla «Inicia sesión» | (a) correo válido con contraseña incorrecta; (b) credenciales correctas de Asociación | 1. Intentar (a); 2. Intentar (b) | (a) «No pudimos iniciar sesión o validar el acceso…» y no entra; (b) abre «Panel de la Asociación»; no existe opción de registro | Evidencia manual: capturas. Referencia: `controllers/loginController.test.js`, `tests/ui/login.spec.js` |
| TC-ALPHA-25 | RF16 | normal | Sesión de Asociación con reportes aceptados | Periodo «Últimos 7 días» | 1. Elegir el periodo; 2. «Consultar» | Total, resumen por fecha de aceptación y tarjetas con solo datos de negocio (ID, fechas, coordenadas, características del perro, detalles); ninguna señal de moderación, confianza, fingerprint ni operadores | Evidencia manual: capturas del resumen y de una tarjeta. Referencia: `tests/ui/associationDashboard.spec.js` |
| TC-ALPHA-26 | RF16 | excepción | Panel abierto | (a) rango personalizado `2020-01-01` a `2020-01-02`; (b) fecha `2026-13-40`; (c) fecha final anterior a la inicial | 1. Probar (a), (b) y (c) | (a) «No hay resultados en este rango.» con exportación deshabilitada; (b) «Usa una fecha válida con formato AAAA-MM-DD.»; (c) «La fecha final debe ser igual o posterior a la inicial.» | Evidencia manual: capturas. Referencia: `tests/ui/associationDashboard.spec.js` |
| TC-ALPHA-27 | RF17 | normal | Consulta con resultados (TC-ALPHA-25) | Formatos CSV y XLSX | 1. Tocar «CSV» y guardar o compartir; 2. Repetir con «XLSX»; 3. Abrir ambos archivos | Se generan ambos archivos; tienen las mismas filas y columnas que la proyección mostrada; las celdas son valores, no fórmulas | Evidencia manual: los archivos exportados con datos sintéticos en `docs/testing/data/alpha/`. Referencia: `models/associationWorkbook.test.js` |

### Administrator

| ID | Requerimiento(s) | Tipo | Precondiciones | Datos de entrada | Pasos | Resultado esperado | Test automatizado o evidencia manual |
|---|---|---|---|---|---|---|---|
| TC-ALPHA-28 | RF18 | normal | Sesión cerrada | Credenciales de Administrator | 1. «Acceso de personal»; 2. Iniciar sesión | Abre «Command Center» (Espacio del administrador); no ofrece el análisis ni la exportación de la Asociación | Evidencia manual: captura. Referencia: `controllers/loginController.test.js` |
| TC-ALPHA-29 | RF19, RF20 | normal | Reportes propios en la cola de moderación (los de TC-ALPHA-08 y TC-ALPHA-16) | Motivos de auditoría escritos en cada comando | 1. Abrir «Cola de moderación» y localizar el reporte por UUID; 2. «Aprobar» uno pendiente; 3. «Ocultar» otro con motivo; 4. «Restaurar» el oculto; 5. «Eliminar» uno con motivo | Cada comando exige motivo donde corresponde; ocultar lo retira del mapa pero lo deja en la cola; restaurar lo devuelve a pendiente (no público hasta aprobarse); eliminar es lógico y reversible; el contenido original no cambia | Evidencia manual: capturas por comando y del mapa antes y después. Referencia: `models/moderation.test.js`, `services/moderationApi.test.js` |
| TC-ALPHA-30 | RF23 | normal | Al menos dos reportes propios cercanos en tiempo y distancia, para que el sistema los sugiera | Motivo `Prueba alfa` | 1. «Gestionar duplicados»; 2. Seleccionar dos reportes de una sugerencia; 3. Elegir el canónico; 4. «Confirmar resolución»; 5. «Revertir resolución» con motivo | Solo se marca el canónico y sus duplicados; no se borra ni combina nada; la reversión devuelve los candidatos a revisión | Evidencia manual: capturas. Referencia: `tests/ui/duplicateManagement.spec.js` |
| TC-ALPHA-31 | Aclaración 5, RF21 | normal | Sesión de Administrator en **staging**; anotar los valores vigentes antes de cambiar | Cambiar «Denuncias para ocultar un reporte» al valor vigente más 1, con motivo `Prueba alfa`; después restaurar el valor original con motivo `Reversión de prueba alfa` | 1. «Configurar umbrales»; 2. Anotar versión y valores; 3. Publicar el cambio; 4. Volver a leer; 5. Publicar la restauración | La versión activa sube en cada publicación; los valores publicados se leen de vuelta; el motivo es obligatorio; al final los valores quedan como antes | Evidencia manual: capturas de las versiones. Referencia: `tests/ui/configuration.spec.js` |
| TC-ALPHA-32 | Aclaración 5 | excepción | Sesión de Administrator en staging; archivo GeoJSON de prueba válido (`Polygon`, WGS84) y otro inválido | (a) GeoJSON válido; (b) contenido que no es un `Polygon` ni `MultiPolygon` | 1. «Gestionar zonas»; 2. Seleccionar el archivo; 3. «Calcular checksum»; 4. «Guardar borrador»; 5. Repetir con (b) | (a) «Borrador guardado. La carga por sí sola no activa la zona.» y la zona activa actual no cambia; (b) se rechaza sin enviar. **No activar** la zona en esta sesión salvo decisión expresa del equipo: reemplazar el geofence de staging puede dejar fuera la ubicación de prueba | Evidencia manual: video/captura del borrador válido y del rechazo inválido; fixtures en `docs/testing/data/alpha/2026-10-11/`. Referencia: `tests/ui/zoneSet.spec.js` |
| TC-ALPHA-33 | RF15, RF18 | normal | Sesión iniciada (Asociación o Administrator) | Ninguna | 1. «Cerrar sesión»; 2. Reabrir la app | Vuelve a la cámara; al reabrir no se conserva la sesión privada y hay que iniciar sesión otra vez | Evidencia manual: video. Referencia: `controllers/loginController.test.js` |

Casos sin referencia automatizada propia dependen solo del teléfono real (permisos,
cámara, modo avión, archivos y compartir). Un test de referencia puede no cubrir
todas las entradas de su fila: comprobar sus aserciones antes de citarlo como
cobertura (T4).
