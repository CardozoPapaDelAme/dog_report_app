# Pruebas no funcionales

Estado: en curso. La evidencia automatizada e inspecciones se ejecutó el 2026-10-11;
las mediciones en dispositivo, TalkBack, API real y k6 siguen pendientes.
Fuente de alcance: `docs/testing/BACKLOG.md`, T9. Estrategia: `docs/TESTING.md`.
Convenciones: `docs/testing/README.md`.

## Entorno y método

Fecha, responsable, commit/build, dispositivo/OS, versiones de API/base/herramientas,
red y configuración: pendientes. Distinguir test automatizado, medición en teléfono,
inspección y carga. No atribuir evidencia con mocks a un servicio real.

## Registro por requerimiento

| Caso | RNF | Método | Precondiciones y entrada | Pasos/herramienta | Criterio esperado y fuente | Métrica/unidad y resultado obtenido | Ejecución y evidencia | Límites y pendientes |
|---|---|---|---|---|---|---|---|---|
| TC-NF-01 | RNF01 | inspección | Supabase Free | `docs/product/ETAPA1-REQUERIMIENTOS.md` y `docs/DEPLOYMENT.md` | Mejor esfuerzo; 99.9% es meta futura | conforme a la postura declarada | RUN-134 | sin SLA/medición de disponibilidad |
| TC-NF-02 | RNF02 | medición | teléfono y API reales | cronómetro de carga de mapa y envío | mapa <5 s | pendiente | pendiente | requiere dispositivo/red reales |
| TC-NF-03 | RNF03 | carga | staging, lectura pública | `tests/load/public-read.js` con k6 | p95 y tasa de error registrados | pendiente; k6 no instalado | pendiente | nunca ejecutar escrituras |
| TC-NF-05 | RNF05 | dispositivo | Android/iOS | build de desarrollo | Android 8+, iOS 13+ | Android real: evidencia T7; iOS 27 simulador: UAT, no dispositivo físico | RUN-83–116; RUN-124–133 | falta iPhone físico con iOS 13+ |
| TC-NF-06 | RNF06 | automatizado | locales es/en | `i18n/*.test.js`, `tests/ui/language.spec.js` | claves y flujos bilingües | pasó | RUN-134 | falta TalkBack/VoiceOver |
| TC-NF-13 | RNF13 | automatizado/inspección | proyecciones públicas | tests de mapa, foto y `docs/SECURITY.md` | sin PII solicitada ni coordenada exacta pública | pasó en mocks y tests | RUN-134 | no auditoría de producción |
| TC-NF-14–18 | RNF14–RNF18 | inspección | operaciones managed | `docs/DEPLOYMENT.md`, `docs/SECURITY.md` | backup/TLS/no SSH según contrato | documentado | RUN-134 | no simulacro de restore remoto |
| TC-NF-19 | RNF19 | automatizado/inspección | PostGIS aislado | `supabase/functions/api/tests/*Postgres.test.js` | PostgreSQL/PostGIS | suites SQL omitidas sin Docker; esquema declara PostGIS | RUN-134 | falta corrida SQL aislada |
| TC-NF-20–23 | RNF20–RNF23 | automatizado/inspección | roles/API gestionada | servicios, controllers y `docs/SECURITY.md` | RLS, roles hermanos, Hono/API | pasó en pruebas sin DB real | RUN-134 | falta RLS remoto |
| TC-NF-24 | RNF24 | inspección | bundle/configuración | `services/supabaseClient.js`, `.env.example`, `docs/SECURITY.md` | solo `EXPO_PUBLIC_*` publicables | no se hallaron secretos de servidor en cliente | RUN-134 | inspección, no análisis de APK/IPA |
| TC-NF-25 | RNF25 | inspección | operación | `docs/DEPLOYMENT.md` | cuotas/errores/pausa/retención | procedimiento documentado | RUN-134 | monitor real pendiente |
| TC-NF-26 | RNF26 | automatizado | fingerprint | report/flag services y controllers | hash para cuota sin identidad | pasó | RUN-134 | no medición de retención real |
| TC-NF-31 | RNF31 | automatizado | rate limit | `supabase/functions/api/services/reportService.test.js`, `supabase/functions/api/services/flag-service.test.js` | límite antes de mutación | pasó | RUN-134 | falta concurrencia SQL |
| TC-NF-32 | RNF32 | automatizado | imágenes | `supabase/functions/api/domain/photoImage.test.js`, `supabase/functions/api/services/photoService.test.js`, controller | saneamiento y sin EXIF persistido | pasó | RUN-134 | falta Storage real |
| TC-NF-34 | RNF34 | automatizado/inspección | sesión | `models/session.test.js`, `services/authService.test.js`, `docs/SECURITY.md` | expiración, refresh y cierre | pasó en cliente/mocks | RUN-134 | configuración Auth remota pendiente |
| TC-NF-35 | RNF35 | inspección | schema/migraciones | `db/schema.sql`, `supabase/migrations/`, ADR | sin pgvector/embeddings en Fase 1 | no se hallaron `pgvector` ni columnas de embedding | RUN-134 | mejora futura explícitamente fuera de alcance |

Si no hay umbral definido, acordarlo antes de evaluar éxito; no inventar requisitos.
Compatibilidad sin dispositivo disponible queda explícitamente sin cubrir, con
justificación. RNF35 requiere inspección y referencia que pospone embeddings.

## Medición de carga (T9)

Registrar script bajo `tests/load/`, objetivo, URL/entorno, fecha, duración,
usuarios virtuales, cantidad de peticiones, p95 con unidad, tasa de error y
limitaciones. Respetar el alcance ligero de lectura de T9 y las cuotas de staging.
Ejecutar solo tras confirmar staging y cuota: `API_BASE_URL=<base> k6 run tests/load/public-read.js`.
El perfil predeterminado usa 2 usuarios virtuales por 60 s y solo `GET /health`,
`GET /public/clusters` y `GET /public/reports`.

## Conclusiones

RUN-134 valida 368 pruebas Deno, 18 node:test, 88 Playwright y 66 rutas de
documentación. Las seis suites PostgreSQL quedaron omitidas por requerir Docker.
Faltan mediciones reales indicadas arriba; T9 no debe cerrarse hasta registrarlas.
