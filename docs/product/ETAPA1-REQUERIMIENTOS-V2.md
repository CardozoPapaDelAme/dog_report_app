# Integración de Seguridad Informática en Redes y Sistemas de Software

> **SRS consolidado normativo para la Fase 1.** Las enmiendas aprobadas en
> [`APPROVED-CLARIFICATIONS.md`](APPROVED-CLARIFICATIONS.md) tienen precedencia;
> las decisiones posteriores sustituyen conflictos anteriores. El PDF
> [`Etapa 1. Requerimientos.pdf`](../../Etapa%201.%20Requerimientos.pdf) y
> [`ETAPA1-REQUERIMIENTOS.md`](ETAPA1-REQUERIMIENTOS.md) permanecen sin cambios
> como fuentes históricas. Esta versión conserva todos los identificadores.
**TC2007B.400 — Etapa 1. Requerimientos, versión 2**  
**Fecha base:** 25 de agosto de 2026  
**Consolidación aprobada:** 7 de septiembre de 2026
## Problemática y alcance
La aplicación móvil iOS y Android centraliza reportes anónimos sobre perros
callejeros o salvajes en Creel para apoyar a habitantes, turistas, hoteleros y
autoridades con información geográfica y estadística. Permite captura offline,
sincronización posterior, mapa público con ubicación estable aproximada a 50 m,
moderación humana, análisis y exportación para la Asociación de Hoteles de
Chihuahua. La Fase 1 usa Supabase managed Free y no promete un SLA de producción.

Los actores son **anonymous public reporter**, **Asociación de Hoteles de
Chihuahua** y **Administrator**. Los dos roles autenticados son hermanos y admiten
múltiples cuentas individuales provisionadas manualmente. El rol SQL de la
Asociación permanece `association`.

## Requerimientos funcionales
### Reporte público
- **RF01** — Cualquier persona puede crear un reporte sin cuenta ni inicio de sesión; la cola durable permite capturarlo offline y sincronizarlo después.
- **RF02** — El producto no solicita ni almacena identificadores personales del reportante público; advierte que foto y texto libre pueden contener información incidental.
- **RF03** — El reporte puede incluir una sola foto opcional tomada desde la aplicación. Primero se crea el reporte con su UUID final y después se carga la imagen.
- **RF04** — El reportante indica obligatoriamente si observó un perro solitario o una manada/jauría.
- **RF05** — La pantalla inicial de cámara mantiene un acceso rápido y visible para reportar sin foto.
- **RF06** — El reportante selecciona una categoría: avistamiento simple, ataque a mascota, ataque a ganado, ataque a humano, perro lastimado u otro.
- **RF07** — La cámara es la primera pantalla al abrir la aplicación.
- **RF08** — Cualquier persona puede denunciar un reporte visible con un motivo tipificado y detalle opcional; una denuncia no elimina evidencia.
- **RF09** — La aplicación valida offline calidad y presencia de perro en la foto y solicita repetirla cuando falle. El servidor valida estructura, geofence e imagen de forma independiente.

### Mapa público
- **RF10** — El mapa online muestra reportes visibles, recientes y canónicos mediante una aproximación métrica, estable y determinista de 50 m.
- **RF11** — Los reportes cercanos se agrupan en clusters cuando la densidad lo requiere.
- **RF12** — El tamaño visual del cluster es proporcional a su cantidad de reportes.
- **RF13** — El color representa el incidente más severo y el detalle incluye conteos de las seis categorías; los no canónicos no participan.
- **RF14** — El zoom abre progresivamente clusters menores y pines individuales.

### Asociación de Hoteles de Chihuahua
- **RF15** — La Asociación de Hoteles de Chihuahua usa cuentas individuales provisionadas por un operador técnico; no existe registro público ni administración de cuentas dentro de la aplicación.
- **RF16** — La Asociación consulta únicamente datos de negocio aceptados y canónicos para estadísticas por zona, fecha, incidente y tendencia; no recibe moderación, confianza, fingerprints ni identidades de operadores.
- **RF17** — La Asociación exporta su misma proyección autorizada a CSV/Excel para compartirla con terceros.

### Administrator
- **RF18** — Administrator inicia sesión con una cuenta individual provisionada manualmente; no hereda análisis ni exportación de la Asociación.
- **RF19** — Administrator consulta colas y contexto de moderación, denuncias, confianza, fotos y duplicados, sin modificar el contenido original.
- **RF20** — Administrator puede ocultar o eliminar lógicamente un reporte mediante comandos auditados. La eliminación es reversible y el borrado físico pertenece a retención.
- **RF21** — Denuncias de orígenes distintos pueden ocultar automáticamente un reporte visible al alcanzar el umbral versionado. Administrator lo revisa, restaura, aprueba u ordena eliminar lógicamente.
- **RF22** — El color predominante se obtiene on-device; tamaño y collar son entradas manuales opcionales. Son señales, no identificación individual.
- **RF23** — El sistema sugiere duplicados por tiempo, distancia y atributos. Administrator elige manualmente un canónico; la resolución es reversible, auditada y nunca fusiona ni oculta automáticamente durante la detección.
- **RF24** — El formulario solicita campos comunes y preguntas tipificadas según el incidente. `details` rechaza claves o tipos no declarados y la descripción libre es opcional.

## Requerimientos no funcionales
### Disponibilidad, rendimiento y experiencia

- **RNF01** — El 99.9 % es una meta futura; la Fase 1 opera en mejor esfuerzo sobre Supabase managed Free.
- **RNF02** — El mapa debe cargar en menos de cinco segundos bajo la carga objetivo documentada.
- **RNF03** — Consultas acotadas, paginación e índices permiten crecer sin degradación no controlada.
- **RNF04** — Una persona sin capacitación debe completar un reporte en menos de cinco minutos.
- **RNF05** — Se soportan Android 8.0+ e iOS 13+ mediante builds de desarrollo/release de Expo; Expo Go no es entorno de aceptación.
- **RNF06** — Todos los flujos públicos, de Asociación y de Administrator son bilingües español/inglés.
- **RNF07** — La arquitectura es single-tenant, con acceso anónimo y dos roles autenticados hermanos, múltiples cuentas manuales y sin cuentas por hotel.
- **RNF08** — Un MobileNetV3-Small INT8 versionado y preentrenado corre on-device para perro/no-perro; calidad se evalúa por separado y no requiere nube.

### Datos, offline y privacidad
- **RNF09** — Un reporte nuevo requiere un geofence activo aprobado para Producción. Un punto exterior se rechaza; ubicación simulada o imprecisa entra a revisión. El replay idéntico previamente aceptado converge aunque cambie el geofence.
- **RNF10** — La validación de foto funciona offline y la metadata se procesa solo como señal transitoria; EXIF crudo nunca se persiste.
- **RNF11** — Color automático, tamaño y collar manuales se almacenan estructurados para confianza y duplicados, sin identificar al animal.
- **RNF12** — Borradores, UUID final, payload y archivo opcional se conservan en una cola local durable y reintentan de forma idempotente al recuperar red.
- **RNF13** — Se minimizan datos públicos y proyecciones. Credenciales y perfiles autenticados se protegen conforme a LFPDPPP; contenido incidental tiene moderación y retención.

### Proveedor, recuperación y operación
- **RNF14** — El prototipo realiza exportaciones lógicas por hitos y exporta objetos privados por separado con manifiesto y checksums; Producción requiere RPO máximo de 24 horas y RTO máximo de 4 horas demostrados.
- **RNF15** — La Fase 1 usa Supabase managed Free, sin VPS ni stack self-hosted obligatorio.
- **RNF16** — Supabase opera HTTPS/TLS y gateway; el equipo no administra firewall de host ni puerto 22.
- **RNF17** — No existe administración SSH. El operador usa dashboard y CLI con mínimo privilegio.
- **RNF18** — Supabase Free no aporta backups automáticos; restauración aislada incluye roles, esquema, datos, bytes privados, manifiestos y validación.
- **RNF19** — El DBMS es PostgreSQL con PostGIS administrado por Supabase; no se presume topología física ni se expone directamente a móviles.
- **RNF20** — RLS y privilegios SQL son controles simultáneos. Público, Asociación y Administrator reciben autorización de Servicio y alcance de filas por contexto transaccional.
- **RNF21** — Supabase Auth gestiona sesiones. Todo tráfico de dominio usa una API Hono en JavaScript plano, desplegada como la única Edge Function `api`, con Controllers, Services, Repositories, Domain y JSON Presenters. Los Repositories usan SQL parametrizado directo; no usan PostgREST, `.from()`, `.rpc()` ni funciones SQL de dominio expuestas.
- **RNF22** — Supabase opera TLS, gateway y runtime Edge; el equipo no opera Traefik, Kong ni proxy inverso propio.
- **RNF23** — Supabase se modela como una frontera administrada, descompuesta lógicamente en Auth, Edge Function `api`, Storage y PostgreSQL/PostGIS.
- **RNF24** — `service_role`, la conexión `app_backend`, secretos internos y credenciales de base de datos nunca llegan al móvil ni al repositorio; el cliente recibe configuración publicable.
- **RNF25** — El monitoreo cubre cuotas, errores, latencia, conexiones, pausa, retención, scheduler, antigüedad de exportaciones y auditoría.

### Integridad, seguridad y evolución
- **RNF26** — Un fingerprint se transforma en hash del lado servidor para diversidad y límites de tasa; se elimina a los 30 días y no pretende identificar a la persona.
- **RNF27** — Honeypots invisibles marcan sospecha y envían a revisión; no descartan automáticamente.
- **RNF28** — Cada reporte recibe una evaluación de confianza versionada. La foto es una señal nullable: los reportes sin foto se evalúan al enviarse. Alta puede publicar; media/baja o señales sospechosas requieren revisión.
- **RNF29** — Denuncias usan diversidad de origen, unicidad y límite horario durable; un origen coordinado no alcanza por sí solo el umbral.
- **RNF30** — La detección de duplicados solo sugiere; la decisión humana canónica es reversible y obligatoria.
- **RNF31** — Límites horarios durables en PostgreSQL protegen creación de reportes y denuncias en todas las instancias Edge. El replay idempotente no consume cuota; imagen y sesión tienen controles equivalentes.
- **RNF32** — El cliente normaliza HEIC/HEIF a JPEG preservando orientación y eliminando metadata antes de cargar. La API acepta únicamente JPEG/PNG declarado y detectado, responde `415 unsupported_photo_type` para tipos no admitidos, valida tamaño/dimensiones/decode, re-encodea sin metadata y persiste solo salida saneada en Storage privado con entrega autorizada.
- **RNF33** — Toda moderación, resolución de duplicados y mutación de configuración/geofence se registra en auditoría append-only dentro de la misma transacción.
- **RNF34** — Los JWT tienen expiración corta y refresh seguro. La API verifica firma/claims, perfil activo y coincidencia de rol en cada solicitud privilegiada; un token inválido nunca se degrada a anónimo.
- **RNF35** — Embeddings, GPU y pgvector son una mejora futura opcional. Su ausencia no rompe la heurística de Fase 1 ni la confirmación humana.
- **RNF36** — PostgreSQL valida el JSON tipificado del formulario como defensa de integridad, además de la validación del Servicio.

## Historias de usuario
- **HU-01** — Como habitante de Creel, quiero reportar sin cuenta, incluso offline, para actuar de inmediato.
- **HU-02** — Como reportante, quiero que no se soliciten mis datos personales para minimizar mi exposición.
- **HU-03** — Como reportante, quiero adjuntar opcionalmente una foto validada para aportar evidencia.
- **HU-04** — Como reportante, quiero distinguir solitario de manada para describir el riesgo.
- **HU-05** — Como reportante, quiero un acceso visible para terminar sin foto y sin barreras.
- **HU-06** — Como reportante, quiero clasificar el incidente para representar su severidad.
- **HU-07** — Como reportante, quiero abrir directamente en cámara para capturar el momento.
- **HU-08** — Como usuario público, quiero denunciar contenido visible y conocer que existe una advertencia.
- **HU-09** — Como reportante, quiero validación local con razón de rechazo y reintento sin conexión.
- **HU-10** — Como habitante, quiero un mapa online con ubicaciones aproximadas para reconocer zonas de riesgo sin revelar coordenadas exactas.
- **HU-11** — Como usuario del mapa, quiero clusters para mantener la legibilidad.
- **HU-12** — Como usuario del mapa, quiero que su tamaño refleje la cantidad de reportes.
- **HU-13** — Como usuario del mapa, quiero severidad máxima y desglose completo por tipo.
- **HU-14** — Como usuario del mapa, quiero que el zoom revele progresivamente el detalle.
- **HU-15** — Como Asociación de Hoteles de Chihuahua, quiero acceder con una cuenta individual provisionada para usar funciones exclusivas sin registro público.
- **HU-16** — Como Asociación de Hoteles de Chihuahua, quiero estadísticas de datos aceptados y canónicos para apoyar decisiones.
- **HU-17** — Como Asociación de Hoteles de Chihuahua, quiero exportar la misma proyección autorizada para compartirla.
- **HU-18** — Como Administrator, quiero iniciar sesión con una cuenta individual provisionada para moderar con atribución.
- **HU-19** — Como Administrator, quiero ver contexto completo de revisión, denuncias y duplicados sin recibir BI de Asociación.
- **HU-20** — Como Administrator, quiero ocultar o eliminar lógicamente con auditoría para preservar calidad y reversibilidad.
- **HU-21** — Como Administrator, quiero revisar auto-ocultamientos por denuncias diversas y restaurar, aprobar o eliminar lógicamente.
- **HU-22** — Como reportante, quiero color automático y tamaño/collar opcionales para aportar señales con poco esfuerzo.
- **HU-23** — Como Administrator, quiero resolver y revertir grupos sugeridos, eligiendo manualmente un canónico.
- **HU-24** — Como reportante, quiero preguntas dinámicas y solo pertinentes para completar el flujo con rapidez.

## Contrato técnico consolidado
La aplicación móvil usa Auth exclusivamente para sesiones y la API Hono para
dominio. Controllers adaptan HTTP; Services autorizan, aplican política, orquestan
y poseen transacciones; Repositories ejecutan SQL parametrizado; Domain conserva
invariantes; Presenters construyen JSON. Cada transacción establece `app.user_id`
y `app.role` localmente antes del acceso. `app_backend` es `NOBYPASSRLS`, no posee
objetos y tiene grants mínimos.

PostgreSQL conserva constraints, índices, RLS, privilegios, PostGIS, bloqueos,
auditoría, validación JSON y primitivas privadas atómicas/set-based. Retención
sigue `mark → discover purge_pending → delete → acknowledge`. Todo fallo de JWT,
perfil, rol, geofence, secreto, proyecto, ambiente o scheduler cierra el flujo sin
mutación.

## Trazabilidad y fuentes
La matriz [`../TRACEABILITY.md`](../TRACEABILITY.md) enlaza esta versión con el
texto histórico, endpoints, datos y pruebas. `docs/API.md` y `db/schema.sql` son
contratos pares: si discrepan, la revisión falla y debe resolverse explícitamente
mediante una nueva decisión aprobada.
