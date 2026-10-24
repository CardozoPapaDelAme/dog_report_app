# Manual de instalación

Guía completa de la tarea:
[`docs/deployment/BACKLOG.md`](docs/deployment/BACKLOG.md), D9.

Este manual explica cómo dejar funcionando las tres partes del sistema: la **app
móvil**, el **back end** (la API en Supabase) y la **base de datos**. Está pensado
para alguien que llega sin contexto: cada paso trae el comando exacto y qué
debería verse.

El flujo principal es la **versión de desarrollo** (build de desarrollo de Expo):
una app instalada en el teléfono que carga el código desde la computadora y se
recarga al guardar. Expo Go (la app genérica de Expo) no sirve para la app
completa: el mapa y la validación de foto son módulos nativos que Expo Go no
incluye. La publicación en tiendas (perfil `production`) queda fuera de alcance.

Nunca escribir secretos aquí: solo valores publicables (`EXPO_PUBLIC_*`) y nombres
de secretos.

Términos que se usan en el manual:

| Término | Significado |
|---|---|
| Build de desarrollo | La app compilada con sus módulos nativos, instalada una vez en el teléfono o emulador |
| Metro | El servidor de JavaScript que corre en la computadora y envía el código a la app |
| EAS | Expo Application Services: compila la app en la nube y entrega un enlace de instalación |
| APK | El archivo instalable de Android |
| Supabase | El proveedor administrado donde viven la API, la base de datos, el almacenamiento de fotos y las sesiones |
| Edge Function `api` | El único back end del sistema (una API Hono en JavaScript) desplegado en Supabase |
| Migración | Archivo SQL versionado en `supabase/migrations/` que cambia la base de datos de forma ordenada |
| Geofence | El polígono geográfico dentro del cual se aceptan reportes |

## 1. Requisitos previos

Fuentes: `README.md` ("Prerequisites"), `scripts/doctor.mjs`.

"Versión probada" indica la versión que el equipo dejó registrada en el repositorio
(`docs/testing/TEST_LOG.md`, `scripts/doctor.mjs`, `eas.json`,
`.github/workflows/tests.yml`). Donde no hay registro dice "sin registrar"; quien
siga el manual debe anotar la suya en la tabla de la última sección.

| Herramienta | Versión probada | Para qué | Obligatoria |
|---|---|---|---|
| Node y npm | Mínimo 20 (`scripts/doctor.mjs`); CI usa 22; corridas registradas con v24.20.0 | Instalar dependencias, Metro, scripts del proyecto | Sí, en todas las plataformas |
| git | Sin registrar (cualquier versión actual) | Clonar el repositorio | Sí |
| Cuenta de GitHub con acceso al repositorio | — | Clonar y abrir PRs | Sí |
| JDK (Java) | 17 o superior (`scripts/doctor.mjs`); se recomienda Temurin 17 | Compilar la app Android | Solo Android local |
| Android Studio (Android SDK y Platform-Tools con `adb`) | Sin registrar | SDK para compilar e instalar en Android | Solo Android local (Windows, macOS o Linux) |
| Xcode | Mínimo 16.1 (requisito de React Native 0.86.3) | Compilar la app iOS | Solo iPhone, solo en Mac |
| CocoaPods | Sin registrar (`brew install cocoapods`) | Dependencias nativas de iOS | Solo iPhone, solo en Mac |
| Cuenta de Expo y EAS CLI | EAS CLI 16.0.0 o superior (`eas.json`) | Builds en la nube (`preview`, `development`) | Solo para builds EAS |
| Cuenta de Apple Developer | — | Builds de iPhone por EAS o duración de un año de la firma | Solo iPhone por EAS |
| Supabase CLI (`npx supabase`) | Sin registrar: anotar la salida de `npx supabase --version` antes de cada despliegue (`docs/DEPLOYMENT.md`) | Vincular el proyecto, migraciones, secretos y despliegue de la Function | Solo back end y BD |
| Docker | Sin registrar | Suites de PostgreSQL (`npm run test:postgres`) y `supabase db dump` | Opcional |
| `psql` | Sin registrar | Restaurar respaldos | Opcional |

Teléfonos: Android 7.0 o superior (API 24, mínimo de React Native) e iOS 16.4 o
superior (mínimo de Expo SDK 57). Son los mínimos del toolchain; el equipo probó
en dispositivos Android reales (`docs/testing/ALPHA.md`).

## 2. App móvil

Fuentes: `README.md` ("Choose how to run", "Setup checklist for coding agents"),
`scripts/setup.mjs`, `scripts/app.mjs`, `.env.example`, `eas.json`,
`docs/REVIEWING.md`.

### 2.1 Cómo se construye (versión de desarrollo)

1. **Clonar e instalar.** En una terminal:

   ```bash
   git clone https://github.com/CardozoPapaDelAme/dog_report_app.git
   cd dog_report_app
   npm run setup
   ```

   `npm run setup` (`scripts/setup.mjs`) revisa la versión de Node, crea `.env` con
   la configuración **pública** del proyecto de staging (solo si `.env` no existe;
   nunca lo sobrescribe y avisa si le faltan variables) y corre `npm install`
   cuando falta `node_modules`.

2. **Variables de la app.** `.env` solo contiene configuración publicable; nunca
   una llave de servicio, y nunca se sube a Git. Las variables (sus nombres
   están en `.env.example` y los valores públicos de staging en `README.md`,
   sección "Team setup"):

   | Variable | Obligatoria | Qué es |
   |---|---|---|
   | `EXPO_PUBLIC_API_BASE_URL` | Sí | URL base de la Edge Function `api` |
   | `EXPO_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto de Supabase (sesiones) |
   | `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sí | Llave publicable del proyecto (Supabase → Project Settings → API Keys) |
   | `EXPO_PUBLIC_MAP_STYLE_URL` | No | Estilo del mapa; si falta se usa OpenFreeMap liberty (sin llave) |

3. **Preparar el teléfono** (una sola vez, no se puede automatizar):
   - **Android (Windows, macOS o Linux):** instalar
     [Android Studio](https://developer.android.com/studio) y abrirlo una vez para
     que descargue el SDK; instalar JDK 17. En el teléfono: Ajustes → Acerca del
     teléfono → tocar *Número de compilación* 7 veces; luego Opciones de
     desarrollador → **Depuración USB** activada. Conectar por USB y aceptar el
     aviso en el teléfono.
   - **iPhone (solo macOS):** instalar Xcode (App Store) y CocoaPods
     (`brew install cocoapods`). Conectar por USB y tocar *Confiar*. En iOS 16 o
     superior: Ajustes → Privacidad y seguridad → **Modo de desarrollador**
     activado. En Xcode → Settings → Accounts agregar el Apple ID.

4. **Diagnosticar la máquina:**

   ```bash
   npm run doctor          # Android
   npm run doctor -- ios   # iPhone (Mac)
   ```

   `npm run doctor` (`scripts/doctor.mjs`) revisa Node, dependencias, que `.env`
   tenga las tres variables obligatorias (solo nombres, nunca valores) y, según la
   plataforma, Java, Android SDK, `adb` y el teléfono conectado, o Xcode y
   CocoaPods. Cada falla trae una sugerencia en español. Termina con "Todo listo."
   cuando no falta nada.

5. **Compilar e instalar:**

   ```bash
   npm run app:android   # Android
   npm run app:ios       # iPhone (Mac)
   ```

   `scripts/app.mjs` vuelve a correr el diagnóstico y, si todo está bien, ejecuta
   `npx expo run:android` o `npx expo run:ios --device`. La primera compilación
   tarda de 10 a 20 minutos y deja la app instalada en el teléfono.

### 2.2 Cómo se instala

**Versión de desarrollo en el propio teléfono o emulador.** El paso 5 anterior ya
la instala. Después, cada día:

```bash
git pull
npm install
npx expo start --dev-client    # agregar --tunnel si el teléfono está en otra red
```

Abrir la app instalada: carga el código de la computadora y se recarga al guardar.
Solo hay que volver a compilar (`npm run app:android` / `npm run app:ios`) cuando
cambia una librería nativa o los plugins de `app.json`. En iPhone con un Apple ID
gratuito la app instalada caduca a los **7 días**; se renueva corriendo otra vez
`npm run app:ios`.

**APK `preview` instalado por enlace (Android, sin herramientas de desarrollo).**
Sirve para revisores y para la demostración: el APK lleva el JavaScript dentro y no
necesita la computadora. Lo prepara una persona con cuenta de Expo, desde la raíz
del repositorio (`docs/REVIEWING.md`):

1. `npx eas-cli login` y, solo la primera vez, `npx eas-cli init` (escribe
   `extra.eas.projectId` en `app.json`; hay que hacer commit de ese cambio).
2. Cargar las variables públicas en el entorno `preview` de EAS. EAS no lee el
   `.env` local, por eso se suben aparte. Desde un `.env` completo:
   `npx eas-cli env:push --environment preview`. O una por una con
   `npx eas-cli env:set --name <VARIABLE> --value <valor público> --environment preview --visibility plaintext`.
3. Compilar: `npx eas-cli build --profile preview --platform android`.
4. Compartir el enlace o el código QR que imprime EAS (también en expo.dev →
   Builds).

Quien revisa abre el enlace en el teléfono, permite instalar desde esa fuente
cuando Android lo pregunte, instala y abre **Creel Stray-Dog Reporting**. Para
iPhone sin build propio, `docs/REVIEWING.md` describe la alternativa con Expo Go
(sin mapa ni validación de foto).

Perfiles de `eas.json`: `development` (cliente de desarrollo, APK interno),
`preview` (APK interno) y `production` (tiendas, fuera de alcance).

## 3. Back end

Fuentes: `docs/DEPLOYMENT.md` ("Remote-first workflow", "Project bootstrap",
"Post-deploy smoke check").

El back end es una sola Edge Function llamada `api` (código en
`supabase/functions/api/`, entrada `supabase/functions/api/index.js`, dependencias
en `supabase/functions/api/deno.json`). No hay otras Functions.

### 3.1 Cómo se construye

No hay un paso de compilación local: Supabase empaqueta la Function en su servidor
al desplegarla con `--use-api` (no necesita Docker). Antes de desplegar se
comprueba el código con las pruebas:

```bash
npm test
```

### 3.2 Cómo se despliega

Solo personal técnico autorizado. Antes de cada despliegue, anotar las versiones
y confirmar que se está apuntando al proyecto correcto (`docs/DEPLOYMENT.md`,
"Required preflight and promotion"); ante cualquier diferencia, no continuar.

1. **Versión de la CLI:** `npx supabase --version`.
2. **Iniciar sesión** (abre el navegador; el token queda fuera de Git):
   `npx supabase login`.
3. **Vincular la carpeta al proyecto:**
   `npx supabase link --project-ref <project-ref>` (staging:
   `dcvihomkxkutkckmjvmp`).
4. **Secretos de la Function.** Se configuran con la CLI desde un archivo fuera de
   Git con permisos restringidos, nunca escribiendo el valor en la línea de
   comandos ni en este repositorio:
   `npx supabase secrets set --env-file <archivo-fuera-de-git>`.
   Nombres que usa la Function (`supabase/functions/api/infrastructure/config.js`):

   | Secreto (solo nombre) | Para qué |
   |---|---|
   | `APP_BACKEND_DATABASE_URL` | Conexión del login `app_backend` por el pooler de Supabase |
   | `JWT_SECRET` | Opcional: respaldo para verificar tokens si no se usa JWKS |
   | `APPROVED_PHOTOS_BUCKET` | Nombre del bucket privado de fotos aprobadas |
   | `EXPECTED_SUPABASE_PROJECT_REF` | Proyecto esperado (protección contra desplegar en otro) |
   | `EXPECTED_DEPLOYMENT_ENVIRONMENT` | `staging` o `production`; debe coincidir con la metadata de la BD |
   | `INTERNAL_RETENTION_SECRET` | Autoriza la ruta interna de retención |
   | `ALLOW_REPORTS_WITHOUT_ACTIVE_GEOFENCE` | Solo pruebas no productivas, temporal; en producción no se define |

   `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los pone Supabase. Para revisar,
   `npx supabase secrets list` muestra nombres y digests, nunca valores.
5. **Desplegar:** `npx supabase functions deploy api --use-api`.
6. **Comprobación posterior (smoke check):**
   - `curl -s https://dcvihomkxkutkckmjvmp.supabase.co/functions/v1/api/health`
     debe responder 200.
   - Con una sesión de Administrador, `GET /functions/v1/api/me` y
     `GET /functions/v1/api/admin/configuration` deben responder 200. Un
     `503 preflight_mismatch` en el segundo indica que
     `EXPECTED_DEPLOYMENT_ENVIRONMENT` falta o no coincide con la BD.
   - `POST /auth/v1/signup` con la llave publicable debe responder
     `422 signup_disabled`.
   - El comando `npm run smoke` automatiza las comprobaciones públicas (health
     check y registro deshabilitado) con la configuración publicable de `.env`,
     sin secretos del servidor, e imprime una línea por comprobación con su
     latencia. La validación completa de la infraestructura se registra en
     `docs/deployment/INFRA-VALIDATION.md`.

## 4. Base de datos

Fuentes: `supabase/migrations/`, `db/schema.sql`, `docs/SECURITY.md`
("Provisioning runbook"), `docs/DEMO_DATA.md`.

La base de datos es PostgreSQL con PostGIS (extensión geográfica) dentro del
proyecto de Supabase. Su estructura se crea solo con las migraciones de
`supabase/migrations/`, en orden. `db/schema.sql` es el modelo objetivo de
referencia: no se aplica de golpe sobre una base existente.

### 4.1 Cómo se inicializa

1. **Proyecto.** Crear o elegir el proyecto de Supabase (plan Free) y decidir si es
   `staging` (demo y pruebas) o `production` (en vivo, aprobado). La primera
   migración deja `public.deployment_metadata.environment` en `staging`; solo un
   proyecto en vivo aprobado se cambia a `production`.
2. **Autenticación.** En Supabase → Authentication, desactivar el registro público y
   los proveedores que no se usan. Las cuentas se crean a mano (paso 7).
3. **Extensiones.** Activar o comprobar PostGIS y pgcrypto en el esquema
   `extensions` (Supabase → Database → Extensions).
4. **Migraciones.** Con la carpeta ya vinculada (sección 3.2, pasos 2 y 3), revisar
   primero qué se aplicaría y después aplicarlo:

   ```bash
   npx supabase db push --dry-run
   npx supabase db push
   ```

   Después, comprobar que el login `app_backend` es `NOBYPASSRLS` y no es dueño de
   objetos, que RLS (seguridad por filas) está activa y correr los advisors de
   seguridad y rendimiento de Supabase.
5. **Bucket privado.** Crear el bucket privado de fotos aprobadas (Supabase →
   Storage) con el nombre que se pondrá en `APPROVED_PHOTOS_BUCKET`, y sus
   políticas de mínimo privilegio solo después de verificar el esquema de Storage
   instalado.
6. **Secretos y despliegue de la Function:** sección 3.2.
7. **Cuentas del personal** (`docs/SECURITY.md`, "Provisioning runbook"). Para cada
   persona autorizada de la Asociación o Administrador:
   - crear la cuenta en Supabase → Authentication;
   - poner `app_metadata.app_role` del usuario en `association` o
     `administrator` (solo lo puede escribir el servidor);
   - crear su fila en `public.profiles` con el mismo rol y `active = true`;
   - probar con esa cuenta una ruta permitida y una negada;
   - entregar la contraseña temporal por un canal seguro, nunca por Git ni chats
     públicos.
   Sin la fila de perfil el login se rechaza; si el rol no coincide, la API
   responde `403 role_mismatch`.
8. **Metadata de entorno.** Confirmar que el secreto
   `EXPECTED_DEPLOYMENT_ENVIRONMENT` es igual a
   `public.deployment_metadata.environment`.
9. **Geofence de prueba.** Solo en staging, iniciar sesión como Administrador,
   crear y activar un conjunto de zonas de prueba marcado como **TEST ONLY**
   (`POST /admin/zone-sets` y `/activate`, desde la pantalla de zonas). Las
   coordenadas viven solo en la BD, nunca en Git. El conjunto actual de staging y
   cómo reemplazarlo están en `docs/DEPLOYMENT.md` ("Current staging test
   geofence"). Producción no se activa hasta que la Asociación de Hoteles de
   Chihuahua apruebe un geofence (`docs/product/GEOFENCE-CANDIDATE.md`).
10. **Datos de demostración (opcional).** Para enseñar la app con un mapa con
    actividad, ejecutar `scripts/demo-seed.sql` en el SQL Editor de staging; se
    retiran con `scripts/demo-unseed.sql`. Detalles y fotos en
    `docs/DEMO_DATA.md`. Nunca en producción.

## 5. Verificación de la instalación

| Parte | Comprobación | Resultado esperado |
|---|---|---|
| Máquina de desarrollo | `npm run doctor` (o `npm run doctor -- ios`) | Todas las líneas con ✓ y "Todo listo." |
| Código | `npm test` | Todas las suites pasan (resumen por suite al final) |
| API | `curl -s https://dcvihomkxkutkckmjvmp.supabase.co/functions/v1/api/health` | Respuesta 200 |
| API con sesión | Smoke check de la sección 3.2 | 200 en `/me` y `/admin/configuration`; `422 signup_disabled` en el registro |
| App | Abrir la app → tomar una foto → enviar un reporte dentro del geofence de prueba | El reporte se acepta y la foto se sube |
| App | **Ver mapa** desde la cámara | Mapa con grupos de reportes (solo en build de desarrollo o APK) |
| Personal | **Acceso de personal** → iniciar sesión | El Administrador ve el Command Center; la Asociación ve su panel |

## 6. Problemas comunes

Tomados de los mensajes de `scripts/doctor.mjs` y de las notas de `README.md`.

| Síntoma | Causa | Solución |
|---|---|---|
| "Node … es muy viejo (se necesita 20 o superior)" | Versión de Node antigua | Instalar Node 20 o superior (nodejs.org o nvm) |
| "Faltan las dependencias" | No existe `node_modules` | `npm run setup` (o `npm install`) |
| "No existe el archivo .env" o "Faltan en .env: …" | Falta configuración pública | `npm run setup`, o agregar las variables con los valores del README |
| "No se encontró Java" o "Java … es muy viejo" | Falta JDK 17 | Instalar JDK 17 (Temurin) y abrir una terminal nueva |
| "No se encontró el Android SDK" | Android Studio no instalado o nunca abierto | Instalar Android Studio, abrirlo una vez, o definir `ANDROID_HOME` |
| "No se encontró adb" | Faltan Platform-Tools | Android Studio → SDK Manager → SDK Tools → Android SDK Platform-Tools |
| "El teléfono está conectado pero sin autorizar" | No se aceptó la depuración USB | Desbloquear el teléfono y aceptar «¿Permitir depuración USB?» |
| "El teléfono aparece offline" | Conexión USB inestable | Reconectar el cable o reactivar la depuración USB; luego `adb kill-server` |
| "No hay ningún teléfono Android conectado" | Depuración USB apagada o sin cable | Activar Opciones de desarrollador → Depuración USB y conectar |
| "Las builds de iPhone solo se pueden hacer en una Mac" | Se intentó iOS fuera de macOS | Usar Expo Go (`docs/REVIEWING.md`) o un build EAS de un compañero |
| "Xcode no disponible" / "CocoaPods no disponible" | Falta herramienta de iOS | Instalar Xcode y aceptar la licencia; `brew install cocoapods` |
| La app en iPhone deja de abrir a los 7 días | Firma con Apple ID gratuito | Volver a correr `npm run app:ios` |
| La app se cierra al abrir en iOS 27 | Carpeta `ios/` vieja sin ciclo de vida UIScene | `npx expo prebuild --platform ios --clean` y luego `npm run app:ios` |
| El mapa muestra una lista en vez del mapa | Se abrió con Expo Go | Usar la build de desarrollo o el APK `preview` |
| `400 invalid_coordinates` al enviar | El teléfono está fuera del geofence activo | Enviar desde la zona de prueba; en simulador, fijar una ubicación dentro |
| `403 role_mismatch` al iniciar sesión | El rol de `app_metadata` no coincide con el perfil | Corregir la cuenta según la sección 4.1, paso 7 |
| `503 preflight_mismatch` en rutas de Administrador | Secreto de entorno ausente o distinto a la BD | Revisar `EXPECTED_DEPLOYMENT_ENVIRONMENT` (sección 4.1, paso 8) |
| La app web (`expo start --web`) no llama a la API | La API no implementa CORS | Usar un cliente nativo (build de desarrollo o Expo Go) |
| El build EAS no tiene las variables | EAS no lee el `.env` local | `npx eas-cli env:push --environment <entorno>` |

## Registro de prueba del manual

El backlog pide que alguien distinto del autor siga este manual en una máquina
limpia y anote el resultado. Aún no se ha hecho: la fila queda pendiente hasta que
se ejecute.

| Fecha | Quién lo siguió | Sistema operativo | Resultado | Notas |
|---|---|---|---|---|
| Pendiente | Pendiente (persona distinta del autor) | Pendiente | Pendiente | Anotar versiones de Node, Supabase CLI y Android Studio/Xcode usadas |
