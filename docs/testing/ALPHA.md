# Prueba alfa en dispositivo

Estado: checklist y preparación definidos por T7 / TD-120. **La ejecución en el
teléfono está pendiente**: no hay resultados, capturas ni filas `RUN` todavía, y T7
no está cerrada hasta tenerlos.
Convenciones: `docs/testing/README.md`. Fuente: `docs/testing/BACKLOG.md`, T7.
Casos con entradas, pasos y resultados esperados: `docs/testing/cases/alpha.md`
(`TC-ALPHA-01` a `TC-ALPHA-33`).

## Sesión

Completar al ejecutar; una fila nueva de sesión por cada corrida (no sobrescribir).

| Campo | Valor |
|---|---|
| Fecha y responsable | pendiente (coordina P2; participa todo el equipo) |
| Commit/build de la app | pendiente: SHA completo y tipo de build |
| Dispositivo y versión Android | pendiente: marca, modelo y versión (Android 8.0 o superior, RNF05) |
| Tipo de build y API/entorno | pendiente: build de desarrollo o release (no Expo Go); API de staging |
| Configuración, idioma y red | pendiente: idioma del teléfono, Wi-Fi o datos, y cuándo se usó modo avión |
| Datos y precondiciones | pendiente: cuentas usadas (sin credenciales), escenas ESC-A a ESC-D, geofence de staging |

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

## Checklist por completar

Detalle completo (precondiciones, entradas y pasos) en `docs/testing/cases/alpha.md`.
Las columnas de ejecución y captura se llenan al correr cada caso; mientras digan
«pendiente» el caso no está ejecutado ni aprobado.

| Caso | Flujo | Resultado esperado (resumen) | Ejecución y resultado obtenido | Captura/video |
|---|---|---|---|---|
| TC-ALPHA-01 | Primera apertura y permiso de cámara | Abre en cámara; pide permiso | pendiente | pendiente |
| TC-ALPHA-02 | Acceso «Reportar sin foto» | Visible en la cámara | pendiente | pendiente |
| TC-ALPHA-03 | Foto nítida de perro | Foto aceptada | pendiente | pendiente |
| TC-ALPHA-04 | Foto sin perro | «No detectamos un perro en la foto.» | pendiente | pendiente |
| TC-ALPHA-05 | Foto borrosa | «La foto está borrosa.» | pendiente | pendiente |
| TC-ALPHA-06 | Validación en modo avión | Se valida sin red | pendiente | pendiente |
| TC-ALPHA-07 | Color predominante | Sugerido, editable; tamaño y collar opcionales | pendiente | pendiente |
| TC-ALPHA-08 | Manada, cantidad 2 | «Reporte enviado» | pendiente | pendiente |
| TC-ALPHA-09 | Manada, cantidad 1000 | «Reporte enviado» | pendiente | pendiente |
| TC-ALPHA-10 | Manada, cantidad 1001 | Error de rango 2 a 1000 | pendiente | pendiente |
| TC-ALPHA-11 | Manada, cantidad 1 | Error de rango 2 a 1000 | pendiente | pendiente |
| TC-ALPHA-12 | Solitario y preguntas por categoría | Solo las preguntas de la categoría | pendiente | pendiente |
| TC-ALPHA-13 | Reporte sin foto | Se envía y se acepta | pendiente | pendiente |
| TC-ALPHA-14 | Sin datos personales y aviso de RF02 | Sin campos de identidad; aviso visible | pendiente | pendiente |
| TC-ALPHA-15 | Reporte en modo avión | «Reporte guardado para sincronizar» | pendiente | pendiente |
| TC-ALPHA-16 | Sincronizar al volver la red | «Reportes sincronizados»; un solo UUID | pendiente | pendiente |
| TC-ALPHA-17 | Cola tras cerrar la app | Cola intacta; se sincroniza | pendiente | pendiente |
| TC-ALPHA-18 | Mapa: clusters y zoom a pines | Clusters con conteo y color; pines a zoom 17 | pendiente | pendiente |
| TC-ALPHA-19 | Detalle de cluster | Seis categorías y mayor gravedad | pendiente | pendiente |
| TC-ALPHA-20 | Detalle de pin | Ubicación aproximada | pendiente | pendiente |
| TC-ALPHA-21 | Mapa sin conexión | Mensaje de sin conexión y reportar sigue disponible | pendiente | pendiente |
| TC-ALPHA-22 | Denuncia | «Gracias. Revisaremos el reporte.» | pendiente | pendiente |
| TC-ALPHA-23 | Denuncia inválida o repetida | Bloqueos y «Ya denunciaste este reporte.» | pendiente | pendiente |
| TC-ALPHA-24 | Login de Asociación | Error con datos malos; panel con datos buenos | pendiente | pendiente |
| TC-ALPHA-25 | Consulta de 7 días | Solo datos de negocio | pendiente | pendiente |
| TC-ALPHA-26 | Rango vacío y fechas inválidas | Mensajes exactos; exportar deshabilitado | pendiente | pendiente |
| TC-ALPHA-27 | Exportar CSV y XLSX | Mismas filas que la tabla | pendiente | pendiente |
| TC-ALPHA-28 | Login de Administrator | Command Center sin exportación | pendiente | pendiente |
| TC-ALPHA-29 | Moderación | Aprobar, ocultar, restaurar y eliminar con motivo | pendiente | pendiente |
| TC-ALPHA-30 | Duplicados | Resolver y revertir sin borrar | pendiente | pendiente |
| TC-ALPHA-31 | Configuración de umbrales | Versión sube; valores restaurados | pendiente | pendiente |
| TC-ALPHA-32 | Zonas: borrador | Guarda sin activar | pendiente | pendiente |
| TC-ALPHA-33 | Cerrar sesión | Vuelve a cámara | pendiente | pendiente |

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

Conclusiones, pendientes y revisión: pendientes hasta ejecutar la sesión.
