# Prueba alfa en dispositivo

Estado: ejecución alfa en Android real documentada para T7 / TD-120. La sesión
cerró con 31 casos que pasaron, 1 falla registrada como `INC-2` y 1 caso
bloqueado por falta de fixture GeoJSON.
Convenciones: `docs/testing/README.md`. Fuente: `docs/testing/BACKLOG.md`, T7.
Casos con entradas, pasos y resultados esperados: `docs/testing/cases/alpha.md`
(`TC-ALPHA-01` a `TC-ALPHA-33`).

## Sesión

Completar al ejecutar; una fila nueva de sesión por cada corrida (no sobrescribir).

| Campo | Valor |
|---|---|
| Fecha y responsable | 2026-10-11; Erick Herrera |
| Commit/build de la app | `fe8da67d23862517ab5878228da5a15ca971b973`; app `1.0.0`; paquete `com.wildogscanner.app`; build development/debug |
| Dispositivo y versión Android | samsung SM-S918B; Android 16 (SDK 36) |
| Tipo de build y API/entorno | Build nativo development/debug, no Expo Go; API de staging con servicios reales |
| Configuración, idioma y red | Teléfono en español; red activa para flujos en línea; modo avión usado en TC-ALPHA-06, TC-ALPHA-15, TC-ALPHA-17 y TC-ALPHA-21 |
| Datos y precondiciones | Cuentas de Asociación y Administrator sin credenciales documentadas; escenas ESC-A a ESC-D; geofence de staging vigente; TC-ALPHA-32 bloqueado por falta de archivo GeoJSON de prueba |

## Preparación

1. **Build nativo, no Expo Go.** Instalar un build de desarrollo o release en un
   Android real. Opciones documentadas en `README.md`: build de EAS (opción B) o
   build local con `npm run app:android` (opción C, requiere Android Studio y JDK 17).
   Un build de desarrollo carga el código con `npx expo start --dev-client`. Exportar
   bundles o abrir la app en navegador **no** cuenta como ejecución en dispositivo.
   Anotar el SHA del código instalado: `git rev-parse HEAD`.
2. **Entorno staging.** El `.env` apunta al proyecto de staging (`.env.example`
   trae las URL; la clave publicable se obtiene con `npm run setup`). El geofence
   vigente es el de prueba «TEST ONLY» descrito en `docs/DEPLOYMENT.md`; no tocar
   producción ni agregar coordenadas inventadas.
3. **Cuentas.** Una de Asociación y una de Administrator, con su perfil
   provisionado (`README.md`, sección de cuentas del personal). Pedir las
   credenciales al equipo; no escribirlas en Git, en capturas ni en el test log.
4. **Escenas de prueba** (`docs/testing/cases/alpha.md`): ESC-A perro nítido,
   ESC-B sin perro, ESC-C borrosa y ESC-D perros de los cinco colores del
   vocabulario. Sin personas ni datos personales.
5. **Permisos.** Probar al menos una vez con la app recién instalada para ver las
   peticiones de cámara y ubicación (TC-ALPHA-01).
6. **Cobertura de dispositivos.** RNF05 pide Android 8.0+ e iOS 13+. Este alfa es
   de Android; si no hay iPhone ni build compatible, iOS queda sin cubrir y se
   dice así en las conclusiones, con responsable (ver `docs/testing/PLAN.md`).

## Orden de ejecución

Los casos dependen unos de otros (un reporte debe existir y estar aprobado antes
de verse en el mapa). Este orden evita repetir sesiones:

| Bloque | Casos | Nota |
|---|---|---|
| 1. Cámara y validación | TC-ALPHA-01 a 07 | Anotar el estado del modelo («Validación offline lista») |
| 2. Reportes | TC-ALPHA-08 a 14 | Crear reportes propios y anotar el UUID de cada uno |
| 3. Modo avión | TC-ALPHA-15 a 17 | Dejar un reporte en cola y sincronizarlo |
| 4. Administrator: alta | TC-ALPHA-28 y los pasos 1–2 de TC-ALPHA-29 | Aprobar los reportes propios; comprobar el UUID único de TC-ALPHA-16 |
| 5. Asociación | TC-ALPHA-24 a 27 | Cerrar la sesión de Administrator antes (TC-ALPHA-33) |
| 6. Mapa | TC-ALPHA-18 a 21 | Requiere reportes aprobados y red |
| 7. Denuncia | TC-ALPHA-22 y 23 | Solo sobre reportes propios |
| 8. Administrator: resto | Pasos 3–5 de TC-ALPHA-29 y TC-ALPHA-30 a 32 | Restaurar la configuración al terminar (TC-ALPHA-31) |
| 9. Cierre | TC-ALPHA-33 | Cerrar sesión y reabrir |

## Checklist ejecutado

Detalle completo (precondiciones, entradas y pasos) en `docs/testing/cases/alpha.md`.
Las columnas de ejecución y captura registran el resultado observado y la evidencia
de cada caso ejecutado.

| Caso | Flujo | Resultado esperado (resumen) | Ejecución y resultado obtenido | Captura/video |
|---|---|---|---|---|
| TC-ALPHA-01 | Primera apertura y permiso de cámara | Abre en cámara; pide permiso | pasó: abre cámara y solicita permiso | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-01-permiso-camara.jpg` |
| TC-ALPHA-02 | Acceso «Reportar sin foto» | Visible en la cámara | pasó: acceso visible en la cámara | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-02-reportar-sin-foto.jpg` |
| TC-ALPHA-03 | Foto nítida de perro | Foto aceptada | pasó: foto nítida aceptada | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-03-foto-nitida.jpg` |
| TC-ALPHA-04 | Foto sin perro | «No detectamos un perro en la foto.» | pasó: foto sin perro rechazada | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-04-foto-sin-perro.jpg` |
| TC-ALPHA-05 | Foto borrosa | «La foto está borrosa.» | pasó: foto borrosa rechazada | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-05-foto-borrosa.jpg` |
| TC-ALPHA-06 | Validación en modo avión | Se valida sin red | pasó: validación funciona en modo avión | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-06-modo-avion.jpg`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-06-validacion-foto-avion.jpg` |
| TC-ALPHA-07 | Color predominante | Sugerido, editable; tamaño y collar opcionales | pasó: color sugerido y editable | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-07-color-editable.jpg` |
| TC-ALPHA-08 | Manada, cantidad 2 | «Reporte enviado» | pasó: manada de 2 enviada | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-08-manada-2.jpg` |
| TC-ALPHA-09 | Manada, cantidad 1000 | «Reporte enviado» | pasó: cantidad 1000 aceptada y enviada | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-09-manada-1000.jpg`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-09-manada-1000-enviado.jpg` |
| TC-ALPHA-10 | Manada, cantidad 1001 | Error de rango 2 a 1000 | pasó: 1001 se rechaza por rango | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-10-manada-1001-error.jpg` |
| TC-ALPHA-11 | Manada, cantidad 1 | Error de rango 2 a 1000 | pasó: 1 se rechaza por rango | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-11-manada-1-error.jpg` |
| TC-ALPHA-12 | Solitario y preguntas por categoría | Solo las preguntas de la categoría | pasó: solitario no pide cantidad y muestra preguntas por categoría | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-12-solitario-categorias.jpg` |
| TC-ALPHA-13 | Reporte sin foto | Se envía y se acepta | pasó: reporte sin foto enviado | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-13-reporte-sin-foto.jpg` |
| TC-ALPHA-14 | Sin datos personales y aviso de RF02 | Sin campos de identidad; aviso visible | falló: no hay campos de identidad, pero no aparece el aviso RF02 sobre información incidental | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-14-sin-aviso-rf02.mp4` |
| TC-ALPHA-15 | Reporte en modo avión | «Reporte guardado para sincronizar» | pasó: reporte offline queda guardado para sincronizar | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-15-reporte-modo-avion.jpg`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-15-modo-avion-sync.mp4` |
| TC-ALPHA-16 | Sincronizar al volver la red | «Reportes sincronizados»; un solo UUID | pasó: sincronización confirmada a las 5:39 pm, sin duplicar | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-16-sincronizacion.jpg` |
| TC-ALPHA-17 | Cola tras cerrar la app | Cola intacta; se sincroniza | pasó: cola persiste tras cierre y sincroniza al recuperar red | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-17-cola-tras-cierre.jpg` |
| TC-ALPHA-18 | Mapa: clusters y zoom a pines | Clusters con conteo y color; pines a zoom 17 | pasó: mapa muestra clusters y pines al acercar | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-18-mapa-clusters.jpg` |
| TC-ALPHA-19 | Detalle de cluster | Seis categorías y mayor gravedad | pasó: detalle de cluster visible | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-19-detalle-cluster.jpg` |
| TC-ALPHA-20 | Detalle de pin | Ubicación aproximada | pasó: detalle de pin visible con ubicación aproximada | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-20-detalle-pin.jpg` |
| TC-ALPHA-21 | Mapa sin conexión | Mensaje de sin conexión y reportar sigue disponible | pasó: mapa comunica sin conexión y permite seguir reportando | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-21-mapa-sin-conexion.jpg` |
| TC-ALPHA-22 | Denuncia | «Gracias. Revisaremos el reporte.» | pasó: denuncia válida enviada | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-22-denuncia-form.jpg`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-22-denuncia-enviada.jpg` |
| TC-ALPHA-23 | Denuncia inválida o repetida | Bloqueos y «Ya denunciaste este reporte.» | pasó: denuncia inválida/repetida bloqueada | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-23-denuncia-repetida.jpg` |
| TC-ALPHA-24 | Login de Asociación | Error con datos malos; panel con datos buenos | pasó: login inválido/válido de Asociación verificado | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-24-login-asociacion.mp4` |
| TC-ALPHA-25 | Consulta de 7 días | Solo datos de negocio | pasó: panel de 7 días muestra datos de negocio | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-25-panel-7-dias.jpg` |
| TC-ALPHA-26 | Rango vacío y fechas inválidas | Mensajes exactos; exportar deshabilitado | pasó: rangos vacíos/fechas inválidas bloqueados | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-26-rangos-invalidos-vacios.jpg` |
| TC-ALPHA-27 | Exportar CSV y XLSX | Mismas filas que la tabla | pasó: exportación CSV/XLSX disponible y revisada | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-27-export-botones.jpg`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-27-export-csv.jpg`<br>`docs/testing/data/alpha/2026-10-11/TC-ALPHA-27-export-xlsx.jpg` |
| TC-ALPHA-28 | Login de Administrator | Command Center sin exportación | pasó: Administrator entra a Command Center sin exportación BI | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-28-login-administrator.jpg` |
| TC-ALPHA-29 | Moderación | Aprobar, ocultar, restaurar y eliminar con motivo | pasó: comandos de moderación revisados | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-29-moderacion.jpg` |
| TC-ALPHA-30 | Duplicados | Resolver y revertir sin borrar | pasó: duplicados resueltos/revertidos sin borrar reportes | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-30-duplicados.jpg` |
| TC-ALPHA-31 | Configuración de umbrales | Versión sube; valores restaurados | pasó: umbral cambiado y restaurado | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-31-configuracion-umbrales.mp4` |
| TC-ALPHA-32 | Zonas: borrador | Guarda sin activar | bloqueado: no se cuenta con archivo GeoJSON/geofence de prueba para validar guardado como borrador | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-32-zonas-sin-geojson.mp4` |
| TC-ALPHA-33 | Cerrar sesión | Vuelve a cámara | pasó: cerrar sesión y reabrir vuelve a cámara sin sesión privada | `docs/testing/data/alpha/2026-10-11/TC-ALPHA-33-cierre-sesion.mp4` |

## Evidencia

- Guardar capturas y videos en `docs/testing/data/alpha/` con el nombre
  `<fecha AAAA-MM-DD>/TC-ALPHA-<nn>-<descripcion-corta>.<png|mp4>` y enlazarlos en
  la columna «Captura/video» con su ruta completa desde la raíz del repo.
  Los videos pesados van a un enlace persistente con acceso del equipo.
- Sin credenciales, tokens, datos personales ni EXIF crudo. Recortar las capturas
  si muestran correos o notificaciones del teléfono.
- Una captura sola no acredita el resultado: cada fila de ejecución dice qué se
  observó. Más detalle en `docs/testing/data/alpha/README.md`.

## Registro de cada ejecución

1. Por cada caso ejecutado, agregar una fila en `docs/testing/TEST_LOG.md` con el
   formato de esa plantilla: entorno «dispositivo», modelo y versión de Android,
   si el servicio fue real (staging) o simulado, y el SHA completo del build.
   Una repetición agrega otra fila; no reemplaza la anterior.
2. Si un caso falla, abrir en ese momento el incidente `INC-<n>` en
   `docs/testing/INCIDENTS.md` y su ticket de bug en Jira; vincular caso, `RUN-n`
   e incidente en ambos sentidos. No esperar a T10 ni a T11.
3. Un caso que no se pudo correr (falta de cuenta, de red o de datos) se registra
   como `bloqueado`, con motivo y responsable. No cuenta como aprobado.
4. Pasar el estado de T7 a `hecho` en `docs/testing/BACKLOG.md` solo cuando todos
   los casos tengan su fila, haya fecha, dispositivo y versión de Android, y las
   capturas o el video estén enlazados.

## Límites de esta prueba

- **Un solo teléfono Android.** RF21 (ocultar un reporte automáticamente por
  denuncias de orígenes distintos) necesita varios orígenes y no se puede ejecutar
  aquí; lo cubre `supabase/functions/api/tests/flag-postgres.test.js` (SQL real, no
  dispositivo). Mantener esa diferencia al reportar resultados.
- **Sin iPhone.** Salvo que haya un build iOS compatible, RNF05 para iOS 13+ queda
  sin cubrir.
- **Staging, no producción.** El geofence es el de prueba; la activación de zonas
  queda fuera de la sesión (TC-ALPHA-32).
- **Rendimiento, seguridad y accesibilidad** pertenecen a T9; los tiempos de
  usuarios reales (RNF04) y los usuarios externos, a T8.
- Un éxito en navegador o con servicios simulados no se traslada al teléfono: la
  columna de referencia automatizada de los casos es solo orientación.

## Conclusiones y revisión

Conclusión: T7 queda ejecutada en Android real con evidencia local versionada.
Resultado: 31 casos pasaron, TC-ALPHA-14 falló por ausencia del aviso RF02 y
queda registrado como `INC-2`, y TC-ALPHA-32 quedó bloqueado por falta de archivo
GeoJSON/geofence de prueba. Pendiente operativo: abrir o vincular el ticket Jira
de `INC-2` y repetir TC-ALPHA-14 cuando se corrija el aviso.
