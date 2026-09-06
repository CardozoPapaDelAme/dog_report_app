# Integración de Seguridad Informática en Redes y Sistemas de Software

> **SRS vigente para entregas posteriores.** El PDF
> [`Etapa 1. Requerimientos.pdf`](../../Etapa%201.%20Requerimientos.pdf)
> permanece inmutable como evidencia de Etapa 1. Este Markdown conserva los
> identificadores RF/RNF/HU y actualiza el texto vigente. El historial de
> enmiendas está en
> [`APPROVED-CLARIFICATIONS.md`](APPROVED-CLARIFICATIONS.md).

**TC2007B.400 — Etapa 1. Requerimientos**

**Alumn@s:**
- A01569349 - Fabian Fuentes
- A01563998 - Juan Pablo de Leon
- A01563582 - Alan Ruiz Silva
- A01563965 - Erick Humberto Herrera Luna
- A01564070 - Ricardo Becerra Bitar

**Profesores:**
- Faustino Bejarano Romero
- Enrique A. Sanchez
- Raime Alejandro Bustos Gardea
- David Garcia

**Fecha:** 25 Agosto 2026

---

## Problemática

En Creel existe una problemática relacionada con la presencia de perros callejeros o salvajes que pueden representar un riesgo para habitantes, turistas, mascotas y ganado. Actualmente, la información sobre avistamientos e incidentes se encuentra dispersa o no se registra de manera sistemática, lo que dificulta identificar las zonas con mayor presencia de perros, reconocer patrones de riesgo y conocer la frecuencia o gravedad de los incidentes. Esta falta de información organizada limita la capacidad de habitantes, hoteleros, asociaciones y autoridades para conocer la situación y tomar decisiones informadas respecto a las zonas de mayor riesgo. La aplicación está destinada para la asociación hotelera de Chihuahua.

El sistema propuesto busca centralizar estos reportes y generar información geográfica y estadística que permita visualizar la distribución de los avistamientos e incidentes en Creel con el fin de hacer Business Intelligence.

---

## Requerimientos Funcionales

### Reporte de avistamientos (usuario público, sin login)

- **RF01** – Cualquier usuario puede levantar un reporte sin necesidad de crear cuenta o iniciar sesión.
- **RF02** – El sistema no solicita ni almacena datos personales de quien reporta.
- **RF03** – El usuario puede tomar una foto del canino al momento de crear un reporte.
- **RF04** – El usuario puede indicar si el avistamiento fue de un perro solitario o en manada/jauría.
- **RF05** – Botón de acceso rápido y visible para iniciar un nuevo reporte sin foto.
- **RF06** – Al levantar un reporte, el usuario debe seleccionar un tipo de incidente/avistamiento (ej. avistamiento simple, ataque a mascota, ataque a ganado, ataque a humano, perro lastimado, entre otros).
- **RF07** – Lo primero que ve el usuario al abrir la app es la cámara.
- **RF08** – El usuario tiene la habilidad de denunciar un reporte si considera que es inválido: foto falsa, contenido inapropiado, burla, o que el animal no es un perro callejero (ej. es una mascota con dueño/vecino), entre otros.
- **RF09** – Al tomar la foto, el sistema valida localmente (on-device) si la imagen es válida: si la foto es borrosa/de mala calidad, o si no se detecta ningún perro en el campo de visión, se le indica al usuario y se le solicita volver a tomar la foto antes de continuar.

### Mapa (usuario público)

- **RF10** – Mapa con pines que muestra la ubicación aproximada y estable (50 m) de los reportes públicos visibles y recientes.
- **RF11** – El mapa debe agrupar reportes cercanos geográficamente en clusters representados como círculos, en vez de mostrar cada pin individual cuando hay alta densidad de reportes en una zona.
- **RF12** – El tamaño del círculo debe ser proporcional a la cantidad de reportes agrupados en esa zona.
- **RF13** – El color del círculo debe representar el tipo de incidente de mayor severidad presente en ese grupo de reportes. Al tocar/dar clic en el círculo, se debe mostrar un desglose con la cantidad de reportes por tipo dentro de ese cluster.
- **RF14** – Al hacer zoom sobre un cluster, este debe "abrirse" progresivamente en clusters más pequeños o pines individuales, siguiendo el comportamiento estándar de clustering de mapas (Mapbox/Google Maps/Leaflet).

### Usuario Asociación de Hoteles de Chihuahua (con login)

- **RF15** – La Asociación de Hoteles de Chihuahua cuenta con cuentas individuales de acceso (usuario y contraseña), provisionadas manualmente por un operador técnico; no existe registro público ni auto-registro. Puede haber múltiples cuentas para este rol.
- **RF16** – La Asociación tiene acceso, mediante su cuenta, a un panel de estadísticas con datos crudos/detallados de los reportes (por zona, fecha, tipo de incidente, tendencias).
- **RF17** – La Asociación puede exportar los datos del panel (ej. CSV/Excel) para compartirlos con los hoteles afiliados, autoridades u otros terceros.

### Usuario administrador (con login) - gestión de reportes

- **RF18** – El administrador puede iniciar sesión con credenciales propias. No hay auto-registro público; las cuentas se provisionan manualmente y puede haber múltiples cuentas de administrador.
- **RF19** – El administrador puede ver el contexto de moderación de los reportes (pendientes, ocultos, denunciados y duplicados), incluyendo el motivo de la denuncia. No hereda el panel de estadísticas ni la exportación de la Asociación de Hoteles de Chihuahua.
- **RF20** – El administrador puede ocultar o eliminar lógicamente un reporte marcado como falso o inapropiado. La eliminación lógica es reversible; no hay borrado duro disparado por el usuario.
- **RF21** – Un reporte denunciado permanece visible en el mapa por defecto. Si acumula un número alto de denuncias de orígenes distintos, se oculta automáticamente del mapa hasta que un administrador lo revise y decida restaurarlo o eliminarlo lógicamente. Los demás usuarios podrán ver si un reporte tiene una o más denuncias (como advertencia).
- **RF22** – Al crear un reporte con foto, la app extrae automáticamente el color predominante del perro mediante análisis de imagen on-device (sin requerir un modelo de IA pesado ni conexión). Adicionalmente, el usuario puede indicar de forma manual y opcional el tamaño aproximado (chico/mediano/grande) y la presencia de collar (sí/no/no sé). El tamaño y el collar no se infieren automáticamente; son entrada manual del usuario.
- **RF23** – El sistema identifica posibles reportes duplicados del mismo avistamiento cuando dos o más reportes coinciden en cercanía geográfica y temporal (umbrales configurables) y comparten atributos visuales similares. La detección nunca fusiona ni oculta automáticamente. El administrador confirma de forma manual un reporte canónico y deja los demás ligados de manera reversible y auditada.
- **RF24** – El formulario de reporte es dinámico: las preguntas mostradas cambian según el tipo de incidente seleccionado (RF06). Los datos comunes (ubicación, foto, solitario/manada, atributos del perro) se solicitan siempre; las preguntas específicas de cada tipo (ej. si hubo mordida en un ataque a humano; tipo y cantidad de animales en un ataque a ganado; situación del animal en un perro lastimado) se muestran solo cuando aplican. El formulario permanece simple para reportes básicos y solo solicita información adicional cuando la situación lo requiere.

---

## Requerimientos No Funcionales (RNF)

### 1. Disponibilidad y Rendimiento

- **RNF01** – La disponibilidad del 99.9% es una meta futura de servicio, no un SLA del prototipo. En Fase 1 el servicio es de mejor esfuerzo sobre Supabase managed Free.
- **RNF02** – El mapa carga en menos de 5 segundos.
- **RNF03** – Escalabilidad: soportar aumento de reportes sin degradar el rendimiento.

### 2. Usabilidad

- **RNF04** – Cualquier persona debe poder completar un reporte en menos de 5 minutos sin capacitación previa.

### 3. Plataforma y Compatibilidad

- **RNF05** – Compatibilidad con iOS y Android (React Native/Expo; Android 8.0+, iOS 13+).
- **RNF06** – Interfaz bilingüe (español/inglés) en todos los flujos: reporte público, mapa y dashboard.
- **RNF07** – Arquitectura single-tenant: existen únicamente dos roles autenticados hermanos, además del acceso público anónimo — la Asociación de Hoteles de Chihuahua (consulta de estadísticas y exportación) y el administrador (moderación y configuración auditada). Cada rol puede tener múltiples cuentas individuales provisionadas manualmente, sin registro público ni cuentas por hotel afiliado; no se requiere aislamiento de datos entre organizaciones distintas.
- **RNF08** – La validación de foto perro/no-perro y calidad (RF09) se implementa con un modelo de visión ligero, pre-entrenado y estándar de la industria (ej. MobileNet/EfficientNet-Lite vía TensorFlow Lite, o Google ML Kit), ejecutado on-device. No requiere entrenamiento de un modelo propio ni cómputo del lado del servidor.

### 4. Validación y Calidad de Datos

- **RNF09** – Validación de coordenadas: solo se aceptan reportes nuevos dentro del geofence activo de Creel. La activación productiva de ese geofence requiere aprobación explícita de la Asociación de Hoteles de Chihuahua. El sistema detecta ubicaciones simuladas (mock location / GPS spoofing) y marca para revisión los reportes con GPS impreciso o sospechoso; no los descarta. Un replay idéntico de un reporte ya aceptado no se rechaza si el geofence cambia después.
- **RNF10** – El modelo de clasificación que valida si la foto contiene un perro corre on-device (no requiere llamada a un servicio en la nube), lo cual es coherente con la arquitectura offline-first: la validación de foto funciona incluso sin conexión. También se valida la metadata de la imagen.
- **RNF11** – La extracción de color predominante (RF22) se realiza mediante análisis de píxeles on-device, sin depender de conexión ni de un modelo de IA pesado. Los atributos del reporte (color automático; tamaño y collar manuales) se almacenan como datos estructurados y sirven como señales de apoyo para el puntaje de confianza (RNF28) y la detección de posibles duplicados (RF23), sin constituir una identificación individual del animal. La presencia de collar sirve como señal de que el animal podría ser una mascota y no un perro callejero.

### 5. Arquitectura Offline-First

- **RNF12** – Crear/guardar reportes sin conexión, sincronizar al recuperar red.

### 6. Privacidad y Protección de Datos

- **RNF13** – Minimización de datos: no se recolecta información personal identificable de usuarios públicos que reportan de forma anónima. Para las cuentas autenticadas (Asociación y Administrador), los datos personales del personal operador (nombre, correo, credenciales) se tratan conforme a la LFPDPPP: acceso restringido, almacenamiento cifrado de credenciales y política de retención definida.

### 7. Hardware y Proveedor de Nube (Servidor)

- **RNF14** – El prototipo no promete respaldos diarios administrados. Requiere exportaciones lógicas por hitos de base de datos, exportación separada de objetos privados de Storage y un procedimiento de restauración aislado. Un lanzamiento público de producción debe adoptar un plan o mecanismo de backup que cumpla RPO máximo de 24 horas y RTO máximo de 4 horas.
- **RNF15** – La Fase 1 se aloja en Supabase managed Free. No se opera un VPS propio ni un stack self-hosted obligatorio.
- **RNF16** – El acceso público ocurre por HTTPS. TLS y el gateway son operados por Supabase; el equipo no administra firewall de host ni el puerto 22.
- **RNF17** – No hay administración por SSH. El operador técnico usa el dashboard y la CLI de Supabase con privilegio mínimo; no se exponen credenciales de servidor a la app móvil.
- **RNF18** – Supabase Free no ofrece snapshots automáticos de infraestructura. El prototipo conserva exportaciones cifradas externas. La producción pública queda condicionada a un mecanismo de backup que cumpla RNF14.

### 8. Software (DBMS, Servidor de Aplicación y Servidor Web)

- **RNF19** – El DBMS es PostgreSQL con PostGIS, provisto por Supabase managed. No se opera un stack Docker self-hosted como topología objetivo.
- **RNF20** – El control de acceso se implementa con RLS y privilegios SQL, separando público anónimo, Asociación de Hoteles de Chihuahua y administrador.
- **RNF21** – La app usa Supabase Auth y la Data API/PostgREST con JWT. Las operaciones transaccionales viven en RPC SQL; no se añade una API Controller-Service-Repository redundante.
- **RNF22** – TLS/HTTPS lo opera Supabase. El equipo no opera Traefik, Kong ni un reverse proxy propio.
- **RNF23** – Supabase se modela como una frontera gestionada, descompuesta lógicamente en Auth, Data API/PostgREST, Edge Functions, Storage y PostgreSQL/PostGIS. No se expone la base de datos en internet ni se inventa su topología física interna.
- **RNF24** – Las llaves sensibles (`service_role`, secretos de Functions, cadena de base de datos) nunca se envían a la app móvil; el cliente solo recibe configuración publicable.
- **RNF25** – El monitoreo cubre cuotas, errores, pausa del proyecto Free, retención y antigüedad de exportaciones; no se opera monitoreo de CPU/RAM de un VPS propio.

### 9. Integridad y Anti-Abuso

- **RNF26** – El sistema genera un identificador de dispositivo (fingerprint) al momento de crear un reporte, usado para limitar la tasa de reportes y denuncias por origen, sin identificar a la persona. Se prefiere sobre bloqueo por IP porque múltiples huéspedes de un mismo hotel comparten la red WiFi.
- **RNF27** – El formulario de reporte incluye campos honeypot invisibles al usuario legítimo; su llenado marca el envío como sospechoso automáticamente.
- **RNF28** – Cada reporte recibe un puntaje de confianza (no una decisión binaria de aceptar/rechazar) calculado a partir de la validación de foto, señales transitorias de EXIF, fingerprint del dispositivo y precisión del GPS. Un puntaje alto puede publicar; medio o bajo entra a revisión. Las heurísticas nunca descartan automáticamente.
- **RNF29** – El conteo de denuncias (RF08/RF21) aplica límite de tasa y ponderación por diversidad de origen (fingerprint), de forma que múltiples denuncias desde el mismo dispositivo u origen coordinado no disparen el ocultamiento automático por sí solas.
- **RNF30** – La detección de posibles duplicados (RF23) es de naturaleza heurística y sugerente: agrupa candidatos para revisión humana pero no determina con certeza que dos reportes correspondan al mismo perro. La decisión final recae siempre en el administrador.

### 10. Seguridad de Aplicación y API

- **RNF31** – La plataforma managed y los controles de Function/base de datos aplican límite de tasa a las operaciones públicas (creación de reportes, denuncias y carga de imagen), para mitigar abuso automatizado y denegación de servicio.
- **RNF32** – Las imágenes opcionales se validan en una Edge Function específica: tipo MIME permitido (JPEG/PNG/HEIC), tamaño/dimensiones, decodificación real y saneamiento/re-encode. El EXIF crudo es transitorio y nunca se persiste. Solo se almacena la imagen saneada en Storage privado, con entrega autorizada y sin URL pública permanente.
- **RNF33** – Toda acción administrativa sobre un reporte (ocultar, eliminar, restaurar) queda registrada en un log de auditoría con identificador de la cuenta administradora, marca de tiempo y acción realizada.
- **RNF34** – Los tokens JWT de las cuentas de Asociación y Administrador tienen un tiempo de expiración corto (ej. 1 hora) con mecanismo de refresh token, y se invalidan al cerrar sesión o tras un periodo de inactividad definido.

### 11. Evolución Futura (fuera del alcance del prototipo)

- **RNF35** – Se contempla, como fase posterior opcional, sugerir duplicados visuales mediante un embedding por foto saneada y búsqueda por similitud (pgvector), combinada con filtros de tiempo y distancia. Queda fuera de la línea base de Fase 1: no se añade GPU, embeddings ni pgvector al esquema inicial, y la ausencia de ese cómputo no rompe la detección heurística. La confirmación humana sigue siendo obligatoria.
- **RNF36** – Las respuestas condicionales del formulario dinámico (RF24) se almacenan de forma estructurada y su formato se valida en la base de datos según el tipo de incidente, garantizando que cada reporte contenga la información obligatoria de su categoría antes de ser aceptado.

---

## Historias de usuario

### 1. Reporte de avistamientos (usuario público, sin login)

**HU-01 (RF01)** — Como habitante de Creel, quiero levantar un reporte sin crear cuenta ni iniciar sesión, para poder reportar de inmediato sin barreras de entrada.
- El flujo de reporte no solicita registro, login ni contraseña en ningún punto.

**HU-02 (RF02)** — Como habitante de Creel, quiero que la app no me pida ni guarde datos personales, para reportar sin preocuparme por mi privacidad.
- Ningún campo del formulario solicita nombre, teléfono, correo o identificación.

**HU-03 (RF03)** — Como habitante de Creel, quiero poder tomar una foto del perro al momento de crear el reporte, para dar evidencia visual del avistamiento.
- El usuario puede capturar la foto desde la cámara integrada en el flujo de reporte.

**HU-04 (RF04)** — Como habitante de Creel, quiero indicar si vi un perro solitario o una manada/jauría, para que el reporte refleje mejor el nivel de riesgo de la situación.
- Selección obligatoria: solitario / manada-jauría.

**HU-05 (RF05)** — Como habitante de Creel, quiero un botón de acceso rápido y visible para iniciar un reporte, para poder reportar en el momento sin buscar en menús y sin necesidad de depender de tomar una foto.
- El botón es visible desde la pantalla principal en la parte superior de la pantalla de inicio (cámara).

**HU-06 (RF06)** — Como habitante de Creel, quiero seleccionar el tipo de incidente (avistamiento simple, ataque a mascota, ataque a ganado, ataque a humano, perro lastimado, otro), para clasificar correctamente la gravedad de lo que vi.
- Selección obligatoria de una categoría de la lista.

**HU-07 (RF07)** — Como habitante de Creel, quiero que la app abra directamente en la cámara, para capturar la foto del perro en el momento sin perder tiempo navegando.
- Al abrir la app, la cámara se activa como primera pantalla.

**HU-08 (RF08 + RF21)** — Como habitante de Creel, quiero poder denunciar un reporte que me parece falso (foto falsa, contenido inapropiado, burla, etc.), para ayudar a mantener la calidad de la información del mapa.
- Cada reporte tiene una opción de "denunciar" con motivo.
- El reporte denunciado permanece visible en el mapa por defecto.
- Si el reporte acumula un número alto de denuncias (umbral pendiente de definir), se oculta automáticamente del mapa y pasa a una cola de revisión para el administrador.

**HU-09 (RF09)** — Como habitante de Creel, quiero que la app valide localmente (sin necesitar conexión) si mi foto es válida —que se detecte un perro y tenga calidad suficiente— y que me pida repetirla si no lo es, para asegurar que el reporte tenga evidencia útil antes de enviarlo.
- La validación corre on-device, funciona sin conexión a internet.
- Si la foto es rechazada, se muestra la razón (borrosa/mala calidad, o no se detecta perro) y se ofrece reintentar directamente.

### 2. Mapa (usuario público)

**HU-10 (RF10)** — Como habitante de Creel, quiero ver un mapa con los reportes registrados, para conocer qué zonas tienen presencia de perros callejeros o salvajes.

**HU-11 (RF11)** — Como habitante de Creel, quiero que los reportes cercanos se agrupen en clusters representados como círculos, para que el mapa sea legible cuando hay muchos reportes en una zona.

**HU-12 (RF12)** — Como habitante de Creel, quiero que el tamaño del círculo sea proporcional a la cantidad de reportes agrupados, para identificar de un vistazo las zonas de mayor actividad.

**HU-13 (RF13)** — Como habitante de Creel, quiero que el color del círculo represente el tipo de incidente de mayor severidad dentro del grupo, y poder tocarlo para ver el desglose por tipo, para entender rápido el nivel de riesgo real de la zona sin que se esconda información grave.

**HU-14 (RF14)** — Como habitante de Creel, quiero que al hacer zoom los clusters se abran progresivamente en clusters más pequeños o pines individuales, para poder explorar el detalle de una zona específica.

### 3. Asociación Hotelera de Chihuahua (con login)

**HU-15 (RF15)** — Como Asociación de Hoteles de Chihuahua, quiero iniciar sesión con una cuenta individual provisionada por un operador técnico, para acceder a las funciones exclusivas de mi rol sin depender de un registro público.
- Las cuentas de la Asociación de Hoteles de Chihuahua se crean manualmente; puede haber varias; no hay pantalla de registro público para este rol.

**HU-16 (RF16)** — Como asociación, quiero ver un panel de estadísticas con datos detallados de los reportes (zona, fecha, tipo de incidente, tendencias), para entender mejor el riesgo en mi área y tomar decisiones informadas.

**HU-17 (RF17)** — Como asociación, quiero exportar los datos del panel en CSV/Excel, para compartirlos con la asociación hotelera o el gobierno.

### 4. Usuario administrador (con login) — gestión de reportes

**HU-18 (RF18)** — Como administrador del socio formador, quiero iniciar sesión con mis credenciales, para acceder a las funciones de gestión de reportes.
- No hay auto-registro público para este rol; las cuentas se aprovisionan manualmente y puede haber varias.

**HU-19 (RF19)** — Como administrador, quiero ver todos los reportes del sistema, incluidos los denunciados junto con su motivo de denuncia, para poder evaluar cuáles son legítimos y cuáles no.
- La vista de reportes denunciados muestra el motivo y la cantidad de denuncias por reporte.

**HU-20 (RF20)** — Como administrador, quiero poder ocultar o eliminar lógicamente un reporte marcado como falso o inapropiado, para mantener la calidad de la información pública del mapa.

**HU-21 (RF21)** — Como administrador, quiero que un reporte se oculte automáticamente del mapa cuando acumule un número alto de denuncias de orígenes distintos, y poder revisarlo después para decidir si lo restauro o lo elimino lógicamente, para no depender de revisar cada denuncia en tiempo real.
- Los reportes auto-ocultos aparecen en una cola de "pendientes de revisión" separada de los reportes normales.
- El umbral de denuncias que dispara el ocultamiento automático es configurable.

**HU-22 (RF22)** — Como habitante de Creel, quiero que la app detecte el color del perro que fotografío y poder indicar opcionalmente su tamaño y si trae collar, para que el reporte aporte información útil sin llenar formularios largos.
- El color se extrae automáticamente de la foto (on-device).
- El tamaño y el collar son opcionales y de selección manual.
- La presencia de collar sirve como señal de que podría tratarse de una mascota y no de un perro callejero.

**HU-23 (RF23)** — Como administrador, quiero que el sistema agrupe los reportes que podrían ser del mismo avistamiento (cercanos en lugar, tiempo y apariencia), para revisarlos juntos y decidir un canónico, sin que el sistema los fusione por su cuenta.
- Los posibles duplicados aparecen agrupados en la cola de revisión.
- El administrador decide manualmente; el sistema nunca fusiona ni descarta automáticamente. La resolución es reversible y auditada.

**HU-24 (RF24)** — Como habitante de Creel, quiero que el formulario solo me pregunte lo relevante según el tipo de situación que reporto, para no llenar campos que no aplican y poder terminar rápido.
- Las preguntas cambian según el tipo de incidente elegido.
- Los reportes simples (avistamiento) piden lo mínimo; los incidentes graves piden el detalle necesario.
- La descripción libre siempre es opcional.

---

## Alcance del proyecto

El alcance consiste en el desarrollo de un aplicación móvil iOS y Android que permite registrar y consultar reportes acerca de perros callejeros o salvajes en Creel. Su propósito es ofrecer información geográfica y estadística que apoye a habitantes, turistas, hoteleros para identificar zonas de riesgo y patrones de incidentes.

La aplicación permitirá que cualquier persona ubicada en el municipio de Creel haga reportes de manera anónima, sin tener que crear una cuenta o brindar información personal solicitada. Cada reporte podrá agregar una fotografía tomada desde la aplicación, ubicación geográfica dentro del geofence activo de Creel, tipo de incidente y clasificación del avistamiento como perro solitario o manada. La foto se valida en el dispositivo para calidad y presencia de un perro, incluso sin conexión.

El sistema incluirá un mapa público con reportes y clusters, usando ubicación aproximada de 50 m. El tamaño del cluster indicará la cantidad de reportes. Los usuarios también podrán denunciar contenido falso. Los reportes con múltiples denuncias de orígenes distintos se ocultarán para revisión administrativa.

Además, habrá dos roles autenticados hermanos, cada uno con múltiples cuentas individuales provisionadas:

- **Asociación de Hoteles de Chihuahua:** acceso de solo lectura a estadísticas y exportación sobre datos de negocio aceptados y canónicos.
- **Administrador:** contexto de moderación, denuncias, duplicados y comandos auditados para ocultar, restaurar o eliminar lógicamente.

La solución será offline-first para crear/guardar reportes y sincronizarlos al recuperar red. El prototipo usa exportaciones por hitos y controles de privacidad; no promete respaldos diarios administrados en Supabase Free.

---

## Matriz de Riesgos

| Impacto / Frecuencia | Baja | Media | Alta |
|---|---|---|---|
| **Alto** | Manipulación deliberada de la ubicación de los reportes. | Percepción incorrecta del riesgo de una zona por la representación de severidad de los clusters. | Reportes falsos o maliciosos que contaminen los datos. |
| **Medio** | Reportes legítimos ocultados por denuncias falsas o coordinadas. | Ubicación GPS imprecisa en algunos reportes. | Duplicidad de reportes sobre un mismo avistamiento o incidente. |
| **Bajo** | Problemas ocasionales de sincronización de reportes offline. | Fotografías de baja calidad que logren pasar la validación. | Usuarios abandonan el reporte antes de completarlo. |

---

## Cronograma

Línea de tiempo del proyecto, con junta inicial el 11 de agosto:

| Etapa | Nombre | Fechas | Duración | Tipo |
|---|---|---|---|---|
| Etapa 1 | Requerimientos | 11 ago – 25 ago | 14 días | Etapa regular |
| Etapa 2 | Diseño | 25 ago – 29 ago | 4 días | Calendario ajustado |
| Etapa 3 | Desarrollo | 29 ago – 02 oct | 34 días | Etapa regular |
| Etapa 4 | Pruebas | 02 oct – 09 oct | 7 días | Calendario ajustado |
| Etapa 5 | Despliegue | 09 oct – 23 oct | 14 días | Etapa regular |

---

## Responsables por sección

| Sección | Responsable / Notas |
|---|---|
| Problemática | Desarrollado por Fabian, este se encargó del background research de otras soluciones ya existentes. |
| Requerimientos Funcionales | Esta parte fue desarrollada por todo el equipo en una lluvia de ideas y analizando cada una de ellas. |
| Requerimientos No funcionales | Desarrollado por Alan, nuestro tech leader, se encargó de todos los requerimientos no funcionales. |
| Historias de Usuario | Esta parte fue desarrollada por todo el equipo en base a los requerimientos. |
| Alcance del Proyecto | Ricardo Becerra fue el encargado de establecer el alcance del proyecto. |
| Matriz de Riesgo | Erick desarrolló toda la matriz de riesgo en base a su criterio y experiencia de proyectos pasados. |
| Cronograma | Juan Pablo, el scrum master, desarrolló el cronograma en base a las fechas establecidas en la plataforma. |
