# Implantación y cumplimiento de requerimientos

Estado: implantado en staging y aceptado por el socio formador con observaciones,
ya atendidas (2026-10-24). Complementa a
[`docs/deployment/MIGRATION-PLAN.md`](docs/deployment/MIGRATION-PLAN.md): aquel
documento dice cómo se despliega; este dice qué quedó implantado y cómo cumple lo
que pidió el cliente.

## 1. Qué está implantado

Entorno: staging (`dcvihomkxkutkckmjvmp`, Supabase managed Free). Producción no
existe todavía: se crea cuando la Asociación de Hoteles de Chihuahua apruebe la
zona geográfica (geofence), como exige `AGENTS.md`.

| Componente | Estado implantado | Evidencia |
|---|---|---|
| API (Edge Function `api`) | Desplegada el 2026-10-24 08:23 UTC desde el commit `0fb3f76` (incluye la corrección de INC-4) con la CLI de Supabase 2.122.0. | `docs/deployment/INFRA-VALIDATION.md`, sección 4 |
| Base de datos | PostgreSQL 17.6 con PostGIS 3.3.7; 12/12 migraciones aplicadas (cabeza `20261021120000`); `supabase db push --dry-run`: «Remote database is up to date». RLS en las 13 tablas. | `docs/deployment/INFRA-VALIDATION.md`, sección 2 |
| Fotos | Bucket privado `approved-photos` (18 objetos, 10 MB). | `docs/deployment/INFRA-VALIDATION.md`, sección 2 |
| Autenticación | Registro público deshabilitado (`422 signup_disabled`); 4 cuentas de personal provisionadas a mano: 3 Administrator y 1 de la Asociación. | `docs/deployment/INFRA-VALIDATION.md`, sección 2 |
| Zona geográfica | Conjunto de zonas **TEST ONLY** activo (Creel + Chihuahua, Delicias y Meoqui), auditado y no aprobado por la Asociación. | `docs/DEPLOYMENT.md`, "Current staging test geofence" |
| App móvil | Build nativo de Expo (no Expo Go). Probada en un Samsung SM-S918B con Android 16 (prueba alfa) y en el simulador de iPhone con iOS 27. Distribución interna a Android con el APK del perfil `preview` de EAS. | `docs/testing/ALPHA.md`, `docs/REVIEWING.md`, `docs/manuals/INSTALLATION.md` |
| Monitoreo y operación | Monitor programado activo cada 15 min (GitHub Actions con el smoke check), monitor sintético en Python, SLA y procedimiento de incidentes. | `docs/deployment/MONITORING.md`, `docs/deployment/SLA.md` |

## 2. Aceptación del cliente

El 18 de octubre de 2026 el socio formador ejecutó los cinco casos de aceptación de
`docs/testing/cases/aceptacion-socio.md` sobre staging. Veredicto: **aceptado con
observaciones** (`docs/testing/ACCEPTANCE.md`, "Sesión con el socio formador";
reporte en `docs/testing/data/aceptacion/2026-10-18/reporte-aceptacion-socio.pdf`).

| Caso | Necesidad del cliente | Requerimientos | Resultado |
|---|---|---|---|
| TC-CLIENTE-01 | Crear un reporte con foto, sin cuenta ni datos personales | HU-01, HU-02, HU-03, HU-06, HU-07; RF01, RF02, RF03, RF06, RF07 | Pasó |
| TC-CLIENTE-02 | Reportar sin conexión y sincronizar después | HU-01, HU-05; RF01, RF05, RNF12 | Pasó |
| TC-CLIENTE-03 | Consultar zonas de riesgo en el mapa | HU-10 a HU-14; RF10 a RF14, RNF13 | Pasó, con observación |
| TC-CLIENTE-04 | Consultar y exportar los datos de la Asociación | HU-15, HU-16, HU-17; RF15, RF16, RF17 | Pasó, con observación |
| TC-CLIENTE-05 | Ocultar un reporte con una justificación | HU-18, HU-19, HU-20; RF18, RF19, RF20 | Pasó |

## 3. Observaciones del socio atendidas

| Observación | Cómo se atendió | Evidencia |
|---|---|---|
| «Los íconos de patitas deben verse desde antes, sin hacer mucho zoom.» | El mapa muestra los pines desde el zoom 15. | PR #84 (TD-137) |
| «La cuenta de Administrador también debe poder descargar los datos.» | Se aprobó como aclaración #27 y se agregó la pantalla de exportación del Administrator (misma proyección de solo lectura, CSV/XLSX). | `docs/product/APPROVED-CLARIFICATIONS.md` (#27), `screens/AdminDataExportScreen.js`, PR #84 |

Ambas mejoras están desplegadas en staging (la API desplegada contiene todo `main`
más la corrección de INC-4).

## 4. Cobertura de requerimientos

Fuente: `docs/TRACEABILITY.md`, "Matriz de verificación de Etapa 4".

- **Requerimientos funcionales:** los 24 RF tienen casos y pruebas disponibles. En
  RF03, RF09, RF13 y RF22 parte de la evidencia usa datos o extracción simulados.
- **Requerimientos no funcionales que la Etapa 5 cubre con evidencia nueva sobre el
  proyecto desplegado:**

| RNF | Qué faltaba en la Etapa 4 | Evidencia de la Etapa 5 |
|---|---|---|
| RNF01 | Postura de disponibilidad en Free | SLA de mejor esfuerzo con 80 % mensual (`docs/deployment/SLA.md`) |
| RNF03 | Carga con más usuarios | k6 con 25 usuarios: 733/733 correctas, p95 2,143 ms |
| RNF15 | Inspección del proyecto administrado | Proyecto, plan Free, cuotas y uso inspeccionados (`docs/deployment/MONITORING.md`) |
| RNF16 | Smoke HTTPS/TLS del despliegue | HTTP → 301 a HTTPS; TLS 1.3, certificado válido |
| RNF19, RNF20 | Catálogos, RLS y grants del proyecto vigente | Checklist sobre staging: RLS 13/13, sin grants móviles, `app_backend` `NOBYPASSRLS` |
| RNF25 | Monitoreo real | Monitor programado activo desde el 2026-10-24 (primera corrida correcta), smoke check y tabla de señales |

- **Siguen pendientes:** el ensayo de restauración (RNF14, RNF18; la primera exportación
  completa ya se hizo, ver `docs/deployment/BACKUP-LOG.md`), medición
  en teléfono físico y en iPhone real (RNF02, RNF05), y las inspecciones restantes
  que lista `docs/TRACEABILITY.md`.

## 5. Límites de la implantación

- **Producción:** no se crea hasta que la Asociación apruebe la zona geográfica; el
  procedimiento está listo en `docs/deployment/MIGRATION-PLAN.md`.
- **Tiendas de aplicaciones:** fuera de alcance de la Fase 1; la distribución es
  interna por enlace (APK) en Android.
- **iPhone físico:** sin dispositivo disponible; iOS se probó en simulador.
