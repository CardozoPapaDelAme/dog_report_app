# Requirements Traceability Matrix

This document exclusively owns the complete historical SRS → normative SRS v2 →
HTTP/data → verification mapping. Every row preserves the same exact identifier
in [`docs/product/ETAPA1-REQUERIMIENTOS.md`](https://github.com/CardozoPapaDelAme/dog_report_app/blob/main/docs/product/ETAPA1-REQUERIMIENTOS.md) and
[`docs/product/ETAPA1-REQUERIMIENTOS-V2.md`](https://github.com/CardozoPapaDelAme/dog_report_app/blob/main/docs/product/ETAPA1-REQUERIMIENTOS-V2.md).
Approved amendments govern changed wording. Relationships are many-to-many.

## Functional requirements

| ID | Flow/component | Data/API boundary | Verification focus |
|---|---|---|---|
| RF01 | Anonymous report flow | `POST /reports`; ReportService; `reports` | No login; Hono-only insert; durable rate/replay |
| RF02 | Privacy copy and form | Minimized command parameters | No identity fields; incidental-PII warning |
| RF03 | Camera/photo capture | Local file; report photo POST/status routes; `photo_assets` | Optional single photo, report-first upload, terminal-state monotonic retry/cleanup |
| RF04 | Dynamic form | `reports.sighting_type` | Solitary/pack validation |
| RF05 | Camera quick action | Offline draft without photo | Report completes photo-free |
| RF06 | Dynamic form | `incident_type`; validated `details` | Every category accepted/rejected correctly |
| RF07 | Root navigation | Camera-first anonymous route | Cold-start route test |
| RF08 | Public report detail | `POST /reports/:report_id/flags`; FlagService; `report_flags` | One effective flag per fingerprint/report; durable limit; client: `components/ZoneReportsSheet.js`, `components/ReportFlagSheet.js`, `hooks/reportFlagSubmit.js`, `services/flagApi.js`, `models/reportFlag.js` (`tests/ui/publicMap.spec.js`, Deno `hooks/reportFlagSubmit.test.js`, `services/flagApi.test.js`, `models/reportFlag.test.js`) |
| RF09 | On-device vision | Bundled MobileNetV3-Small classifier (float32; see ADR-009 amendment) via `react-native-fast-tflite`; `services/photoValidationRuntime.js`, `services/photoPixels.js`, `services/photoInference.js`, `models/photoValidation.js`, `hooks/useCameraCapture.js` | Dev/standalone builds validate dog/no-dog and blur offline and ask for a retake with a reason. Skipped explicitly in Expo Go and web (`validationSkipped`); fail-open (`model_error`) if the model cannot load or run. Thresholds provisional; model load, latency and accuracy are device-only (Deno `services/photoInference.test.js`, `services/photoPixels.test.js`, `models/photoValidation.test.js`) |
| RF10 | Online public map | `GET /public/reports`; presenter/repository | Approximate recent visible canonical pins |
| RF11 | Map clustering | `GET /public/clusters`; PostGIS repository query | Metric grouping at supported zooms; documented viewport/limit |
| RF12 | Cluster renderer | `report_count` | Circle size follows count |
| RF13 | Cluster renderer | `highest_severity`; `type_counts` | Highest severity and all six type keys, zeros included |
| RF14 | Map interaction | Fixed zoom-to-radius repository contract | Progressive expansion to pins |
| RF15 | Asociación de Hoteles de Chihuahua login | `LoginScreen` → `useLogin` → login Controller/Service → Supabase Auth + `GET /me` | Multiple provisioned accounts; no signup; role from server |
| RF16 | Asociación de Hoteles de Chihuahua dashboard; `screens/associationDashboardScreen.js`, `components/associationDatePicker.js`, `components/associationSummaryCard.js`, `components/associationReportCard.js`, `presenters/associationDisplay.js`, `models/associationReport.js`, `models/associationSummary.js`, `models/associationWorkbook.js`, `services/associationExport.js`, `services/associationReportApi.js`, `hooks/useAssociationReports.js` | `GET /association/reports` through cursor-based range loader; local summary and CSV/XLSX export of the complete accepted projection for the selected range | Accepted canonical business data only; quick 7/30-day and month filters, custom calendar range, total and acceptance-date bars grouped daily through 31 days or monthly after, localized mobile cards/desktop table, two export format buttons, loading, empty/error states, full pagination in model/API/loader and `tests/ui/associationDashboard.spec.js` |
| RF17 | Asociación de Hoteles de Chihuahua export; shared RIC-2 projection and complete in-memory range | Same paginated role route/view; local CSV download/share, no export endpoint | Loader rejects partial/repeated pages; browser test compares downloaded CSV rows with the filtered table; mobile share requires Expo development build |
| RF18 | Administrator login | `LoginScreen` → `useLogin` → login Controller/Service → Supabase Auth + `GET /me` | Provisioned account; no signup; role from server |
| RF19 | Administrator Command Center and moderation queue | `GET /admin/moderation-queue`; `CommandCenterScreen`; `useModerationQueue` | Original fields, GPS/mock, photo expectation, component trust; page-scoped responsive ES/EN summary; no aggregate/BI endpoint |
| RF20 | Administrator moderation commands | Report command routes; generic mobile command client | Approve/hide/restore/delete update the queue projection; hide, restore and delete require a written reason; no direct mobile database update; audited reversible deletion |
| RF21 | Flag review/state machine | FlagService + restore/approve routes | Threshold, audit, restore semantics |
| RF22 | On-device attributes | Structured report columns (`dog.predominant_color`, `size`, `has_collar`); `models/dogColor.js`, `services/dogColorRuntime.js`, `services/photoColorFlow.js`, `hooks/useReportDraftFlow.js`, `screens/ReportFormScreen.js` | Colour is extracted automatically on-device (pure JS, also in Expo Go/web; fixed vocabulary negro/blanco/café/gris/dorado/mixto; `null` when unclear), shown as a changeable/clearable hint and overridden by the user's choice; size and collar are manual (Deno `models/dogColor.test.js`, `services/photoColorFlow.test.js`, `models/reportPayload.test.js`; Playwright `tests/ui/reportForm.spec.js`) |
| RF23 | Duplicate review | Administrator duplicate routes; candidates/groups/memberships | Human-only, pending connected set, canonical, reversible, audited |
| RF24 | Dynamic form | `details` JSONB validator | Allowed keys/types per incident |

L3 public map executable coverage is split across
`supabase/functions/api/controllers/publicMapController.test.js`, `supabase/functions/api/services/publicMapService.test.js`,
`supabase/functions/api/repositories/publicMapRepository.test.js`, and the opt-in
`supabase/functions/api/tests/publicMapPostgres.test.js`. Together they cover RF10–RF14 and HU-10–HU-14:
stable read-time 50 m public approximation, bounded public report and cluster
queries, server-side metric clustering, highest severity and complete six-key
type counts.

## ERI-9 public map screen

| Requirements / stories | Implemented boundary | Executable evidence |
|---|---|---|
| RF10; HU-10 | `screens/PublicMapScreen.js` → `hooks/usePublicMap.js` → `services/publicMapApi.js` (`GET /public/reports` at zoom 17 or more); pin sheet with public fields, photo when `has_sanitized_photo`, flag notice when `has_flags`; "map not available offline" state | `models/publicMap.test.js`; `services/publicMapApi.test.js`; `hooks/publicMapLoader.test.js`; `tests/ui/publicMap.spec.js` (pins, flag notice, offline) |
| RF11, RF14; HU-11, HU-14 | Zoom below 17 requests `GET /public/clusters` with zoom and full viewport; zooming in re-queries until pins (`models/publicMap.js` zoom bands mirror the server) | `models/publicMap.test.js` (band parity); `hooks/publicMapLoader.test.js`; `tests/ui/publicMap.spec.js` (zoom 13 to 17, all-or-none viewport) |
| RF12; HU-12 | Cluster size from `report_count` (`clusterRadiusPx`) | `models/publicMap.test.js`; `tests/ui/publicMapClusterSize.spec.js` (device `components/PublicMapView.js` with MapLibre replaced by `tests/ui/maplibre-stub.js`: 36 px minimum, 96 px maximum); real map rendering needs a development build |
| RF13; HU-13 | Colour from `highest_severity` (`severityColor`); cluster modal with all six `type_counts` keys | `models/publicMap.test.js`; `tests/ui/publicMap.spec.js` (severity, six counts) |
| RNF02 | Debounced loads, stale-response protection, bounded queries from the server | `hooks/publicMapLoader.test.js`; <5 s load target still needs a device measurement |
| RNF13 | Anonymous requests (no `Authorization`), approximate coordinates only, no client re-clustering | `tests/ui/publicMap.spec.js` (no Authorization header) |

Provider: OpenFreeMap interim style via `services/mapConfig.js`
(`EXPO_PUBLIC_MAP_STYLE_URL`; ADR-008 amendment). The native map component
`components/PublicMapView.js` is verified manually on a development build; the web
stub `components/PublicMapView.web.js` backs the Playwright spec.

## Non-functional requirements

| ID | Flow/component | Data/API/operations boundary | Verification focus |
|---|---|---|---|
| RNF01 | Availability posture | Managed Free best effort; future 99.9% target | No current SLA/PITR claim; pause/readiness check |
| RNF02 | Public map | Bounded queries, indexes, pagination | <5 s target under prototype load |
| RNF03 | API/database | Bounded Hono queries, spatial/time indexes | Load test growth profile |
| RNF04 | Report UX | Camera-first dynamic form; UAT con usuarios generales | `TC-UAT-01` en `docs/testing/cases/uat.md`: U01, U02 y U03 completaron reporte en 76.15 s, 123.43 s y 10 s respectivamente (`RUN-124`, `RUN-125`, `RUN-127`), bajo 300 s |
| RNF05 | Mobile app | Expo development builds, iOS/Android | Supported-device smoke tests |
| RNF06 | Localization | `react-i18next`; device-locale selection (`i18n/deviceLanguage.js`, es default); all role flows | ES/EN key parity (`i18n/locales.test.js`), language selection test, English Playwright spec; TalkBack/VoiceOver and layout manual |
| RNF07 | Auth/navigation | Two sibling roles; profile checks | No public signup or role inheritance |
| RNF08 | On-device vision | `react-native-fast-tflite`; bundled MobileNetV3-Small (float32 despite the `int8` file name) | Runs offline in development/standalone builds; not in Expo Go/web. Load/latency device-only |
| RNF09 | Location validation | Versioned zones; ReportService + PostGIS repository | New points outside rejected; identical replay still accepted; mock/imprecise reviewed |
| RNF10 | Photo validation | On-device model; shared 224×224 pixel pipeline; transient EXIF signals | Offline inference with no network call; fail-open to skipped on model error; no raw EXIF persistence |
| RNF11 | Dog attributes | Structured columns and duplicate signals (server compares `lower(color)` equality) | Offline colour extraction from the same pixels; colour is a signal the user can change or clear, never an identity claim (`models/dogColor.test.js`) |
| RNF12 | Offline sync | Expo SQLite + local file + Hono receipts/status; `hooks/draftAutoSync.js` + `hooks/useDraftAutoSync.js` (expo-network listener + AppState `active`, 2 s debounce, single-flight) calling `syncDueDrafts` | Crash-safe idempotent sync (final report UUID replay); backoff/Retry-After respected; `draft`/`terminal_error` never auto-synced; purge states stop upload retry. Tests: `hooks/draftAutoSync.test.js`; airplane-mode toggle is device-only |
| RNF13 | Privacy | Minimized projections and retention | No solicited public identity; PII moderation |
| RNF14 | Database recovery | Roles/schema/data dumps plus private-object manifest/export; production backup gate | Isolated `psql`/object restore rehearsal; do not claim Free meets required RPO/RTO |
| RNF15 | Hosting | Supabase managed Free amendment | Managed project readiness and quota evidence; historical OVH wording superseded |
| RNF16 | Network | Supabase-managed TLS/gateway plus app access controls | HTTPS smoke test; no team-operated host firewall claim |
| RNF17 | Server administration | Managed dashboard/CLI access with operator MFA/least privilege | No SSH/VPS operation; operator access audit |
| RNF18 | Infrastructure recovery | External encrypted DB dumps, private bytes/manifest, migrations/Functions | Checksummed restore into isolated managed project |
| RNF19 | Database | Managed PostgreSQL/PostGIS in `extensions` | Verify project catalogs; no provider-column/public-schema assumption |
| RNF20 | Authorization | Service authorization + local-GUC RLS + grants | Unset/spoofed/cross-role negative tests |
| RNF21 | API/Auth | Supabase Auth sessions + Hono `api` + parameterized repositories | Route/JWT/layer-boundary integration |
| RNF22 | Edge routing | Supabase-managed gateway/runtime/TLS | HTTPS smoke test; no custom gateway topology claim |
| RNF23 | Internal services | One managed boundary: Auth/`api`/Storage/PostgreSQL | No direct mobile database exposure or invented physical internals |
| RNF24 | Secrets | `app_backend`, JWT, Storage, scheduler secrets server-only | Bundle/repository/response secret scanning |
| RNF25 | Operations | Managed usage, API errors, pool, scheduler, pause, retention, exports | Quota/readiness/dashboard smoke tests |
| RNF26 | Anti-abuse | Server hashes; `rate_limit_buckets`; prepare/list/Storage-delete/acknowledge/finalize retention phases | Concurrent limits and partial-failure retention retry |
| RNF27 | Submission integrity | Honeypot signal to TrustService | Suspicious goes to review, not discard |
| RNF28 | Trust workflow | Versioned TrustService; nullable photo signals | Photo-free assessed; high publishes; medium/low reviews |
| RNF29 | Flag integrity | Uniqueness/diversity + durable flag bucket | Coordinated/concurrent flags cannot bypass policy |
| RNF30 | Duplicate workflow | Candidate/groups/memberships | Detection never resolves automatically |
| RNF31 | Public edge | Hono middleware + atomic PostgreSQL rate buckets | Report/flag/image concurrent abuse tests |
| RNF32 | Image processor | Client HEIC→JPEG; Hono photo routes; private sanitized Storage | JPEG/PNG sniff/decode/re-encode; `415 unsupported_photo_type`; monotonic state, no raw persistence, delivery |
| RNF33 | Audit | Repository INSERT-only `audit_log` in mutation transaction | Every admin/config/duplicate command atomic with audit |
| RNF34 | Sessions | Auth refresh + Hono JWT/profile/role middleware | Invalid never anonymous; expiry/refresh/logout limitation |
| RNF35 | Optional Phase 2 visual similarity | Future GPU/pgvector migration; Phase 1 heuristic fallback | Absent from baseline schema; suggestions remain human-confirmed |
| RNF36 | Dynamic form | DB validator | Type/key/value boundary cases |

## User stories

| ID | Related requirements | Flow/component | Data/API | Verification focus |
|---|---|---|---|---|
| HU-01 | RF01, RNF12 | Anonymous report | `POST /reports` | Offline/no-login creation |
| HU-02 | RF02, RNF13 | Privacy/form | Minimized payload | No identity solicitation |
| HU-03 | RF03, RF09 | Camera | Report-first Hono photo upload/status | Capture, binding, terminal retry stop, validation, cleanup |
| HU-04 | RF04, RF24 | Form | `sighting_type` | Required classification |
| HU-05 | RF05, RF07 | Camera quick action | Offline draft | Visible no-photo path |
| HU-06 | RF06, RF13, RF24 | Incident form | `incident_type`, `details` | Categories and severity |
| HU-07 | RF07 | Navigation | N/A | Camera is initial route |
| HU-08 | RF08, RF21, RNF29 | Public detail/flagging | Hono flag route | Warning, durable limit, auto-hide behavior; client zone list and flag form: `components/ZoneReportsSheet.js`, `components/ReportFlagSheet.js`, `hooks/zoneReports.js` (`tests/ui/publicMap.spec.js`, `hooks/zoneReports.test.js`) |
| HU-09 | RF09, RNF08, RNF10 | On-device vision | Bundled MobileNetV3-Small classifier, dev/standalone builds only | Offline retake reasons; skipped in Expo Go/web; fail-open on model error |
| HU-10 | RF10, RNF13 | Online map | Public reports route/view | Approximate visible pins/offline UX |
| HU-11 | RF11, RF14 | Map clusters | Public clusters route/view | Geographic grouping |
| HU-12 | RF12 | Cluster renderer | `report_count` | Proportional size |
| HU-13 | RF13 | Cluster detail | Severity/count fields | Highest severity and breakdown |
| HU-14 | RF14 | Map zoom | Fixed zoom levels | Progressive expansion |
| HU-15 | RF15, RNF07 | Asociación de Hoteles de Chihuahua auth | JWT/profile/role + `GET /me` | Provisioned multi-account role |
| HU-16 | RF16 | Asociación de Hoteles de Chihuahua dashboard | `AssociationDashboardScreen` → `useAssociationReports` → RIC-2 route/presenter | Accepted canonical data; filtered table, loading and empty states |
| HU-17 | RF17 | Asociación de Hoteles de Chihuahua export | Same in-memory table rows → CSV file | Export parity and disabled action until the complete range loads |
| HU-18 | RF18, RNF07 | Administrator auth | JWT/profile/role + `GET /me` | Provisioned access |
| HU-19 | RF19, RF08 | Command Center moderation queue | Administrator route/presenter + responsive Expo screen | Flag/trust context, explicitly page-scoped summary, pagination, refresh, empty/error/session states |
| HU-20 | RF20, RNF33 | Moderation | Hono approve/hide/restore/delete routes + generic Expo command client | Audited logical deletion; buttons follow `allowed_commands`; successful commands update the local queue projection |
| HU-21 | RF21, RNF29 | Flag review | FlagService + restore/approve routes | Configured threshold workflow |
| HU-22 | RF22, RNF11 | Attributes | Structured columns; `models/dogColor.js` | Automatic colour (changeable) plus manual size/collar semantics |
| HU-23 | RF23, RNF30 | Duplicate review | Administrator duplicate routes | Canonical/reverse/audit |
| HU-24 | RF24, RNF36 | Dynamic form | JSON contract | Conditional required fields |

## Test ownership

Executable Deno tests cover Hono, domain, repository, service, and mobile
model/client behavior. Expo Doctor and Android/web exports provide mobile-shell
and bundling checks; supported-device interaction and accessibility smoke tests
remain release evidence as described by [`docs/TESTING.md`](https://github.com/CardozoPapaDelAme/dog_report_app/blob/main/docs/TESTING.md).

## FAB-1 / L1 configuration implementation

Approved amendment #5 adds Administrator configuration management to the existing
requirements below. These mappings cover threshold management only; they do not
claim implementation of flagging, trust assessment, duplicate resolution, or L4 UI.
All file paths below are complete from the repository root.

| Requirements / stories | Implemented boundary | Executable evidence |
|---|---|---|
| RF21; HU-21; RNF29 | `GET/POST /admin/configuration`; flag threshold/rate validation | `supabase/functions/api/domain/configuration.test.js` (`FAB-1 VALIDATION`); `supabase/functions/api/controllers/configurationController.test.js` (`FAB-1 HTTP`) |
| RF23; HU-23; RNF30 | Versioned duplicate radius/time thresholds, without resolving duplicates | `supabase/functions/api/domain/configuration.test.js`; `supabase/functions/api/tests/configurationPostgres.test.js` (`FAB-1 SQL`) |
| RNF09, RNF26, RNF28, RNF31 | GPS, trust-band and hourly rate constraints; active-zone metadata projection | `supabase/functions/api/domain/configuration.test.js`; `supabase/functions/api/services/configurationService.test.js` (`FAB-1 SERVICE`); zone/environment steps in `FAB-1 SQL` |
| RNF20, RNF21 | Administrator middleware, Service profile recheck, local actor context, SQL/RLS and environment separation | `supabase/functions/api/controllers/configurationController.test.js`; `supabase/functions/api/services/configurationService.test.js`; privilege/context steps in `FAB-1 SQL` |
| RNF33 | Immutable history, sequential versions, atomic activation and JSON audit evidence | `supabase/functions/api/repositories/configurationRepository.js`; rollback, concurrent-reader and six-writer steps in `FAB-1 SQL` |

Live Supabase session/JWT/profile integration remains a release check requiring a
provisioned Administrator. The isolated PostgreSQL suite validates the actual
configuration-related DDL and policies, not the entire PostGIS/Storage deployment.


FAB-1 integration with main `65f2cda` extends RNF20/RNF21 regression coverage in
`supabase/functions/api/controllers/configurationController.test.js`: `/api/admin/configuration` uses
the shared application prefix, and identity (`/api/me`), moderation queue and JP's
hide route remain mounted and authenticated. RF18/HU-18 authenticated session
verification still requires the managed staging smoke test.


`supabase/functions/api/tests/identityConfiguration.test.js` adds FAB-1 simulated-session coverage for
RF18/HU-18, RNF20/RNF21 and RNF33: the identity view and configuration audit refer
to the same actor, association access is denied, and profile revocation prevents
publication. Its session and persistence are simulated; real JWT/Supabase
verification remains pending.

## RF15 / RF18 / RNF07 Expo login (L3)

The Expo login sends credentials to Supabase Auth, then the login Controller
calls `GET /me` and uses only its validated sibling role to select the
Association or Administrator dashboard. The Supabase session persists through
the native SecureStore adapter; refresh tokens are never placed in app-owned
plain storage. Failure to refresh or validate an active profile clears the
current device session. There is no signup or role selector.

| Requirements / stories | Implemented boundary | Executable evidence |
|---|---|---|
| RF15, RF18, RNF07, RNF20, RNF21; HU-15, HU-18 | `LoginScreen` → `useLogin` → `loginController` → `authService` → Supabase Auth + `GET /me` | `controllers/loginController.test.js`; `services/secureSessionStorage.test.js`; `npm run test:auth` |

These tests use an injected Auth/API service and fake secure storage. Real
managed Supabase sign-in and physical-device Keychain/Android Keystore behavior
remain release checks after local public client configuration is supplied.

## FAB-2 / L2 zone-set implementation

| Requirements / stories | Implemented boundary | Executable evidence |
|---|---|---|
| RNF09 | `POST /admin/zone-sets`; canonical GeoJSON/checksum; draft-only creation | `supabase/functions/api/domain/zoneSet.test.js` (`FAB-2 DOMAIN`); `supabase/functions/api/services/zoneService.test.js` (`FAB-2 SERVICE`); `supabase/functions/api/tests/zonePostgres.test.js` (`FAB-2 SQL`) |
| RNF20, RNF21 | Administrator routes, profile recheck, local actor context, environment isolation | `supabase/functions/api/controllers/zoneController.test.js` (`FAB-2 HTTP`); `supabase/functions/api/services/zoneService.test.js`; `supabase/functions/api/tests/zonePostgres.test.js` |
| RNF33 | Immutable provenance, one-active-zone rule, atomic retire/activate and audit | `supabase/functions/api/repositories/zoneRepository.js`; `supabase/functions/api/domain/zoneSet.js`; real rollback/concurrency/column-grant coverage in `supabase/functions/api/tests/zonePostgres.test.js` |

Migration `supabase/migrations/20261001120000_split_backend_mutate_policies.sql` replaces the
`FOR ALL` `config_backend_mutate`, `zones_backend_mutate` and
`zone_geometry_backend_mutate` policies with per-command
`config_backend_insert/update`, `zones_backend_insert/update` and
`zone_geometry_backend_insert` policies (same predicate; no DELETE policies and
no `zones` UPDATE, matching the grants). It supports RNF20, RNF21 and RNF33; the
`pg_policies` step in `supabase/functions/api/tests/zonePostgres.test.js` (`FAB-2 SQL`) asserts the exact
set of permissive `app_backend` policies (one per granted command), and `supabase/functions/api/tests/configurationPostgres.test.js`
extracts the split policies from `db/schema.sql`.

The PostgreSQL/PostGIS migrations preserve retirement evidence, canonical source
GeoJSON, and the narrow `retired_at` update grant required for replacement. Their
legacy-data preflight stops instead of fabricating lifecycle evidence. Managed
staging verification remains required before claiming a live activation.

`FAB-2 HTTP integration` exercises the real Controller and Service together
with simulated authentication and persistence, covering creation and activation
with the optional note omitted. It guards against passing internal normalized
fields back through the external-input validator; it does not verify a real JWT.

## FAB-3 / L3 duplicate resolution implementation

| Requirements / stories | Implemented boundary | Executable evidence |
|---|---|---|
| RF23; HU-23; RNF30 | Human canonical selection over a connected induced pending-candidate graph; no arbitrary grouping | `supabase/functions/api/domain/duplicateGroup.test.js` (`FAB-3 DOMAIN`); `supabase/functions/api/services/duplicateService.test.js` (`FAB-3 SERVICE`); `supabase/functions/api/tests/duplicatePostgres.test.js` (`FAB-3 SQL`) |
| RF19; HU-19; RNF20, RNF21 | Administrator-only active-group listing, creation and reversal; profile/environment/context checks | `supabase/functions/api/controllers/duplicateController.test.js` (`FAB-3 HTTP`); `FAB-3 SERVICE`; real RLS and grants in `FAB-3 SQL` |
| RF13, RF23; RNF30, RNF33 | Single active membership; canonical filtering; reversible candidate review with unchanged reports/photos; atomic audit | `supabase/functions/api/repositories/duplicateRepository.js`; `FAB-3 SQL` rollback, concurrency, anonymous/Association visibility and original-evidence assertions |

HTTP tests exercise the real Controller and Service together. SQL tests extend
that path through the real Repository and PostgreSQL/PostGIS under `app_backend`.
Authentication is injected only in tests; a real Administrator JWT and managed
Supabase deployment remained pending at L3 time (the server flow was later exercised
on staging with real sessions on 2026-10-01). L3 adds no UI (the duplicate screen is L6).

## FAB-4 / L4 threshold configuration screen

| Requirements / stories | Implemented boundary | Executable evidence |
|---|---|---|
| RF21, RF23; RNF09, RNF26–RNF31; HU-21, HU-23 | Eight numeric FAB-1 thresholds plus a new required change reason; exact ranges, precision and trust ordering | `models/configuration.test.js` checks parity with FAB-1 and field validation |
| RNF20, RNF21, RNF33 | Screen → hook → mobile API adapter → authenticated FAB-1; complete version publication without client-owned metadata | `services/configurationApi.test.js`; `services/configurationIntegration.test.js` with real FAB-1 Controller/Service and simulated session/storage |
| RNF20, RNF34; FAB-4 / L4 acceptance criteria | Per-field messages, loading/retry, 401/403, unsaved edits, guarded submission, stale-session responses | `tests/ui/configuration.spec.js` (`npm run test:configuration-ui`), mobile/desktop browser viewport verification |

`ConfigurationScreen` uses `useConfiguration`, `models/configuration.js` and
`services/configurationApi.js`; it never calls fetch or database tables directly.
The existing session layer supplies `App.accessToken`; no login provisioning,
server credential or live Administrator session is introduced by L4.

TD-92-eri-1-post-reports
Current report-intake coverage maps as follows:

| Test artifact | Covered IDs | Focus |
|---|---|---|
| `supabase/functions/api/controllers/reportController.test.js` | RF01, RF06, RF24, RNF12, RNF36, HU-01, HU-06, HU-24 | Public command parsing, raw fingerprint handoff, unknown-field rejection, dynamic details validation |
| `supabase/functions/api/services/reportService.test.js` | RF01, RNF09, RNF12, RNF26, HU-01 | Canonical idempotency hash, fingerprint-independent replay, replay short-circuit before geofence/rate/trust, server-time `client_created_at` window, hourly retry calculation |
| `supabase/functions/api/services/trustService.test.js` | RNF27, RNF28 | High-trust publication path and mandatory review for mock/imprecise location signals |

Temporary demo-only missing-geofence bypass coverage lives in
`supabase/functions/api/services/reportService.test.js`: default behavior still
fails closed before quota/trust/insert, the explicit non-production flag permits
photo-flow verification without an active zone, and an existing active geofence
still rejects outside points.

## FAB-5 / L5 zone-set screen

| Requirements / stories | Implemented boundary | Executable evidence |
|---|---|---|
| RNF09; approved decisions 5 and 17; L5 acceptance | File/paste input, WGS84 structural validation, normalized MultiPolygon SHA-256 and immutable draft metadata | `models/zoneSet.test.js` parity with FAB-2; `tests/ui/zoneSet.spec.js` file selection and stale-checksum prevention |
| RNF20, RNF21, RNF33 | Screen → hook → authenticated command adapter; creation and approval-gated activation are independent POSTs | `services/zoneSetApi.test.js` reaches real FAB-2 Controller/Service; browser assertion of exact separate payloads and prior active-zone preservation |
| RNF09, RNF33, RNF34 | No optimistic activation; exact field errors; blocked duplicate/uncertain submissions; session isolation; explicit navigation warning | 15 cases in `tests/ui/zoneSet.spec.js`, including GET-only activation reconciliation and revoked/changed sessions |

`ZoneSetScreen`, `useZoneSets`, `models/zoneSet.js`, `services/zoneSetApi.js`
and the native/web `zoneFile` adapters implement the client boundary. No table,
RLS, transaction or approval policy changes. `supabase/functions/api/routes/zoneSets.js` restores the
documented `/admin/zone-sets` URLs and retains `/admin/zoneSets` aliases with
identical guards. FAB-2 HTTP tests now assert the canonical URLs and auth on both
spellings. Real JWT, managed deployment and physical-device checks remain pending;
see `docs/TESTING.md` for exact simulated/compiled evidence and recovery limits.

## FAB-6 / L6 duplicate management screen

| Requirements / stories | Implemented boundary | Executable evidence |
|---|---|---|
| RF23; HU-23; RNF30 | Full eligible pending-candidate projection including visible reports; components and explicit canonical selection | `supabase/functions/api/controllers/duplicateController.test.js` (`FAB-6 HTTP`); `models/duplicateCandidate.test.js`; SQL candidate snapshot assertions in `supabase/functions/api/tests/duplicatePostgres.test.js` |
| RNF20, RNF21, RNF33 | Active Administrator only, local transaction context, existing RLS/grants, no private metadata | `supabase/functions/api/services/duplicateService.test.js` (`FAB-6 SERVICE`); real SQL projection denied to anonymous/Association actors |
| RF13, RF23; HU-23; RNF30, RNF33 | Connected selected subgraph checked before POST; server rechecks; reversal reopens candidates without touching originals or moderation | Exhaustive subset parity with FAB-3 in model tests; `services/duplicateApi.test.js`; real SQL resolve/reverse evidence and unchanged report/photo assertions |
| RNF34; L6 acceptance | Clear pre-submit graph warning, optional resolution reason, mandatory reversal reason, session isolation and uncertain-result recovery | `tests/ui/duplicateManagement.spec.js` (16 browser cases), plus L4/L5 regressions |

Implementation: `screens/DuplicateManagementScreen.js` →
`hooks/useDuplicateResolution.js` → `models/duplicateCandidate.js` /
`services/duplicateApi.js` → FAB-3. `App.js` uses the session integration now on
main and grants navigation through the Administrator moderation screen. No real
account, production resolution, migration or deployment is performed by tests.

## Matriz de verificación de Etapa 4 (T4 / TD-117)

Base auditada: main con T2 integrado (PR #56), 2026-10-08.
Esta sección da el estado de trazabilidad actual; las tablas previas conservan
contratos y contexto histórico, no son constancia de ejecución de esta etapa.
Los casos TC-TRAZA están definidos en `docs/testing/cases/trazabilidad.md`, con
entrada, resultado esperado y nombre exacto del test. «Disponible» significa que
existe el test, no que se haya acreditado el requerimiento completo en todos los
entornos. «Sin cubrir» identifica una brecha y su responsable por tarea.
Hay resultados manuales registrados en `docs/testing/ALPHA.md` (T7, RUN-83 a
RUN-116 y RUN-137), `docs/testing/UAT.md` (T8, RUN-124 a RUN-133),
`docs/testing/NON-FUNCTIONAL.md` (T9, RUN-134 a RUN-136) y
`docs/testing/ACCEPTANCE.md` (T14, por equivalencia con T7). Las notas «Evidencia
T7» de las filas (agregadas por T12, 2026-10-13) citan esas ejecuciones sin
reclasificar el estado ni las brechas «sin cubrir» anotadas, que la alfa puede
ejercer solo en parte (un Android 16, build development/debug, staging); T14 es
veredicto del equipo, no conformidad del socio. T5/T6 completan límites y combinaciones; T4 no los cierra.

### RF → casos → tests y brechas

Los casos `TC-REPORTE-*` corresponden a `docs/testing/cases/reportero.md` y
cierran la cobertura T5 con mínimo, máximo, promedio y excepción o justificación.

| ID | Caso(s) | Test(s) disponible(s) | Estado, límite de evidencia y tarea responsable |
|---|---|---|---|
| RF01 | TC-TRAZA-01, TC-TRAZA-02; TC-REPORTE-04, TC-REPORTE-05 | `hooks/reportDraftQueueController.test.js`; `supabase/functions/api/services/reportService.test.js`; `tests/ui/reportForm.spec.js` | Disponible; T5 cubre envío anónimo mínimo/promedio; durabilidad física/proceso muerto y modo avión se verifican en T7. Evidencia T7: TC-ALPHA-15, TC-ALPHA-16 y TC-ALPHA-17 (RUN-97 a RUN-99, pasó): modo avión, sincronización y cola tras cierre forzado |
| RF02 | TC-TRAZA-03; TC-REPORTE-03 | `supabase/functions/api/controllers/reportController.test.js`; `tests/ui/reportForm.spec.js` | Disponible; aviso RF02 visible en UI y sin campos de identidad; INC-2 cerrado: correctivo `f18ba0b`, verificado en Android real con `TC-ALPHA-14` en RUN-137; no persistencia incidental completa queda en T9 |
| RF03 | TC-TRAZA-04, TC-TRAZA-05, TC-TRAZA-06, TC-TRAZA-07; TC-REPORTE-02, TC-REPORTE-17, TC-REPORTE-18 | `supabase/functions/api/controllers/photoController.test.js`; `models/photoState.test.js`; `hooks/reportDraftQueueController.test.js`; `supabase/functions/api/services/photoService.test.js`; `tests/ui/reportForm.spec.js` | Disponible; T5 cubre ruta sin foto y payload/foto simulada; cámara/selección y carga nativa reales se validan en T7. Evidencia T7: TC-ALPHA-03 (RUN-85), TC-ALPHA-08 (RUN-90) y TC-ALPHA-13 (RUN-95), pasó: foto aceptada con cámara nativa, envío con foto y envío sin foto |
| RF04 | TC-TRAZA-08; TC-REPORTE-08 a TC-REPORTE-12 | `models/reportPayload.test.js` | Disponible; T5 cubre manada `1`, `2`, `500`, `1000`, `1001` |
| RF05 | TC-REPORTE-02 | `tests/ui/reportForm.spec.js` | Disponible; acceso rápido "Reportar sin foto" visible abre borrador sin foto |
| RF06 | TC-TRAZA-09; TC-REPORTE-13, TC-REPORTE-14 | `models/reportPayload.test.js`; `tests/ui/reportForm.spec.js` | Disponible; T5 cubre categorías y llaves condicionales válidas/extrañas |
| RF07 | TC-REPORTE-01 | `tests/ui/reportForm.spec.js` | Disponible; la ruta pública inicial de prueba abre cámara antes del formulario; cold start Android queda en T7. Evidencia T7: TC-ALPHA-01 (RUN-83, pasó): primera apertura en cámara con permiso |
| RF08 | TC-TRAZA-10, TC-TRAZA-51; TC-REPORTE-30 a TC-REPORTE-32 | `supabase/functions/api/services/flag-service.test.js`; `supabase/functions/api/tests/flag-postgres.test.js`; `tests/ui/publicMap.spec.js`; `services/flagApi.test.js`; `models/reportFlag.test.js` | Disponible; T5 documenta detalle público, diversidad y error de denuncia; concurrencia SQL de cuotas queda limitada a la suite opt-in |
| RF09 | TC-TRAZA-11, TC-TRAZA-12; TC-REPORTE-19, TC-REPORTE-20 | `services/photoInference.test.js`; evidencia T7 `docs/testing/ALPHA.md` | Disponible con datos simulados; modelo real y calidad offline se cierran con evidencia T7 en dispositivo. Evidencia T7: TC-ALPHA-03 a TC-ALPHA-06 (RUN-85 a RUN-88, pasó): foto aceptada, sin perro, borrosa y validación en modo avión |
| RF10 | TC-TRAZA-13, TC-TRAZA-52 | `supabase/functions/api/repositories/publicMapRepository.test.js`; `supabase/functions/api/tests/publicMapPostgres.test.js` | Disponible; sin cubrir: render nativo y versión staging de entrega (T6/T7); SQL aislado disponible. Evidencia T7: TC-ALPHA-18 (RUN-100) y TC-ALPHA-20 (RUN-102), pasó: mapa nativo con clusters, pines y detalle con ubicación aproximada en build development/debug |
| RF11 | TC-TRAZA-14, TC-TRAZA-52 | `supabase/functions/api/repositories/publicMapRepository.test.js`; `supabase/functions/api/tests/publicMapPostgres.test.js` | Disponible; sin cubrir: mapa nativo en teléfono (T7); SQL aislado disponible. Evidencia T7: TC-ALPHA-18 (RUN-100, pasó): clusters y pines al acercar en Android |
| RF12 | TC-TRAZA-15, TC-MAPA-05 a TC-MAPA-08 | `models/publicMap.test.js`; `tests/ui/publicMapClusterSize.spec.js` | Disponible; T6 mide el marcador en UI con MapLibre sustituido; sin cubrir: dibujo sobre el mapa nativo en teléfono (T7) |
| RF13 | TC-TRAZA-16, TC-TRAZA-52 | `tests/ui/publicMap.spec.js`; `supabase/functions/api/tests/publicMapPostgres.test.js` | Disponible; Caso UI con HTTP simulado; T6 añade SQL/canónicos |
| RF14 | TC-TRAZA-17, TC-TRAZA-52 | `models/publicMap.test.js`; `supabase/functions/api/tests/publicMapPostgres.test.js` | Disponible; Caso de modelo; T6/T7 verifican interacción y mapa nativo. Evidencia T7: TC-ALPHA-18 (RUN-100) y TC-ALPHA-20 (RUN-102), pasó: zoom a pines y detalle en Android |
| RF15 | TC-TRAZA-18 | `controllers/loginController.test.js` | Disponible; sin cubrir: múltiples cuentas provisionadas y SecureStore real (T6/T7). Evidencia T7: TC-ALPHA-24 (RUN-106) y TC-ALPHA-33 (RUN-115), pasó: login inválido/válido de Asociación y cierre de sesión |
| RF16 | TC-TRAZA-19 | `supabase/functions/api/repositories/associationReportRepository.test.js` | Disponible; sin cubrir: proyección SQL ejecutada y aceptación de estadísticas (T6/T14). Evidencia T7: TC-ALPHA-25 y TC-ALPHA-26 (RUN-107 y RUN-108, pasó): panel de 7 días, rangos vacíos y fechas inválidas en staging |
| RF17 | TC-TRAZA-20, TC-TRAZA-21 | `models/associationReport.test.js`; `models/associationWorkbook.test.js` | Disponible; sin cubrir: compartir nativo y conformidad del socio (T7/T14). Evidencia T7: TC-ALPHA-27 (RUN-109, pasó): exportación CSV/XLSX en Android; la conformidad del socio no se obtuvo |
| RF18 | TC-TRAZA-22, TC-TRAZA-37 | `controllers/loginController.test.js`; `supabase/functions/api/services/associationService.test.js` | Disponible; sin cubrir: sesión JWT desplegada/rol en la versión de entrega (T6/T7). Evidencia T7: TC-ALPHA-28 (RUN-110, pasó): Administrator abre Command Center en build development/debug |
| RF19 | TC-TRAZA-23, TC-TRAZA-24, TC-MODERACION-01 a TC-MODERACION-09 | `services/moderationApi.test.js`; `models/moderation.test.js`; `supabase/functions/api/services/moderationService.test.js`; `tests/ui/commandCenter.spec.js` | Disponible; sin cubrir: contexto de actor y orden SQL reales de la cola (sin suite PostgreSQL); autorización en Service corregida (INC-1). Evidencia T7: TC-ALPHA-29 (RUN-111, pasó): comandos de moderación con motivo en staging |
| RF20 | TC-TRAZA-25, TC-TRAZA-26, TC-TRAZA-27, TC-TRAZA-28 | `supabase/functions/api/domain/reportModeration.test.js`; `supabase/functions/api/controllers/moderationController.test.js`; `services/moderationApi.test.js`; `models/moderation.test.js` | Disponible; sin cubrir: auditoría/transacción SQL de moderación y UI Command Center (T6). Evidencia T7: TC-ALPHA-29 (RUN-111, pasó): comandos de moderación con motivo en staging |
| RF21 | TC-TRAZA-29, TC-TRAZA-51 | `supabase/functions/api/services/flag-service.test.js`; `supabase/functions/api/tests/flag-postgres.test.js` | Disponible; sin cubrir: flujo UI completo de revisión/restore (T6); SQL auto-hide disponible |
| RF22 | TC-TRAZA-30, TC-TRAZA-31; TC-REPORTE-21, TC-REPORTE-22 | `models/dogColor.test.js`; `models/reportPayload.test.js`; `tests/ui/reportForm.spec.js`; evidencia T7 `docs/testing/ALPHA.md` | Disponible con extracción simulada y override manual; color con fotos reales queda enlazado a evidencia T7. Evidencia T7: TC-ALPHA-07 (RUN-89, pasó): color sugerido y editable con fotos reales |
| RF23 | TC-TRAZA-32, TC-TRAZA-33, TC-TRAZA-34, TC-TRAZA-50 | `models/duplicateCandidate.test.js`; `supabase/functions/api/services/duplicateService.test.js`; `tests/ui/duplicateManagement.spec.js`; `supabase/functions/api/tests/duplicatePostgres.test.js` | Disponible; sin cubrir: candidatos SQL reales/actores de staging; T6 amplía límites. Evidencia T7: TC-ALPHA-30 (RUN-112, pasó): duplicados resueltos y revertidos sin borrar originales en staging |
| RF24 | TC-TRAZA-09, TC-TRAZA-35; TC-REPORTE-13 a TC-REPORTE-16 | `models/reportPayload.test.js`; `supabase/functions/api/controllers/reportController.test.js`; `supabase/functions/api/tests/reportPostgres.test.js` | Disponible; T5 agrega suite PostgreSQL real para `details`; ejecución local requiere Docker o `REPORT_TEST_DATABASE_URL`; ejecutada con Docker/PostGIS en RUN-138 (pasó) |

### RNF → casos → tests y brechas

| ID | Caso(s) | Test(s) disponible(s) | Estado, límite de evidencia y tarea responsable |
|---|---|---|---|
| RNF01 | — | Sin test/evidencia; pendiente de la tarea indicada | sin cubrir: estado/operación Free y evidencia de mejor esfuerzo; 99.9% es meta futura (T9) |
| RNF02 | — | Sin test/evidencia; pendiente de la tarea indicada | sin cubrir: medición mapa <5 s en teléfono con carga objetivo (T9) |
| RNF03 | TC-TRAZA-14 | `supabase/functions/api/repositories/publicMapRepository.test.js` | Disponible; sin cubrir: carga/p95 y crecimiento; consulta SQL solo inspeccionada por test (T9). Evidencia: TC-NF-03 RUN-145 (k6, staging real, 2 VUs/60 s, 0 % errores, p95 1.07 s); no cubre alta concurrencia ni crecimiento |
| RNF04 | TC-UAT-01; docs/testing/cases/uat.md | `docs/testing/UAT.md`; `RUN-124`, `RUN-125`, `RUN-127` en `docs/testing/TEST_LOG.md` | Cubierto: tres participantes anónimos con consentimiento, reporte <300 s, encuesta y hallazgos. T8 conserva observación de usabilidad de mapa en `INC-3`. |
| RNF05 | TC-ALPHA-01 | Sin test automatizado; evidencia manual T7 en `docs/testing/ALPHA.md` | sin cubrir: Android 8+/iOS 13+ en builds reales; justificar plataforma ausente (T9). Evidencia T7: Android 16 real (samsung SM-S918B) en RUN-83 a RUN-116 y RUN-137; Android 8 mínimo e iOS siguen sin evidencia |
| RNF06 | TC-TRAZA-36 | `i18n/locales.test.js` | Disponible; sin cubrir: todas las pantallas y accesibilidad es/en; claves iguales no prueban traducción (T9) |
| RNF07 | TC-TRAZA-37, TC-TRAZA-18, TC-TRAZA-22 | `supabase/functions/api/services/associationService.test.js`; `controllers/loginController.test.js` | Disponible; Casos de roles simulados; T6 verifica provisión manual y ausencia de signup |
| RNF08 | TC-TRAZA-11, TC-TRAZA-12; TC-REPORTE-19, TC-REPORTE-20 | `services/photoInference.test.js`; evidencia T7 `docs/testing/ALPHA.md` | Disponible con datos simulados; modelo real on-device y versión del artefacto se comprueban con T7. Evidencia T7: TC-ALPHA-06 (RUN-88, pasó): validación del modelo en modo avión en Android |
| RNF09 | TC-TRAZA-38, TC-TRAZA-02, TC-TRAZA-39, TC-TRAZA-48, TC-TRAZA-49; TC-REPORTE-25, TC-REPORTE-26 | `supabase/functions/api/services/reportService.test.js`; `services/zoneSetApi.test.js`; `supabase/functions/api/tests/configurationPostgres.test.js`; `supabase/functions/api/tests/zonePostgres.test.js` | Disponible; T5 cubre rechazo fuera de zona con datos simulados; geometría oficial y aprobación externa permanecen fuera del alcance |
| RNF10 | TC-TRAZA-07, TC-TRAZA-11; TC-REPORTE-23 | `supabase/functions/api/services/photoService.test.js`; `services/photoInference.test.js` | Disponible; T5 confirma que EXIF crudo/metadatos fuente no se persisten; offline físico queda en T7 |
| RNF11 | TC-TRAZA-31, TC-TRAZA-30; TC-REPORTE-13, TC-REPORTE-14 | `models/reportPayload.test.js`; `models/dogColor.test.js`; `tests/ui/reportForm.spec.js` | Disponible; T5 valida persistencia estructurada, color detectado/manual y llaves dinámicas |
| RNF12 | TC-TRAZA-01, TC-TRAZA-02, TC-TRAZA-06; TC-REPORTE-05 a TC-REPORTE-07 | `hooks/reportDraftQueueController.test.js`; `supabase/functions/api/services/reportService.test.js`; `tests/ui/reportForm.spec.js`; evidencia T7 `docs/testing/ALPHA.md` | Disponible con lógica simulada; reinicio/muerte de proceso, modo avión y sincronización real se cierran con T7. Evidencia T7: TC-ALPHA-15 a TC-ALPHA-17 (RUN-97 a RUN-99, pasó): cola en modo avión, sincronización sin duplicado y cola tras cierre forzado |
| RNF13 | TC-TRAZA-03, TC-TRAZA-19 | `supabase/functions/api/controllers/reportController.test.js`; `supabase/functions/api/repositories/associationReportRepository.test.js` | Disponible; sin cubrir: minimización completa, contenido incidental y revisión de privacidad (T9) |
| RNF14 | — | Sin test/evidencia; pendiente de la tarea indicada | sin cubrir: dumps, manifiesto y restauración; no acreditar RPO/RTO productivos (T9) |
| RNF15 | — | Sin test/evidencia; pendiente de la tarea indicada | sin cubrir: inspección del proyecto administrado/plan vigente (T9) |
| RNF16 | — | Sin test/evidencia; pendiente de la tarea indicada | sin cubrir: smoke HTTPS/TLS del despliegue (T9) |
| RNF17 | — | Sin test/evidencia; pendiente de la tarea indicada | sin cubrir: inspección de accesos técnicos y ausencia SSH/VPS (T9) |
| RNF18 | — | Sin test/evidencia; pendiente de la tarea indicada | sin cubrir: ensayo restauración aislada de DB y bytes privados con checksums (T9) |
| RNF19 | TC-TRAZA-14, TC-TRAZA-48, TC-TRAZA-49, TC-TRAZA-50, TC-TRAZA-51, TC-TRAZA-52 | `supabase/functions/api/repositories/publicMapRepository.test.js`; `supabase/functions/api/tests/configurationPostgres.test.js`; `supabase/functions/api/tests/zonePostgres.test.js`; `supabase/functions/api/tests/duplicatePostgres.test.js`; `supabase/functions/api/tests/flag-postgres.test.js`; `supabase/functions/api/tests/publicMapPostgres.test.js` | Disponible; SQL local aislado disponible; sin cubrir: catálogos del proyecto Supabase vigente (T9) |
| RNF20 | TC-TRAZA-37, TC-TRAZA-47, TC-TRAZA-48, TC-TRAZA-49, TC-TRAZA-50, TC-TRAZA-51 | `supabase/functions/api/services/associationService.test.js`; `supabase/functions/api/tests/identityConfiguration.test.js`; `supabase/functions/api/tests/configurationPostgres.test.js`; `supabase/functions/api/tests/zonePostgres.test.js`; `supabase/functions/api/tests/duplicatePostgres.test.js`; `supabase/functions/api/tests/flag-postgres.test.js` | Disponible; SQL RLS/grants local disponible; sin cubrir: firmas JWT y políticas del proyecto desplegado (T9) |
| RNF21 | TC-TRAZA-23, TC-TRAZA-39, TC-TRAZA-40, TC-TRAZA-48, TC-TRAZA-49 | `services/moderationApi.test.js`; `services/zoneSetApi.test.js`; `supabase/functions/api/services/configurationService.test.js`; `supabase/functions/api/tests/configurationPostgres.test.js`; `supabase/functions/api/tests/zonePostgres.test.js` | Disponible; sin cubrir: inspección de todas las capas y JWT real; casos integran dependencias simuladas (T9) |
| RNF22 | — | Sin test/evidencia; pendiente de la tarea indicada | sin cubrir: inspección gateway/Edge/TLS administrados (T9) |
| RNF23 | — | Sin test/evidencia; pendiente de la tarea indicada | sin cubrir: inspección de frontera y no acceso móvil directo a dominio (T9) |
| RNF24 | — | Sin test/evidencia; pendiente de la tarea indicada | sin cubrir: escaneo bundle/repo/respuestas de secretos con evidencia compartida (T9) |
| RNF25 | — | Sin test/evidencia; pendiente de la tarea indicada | sin cubrir: monitor y readiness de cuotas, scheduler y exportaciones (T9) |
| RNF26 | TC-TRAZA-43, TC-TRAZA-41 | `supabase/functions/api/services/reportService.test.js`; `supabase/functions/api/services/retentionService.test.js` | Disponible; sin cubrir: hash server/retención 30 días en SQL y entorno real (T9) |
| RNF27 | TC-TRAZA-31, TC-TRAZA-42; TC-REPORTE-27 | `models/reportPayload.test.js`; `supabase/functions/api/services/trustService.test.js`; `tests/ui/reportForm.spec.js` | Disponible; T5 cubre honeypot como señal de integridad sin descartar automáticamente |
| RNF28 | TC-TRAZA-42; TC-REPORTE-28, TC-REPORTE-29 | `supabase/functions/api/services/trustService.test.js` | Disponible; T5 documenta evaluación con y sin foto y umbrales de confianza |
| RNF29 | TC-TRAZA-10, TC-TRAZA-29, TC-TRAZA-51; TC-REPORTE-30 a TC-REPORTE-32 | `supabase/functions/api/services/flag-service.test.js`; `supabase/functions/api/tests/flag-postgres.test.js`; `tests/ui/publicMap.spec.js`; `services/flagApi.test.js`; `models/reportFlag.test.js` | Disponible; Service/UI y SQL aislado cubren unicidad/diversidad; abuso concurrente amplio queda limitado a PostgreSQL opt-in |
| RNF30 | TC-TRAZA-32, TC-TRAZA-34, TC-TRAZA-50 | `models/duplicateCandidate.test.js`; `tests/ui/duplicateManagement.spec.js`; `supabase/functions/api/tests/duplicatePostgres.test.js` | Disponible; Modelo/UI y SQL aislado disponibles; sin cubrir: aceptación staging/dispositivo (T6/T7). Evidencia T7: TC-ALPHA-30 (RUN-112, pasó): duplicados en staging desde Android |
| RNF31 | TC-TRAZA-44, TC-TRAZA-02 | `supabase/functions/api/services/flag-service.test.js`; `supabase/functions/api/services/reportService.test.js` | Disponible; sin cubrir: límites SQL concurrentes/reportes/imagen/sesión (T9) |
| RNF32 | TC-TRAZA-07, TC-TRAZA-45; TC-REPORTE-24 | `supabase/functions/api/services/photoService.test.js`; `supabase/functions/api/controllers/photoController.test.js` | Disponible; T5 cubre respuesta pública `415 unsupported_photo_type`; HEIC/orientación nativos y metadata real Storage quedan para T9 |
| RNF33 | TC-TRAZA-40, TC-TRAZA-33, TC-TRAZA-48, TC-TRAZA-49, TC-TRAZA-50, TC-TRAZA-51 | `supabase/functions/api/services/configurationService.test.js`; `supabase/functions/api/services/duplicateService.test.js`; `supabase/functions/api/tests/configurationPostgres.test.js`; `supabase/functions/api/tests/zonePostgres.test.js`; `supabase/functions/api/tests/duplicatePostgres.test.js`; `supabase/functions/api/tests/flag-postgres.test.js` | Disponible; SQL configuración/zonas/duplicados/flags disponible; sin cubrir: moderación standalone y todos los comandos (T6) |
| RNF34 | TC-TRAZA-46, TC-TRAZA-47 | `controllers/loginController.test.js`; `supabase/functions/api/tests/identityConfiguration.test.js` | Disponible; sin cubrir: verificación firma/claims JWT real, SecureStore y logout nativo (T9) |
| RNF35 | — | Sin test/evidencia; pendiente de la tarea indicada | sin cubrir: inspección schema/migraciones que excluya embeddings; mejora fuera de Fase 1 (T9) |
| RNF36 | TC-TRAZA-35; TC-REPORTE-15, TC-REPORTE-16 | `supabase/functions/api/controllers/reportController.test.js`; `supabase/functions/api/tests/reportPostgres.test.js` | Disponible; suite PostgreSQL real agregada para `details`, con ejecución local bloqueada si Docker/`REPORT_TEST_DATABASE_URL` no está disponible (RUN-123); ejecutada con Docker/PostGIS en RUN-138 (pasó) |

### HU → valor para cliente/negocio → casos → tests

Las HU comparten casos con su RF correspondiente, conservando relaciones con RNF
y aclaraciones de las tablas contractuales anteriores. La visión del cliente se
valida en T14 con el socio, además de las pruebas del equipo; su conformidad no
se deduce de un test simulado.

| ID | RF principal | Valor que valida para el cliente/negocio | Caso(s) | Test(s) disponible(s) | Estado y brecha |
|---|---|---|---|---|---|
| HU-01 | RF01 | Reportero público: actuar sin cuenta y capturar sin red para sincronizar después | TC-TRAZA-01, TC-TRAZA-02; TC-REPORTE-04, TC-REPORTE-05 | `hooks/reportDraftQueueController.test.js`; `supabase/functions/api/services/reportService.test.js`; `tests/ui/reportForm.spec.js` | Disponible; lógica T5 cubierta; durabilidad física/proceso muerto y modo avión en T7. Evidencia T7: TC-ALPHA-15, TC-ALPHA-16 y TC-ALPHA-17 (RUN-97 a RUN-99, pasó): modo avión, sincronización y cola tras cierre forzado |
| HU-02 | RF02 | Reportero público: reducir exposición de datos personales | TC-TRAZA-03; TC-REPORTE-03 | `supabase/functions/api/controllers/reportController.test.js`; `tests/ui/reportForm.spec.js` | Disponible; aviso RF02 visible y sin campos de identidad; INC-2 cerrado: correctivo `f18ba0b`, verificado en Android real con `TC-ALPHA-14` en RUN-137 |
| HU-03 | RF03 | Reportero público y Asociación: evidencia opcional sin bloquear el reporte | TC-TRAZA-04, TC-TRAZA-05, TC-TRAZA-06, TC-TRAZA-07; TC-REPORTE-02, TC-REPORTE-17, TC-REPORTE-18 | `supabase/functions/api/controllers/photoController.test.js`; `models/photoState.test.js`; `hooks/reportDraftQueueController.test.js`; `supabase/functions/api/services/photoService.test.js`; `tests/ui/reportForm.spec.js` | Disponible; T5 cubre sin foto y simulación; cámara/selección nativa queda en T7. Evidencia T7: TC-ALPHA-03 (RUN-85), TC-ALPHA-08 (RUN-90) y TC-ALPHA-13 (RUN-95), pasó: foto aceptada con cámara nativa, envío con foto y envío sin foto |
| HU-04 | RF04 | Reportero público y Asociación: describir cantidad y riesgo de manada | TC-TRAZA-08; TC-REPORTE-08 a TC-REPORTE-12 | `models/reportPayload.test.js` | Disponible; T5 cubre 1, 2, 500, 1000 y 1001 |
| HU-05 | RF05 | Reportero público: reportar rápido aun sin fotografía | TC-REPORTE-02 | `tests/ui/reportForm.spec.js` | Disponible; acceso rápido sin foto abre borrador sin foto |
| HU-06 | RF06 | Reportero público y Asociación: clasificar el riesgo para priorizar decisiones | TC-TRAZA-09; TC-REPORTE-13, TC-REPORTE-14 | `models/reportPayload.test.js`; `tests/ui/reportForm.spec.js` | Disponible; T5 cubre categorías y llaves condicionales |
| HU-07 | RF07 | Reportero público: capturar el momento desde la primera pantalla | TC-REPORTE-01 | `tests/ui/reportForm.spec.js` | Disponible; cámara es pantalla inicial en fixture; cold start Android queda en T7. Evidencia T7: TC-ALPHA-01 (RUN-83, pasó): primera apertura en cámara con permiso |
| HU-08 | RF08 | Reportero público y Administrator: advertir contenido problemático sin destruir evidencia | TC-TRAZA-10, TC-TRAZA-51; TC-REPORTE-30 a TC-REPORTE-32 | `supabase/functions/api/services/flag-service.test.js`; `supabase/functions/api/tests/flag-postgres.test.js`; `tests/ui/publicMap.spec.js`; `services/flagApi.test.js`; `models/reportFlag.test.js` | Disponible; T5 agrega detalle público, diversidad y errores de denuncia |
| HU-09 | RF09 | Reportero público: repetir fotos inválidas con explicación incluso offline | TC-TRAZA-11, TC-TRAZA-12; TC-REPORTE-19, TC-REPORTE-20 | `services/photoInference.test.js`; evidencia T7 `docs/testing/ALPHA.md` | Disponible con datos simulados; fotos reales y offline en dispositivo se enlazan a T7. Evidencia T7: TC-ALPHA-03 a TC-ALPHA-06 (RUN-85 a RUN-88, pasó): foto aceptada, sin perro, borrosa y validación en modo avión |
| HU-10 | RF10 | Reportero público: ubicar riesgos sin exponer coordenadas exactas | TC-TRAZA-13, TC-TRAZA-52 | `supabase/functions/api/repositories/publicMapRepository.test.js`; `supabase/functions/api/tests/publicMapPostgres.test.js` | Disponible; sin cubrir: render nativo y versión staging de entrega (T6/T7); SQL aislado disponible. Evidencia T7: TC-ALPHA-18 (RUN-100) y TC-ALPHA-20 (RUN-102), pasó: mapa nativo con clusters, pines y detalle con ubicación aproximada en build development/debug |
| HU-11 | RF11 | Reportero público: leer zonas densas sin saturar el mapa | TC-TRAZA-14, TC-TRAZA-52 | `supabase/functions/api/repositories/publicMapRepository.test.js`; `supabase/functions/api/tests/publicMapPostgres.test.js` | Disponible; sin cubrir: mapa nativo en teléfono (T7); SQL aislado disponible. Evidencia T7: TC-ALPHA-18 (RUN-100, pasó): clusters y pines al acercar en Android |
| HU-12 | RF12 | Reportero público: percibir densidad a partir del tamaño del cluster | TC-TRAZA-15, TC-MAPA-05 a TC-MAPA-08 | `models/publicMap.test.js`; `tests/ui/publicMapClusterSize.spec.js` | Disponible; sin cubrir: dibujo sobre el mapa nativo en teléfono (T7) |
| HU-13 | RF13 | Reportero público y Asociación: distinguir severidad y desglose por incidente | TC-TRAZA-16, TC-TRAZA-52 | `tests/ui/publicMap.spec.js`; `supabase/functions/api/tests/publicMapPostgres.test.js` | Disponible; Caso UI con HTTP simulado; T6 añade SQL/canónicos |
| HU-14 | RF14 | Reportero público: pasar de panorama a detalle con el zoom | TC-TRAZA-17, TC-TRAZA-52 | `models/publicMap.test.js`; `supabase/functions/api/tests/publicMapPostgres.test.js` | Disponible; Caso de modelo; T6/T7 verifican interacción y mapa nativo. Evidencia T7: TC-ALPHA-18 (RUN-100) y TC-ALPHA-20 (RUN-102), pasó: zoom a pines y detalle en Android |
| HU-15 | RF15 | Asociación de Hoteles de Chihuahua: funciones exclusivas con atribución individual | TC-TRAZA-18 | `controllers/loginController.test.js` | Disponible; sin cubrir: múltiples cuentas provisionadas y SecureStore real (T6/T7). Evidencia T7: TC-ALPHA-24 (RUN-106) y TC-ALPHA-33 (RUN-115), pasó: login inválido/válido de Asociación y cierre de sesión |
| HU-16 | RF16 | Asociación de Hoteles de Chihuahua: decisiones con estadísticas de datos aceptados canónicos | TC-TRAZA-19 | `supabase/functions/api/repositories/associationReportRepository.test.js` | Disponible; sin cubrir: proyección SQL ejecutada y aceptación de estadísticas (T6/T14). Evidencia T7: TC-ALPHA-25 y TC-ALPHA-26 (RUN-107 y RUN-108, pasó): panel de 7 días, rangos vacíos y fechas inválidas en staging |
| HU-17 | RF17 | Asociación de Hoteles de Chihuahua: compartir exactamente la proyección autorizada | TC-TRAZA-20, TC-TRAZA-21 | `models/associationReport.test.js`; `models/associationWorkbook.test.js` | Disponible; sin cubrir: compartir nativo y conformidad del socio (T7/T14). Evidencia T7: TC-ALPHA-27 (RUN-109, pasó): exportación CSV/XLSX en Android; la conformidad del socio no se obtuvo |
| HU-18 | RF18 | Administrator: moderar con identidad validada y permisos propios | TC-TRAZA-22, TC-TRAZA-37 | `controllers/loginController.test.js`; `supabase/functions/api/services/associationService.test.js` | Disponible; sin cubrir: sesión JWT desplegada/rol en la versión de entrega (T6/T7). Evidencia T7: TC-ALPHA-28 (RUN-110, pasó): Administrator abre Command Center en build development/debug |
| HU-19 | RF19 | Administrator: revisar contexto completo sin recibir BI exclusivo de Asociación | TC-TRAZA-23, TC-TRAZA-24, TC-MODERACION-01 a TC-MODERACION-09 | `services/moderationApi.test.js`; `models/moderation.test.js`; `supabase/functions/api/services/moderationService.test.js`; `tests/ui/commandCenter.spec.js` | Disponible; sin cubrir: contexto de actor y SQL real de la cola; autorización en Service corregida (INC-1). Evidencia T7: TC-ALPHA-29 (RUN-111, pasó): comandos de moderación con motivo en staging |
| HU-20 | RF20 | Administrator: preservar calidad mediante ocultación/eliminación reversibles y auditadas | TC-TRAZA-25, TC-TRAZA-26, TC-TRAZA-27, TC-TRAZA-28 | `supabase/functions/api/domain/reportModeration.test.js`; `supabase/functions/api/controllers/moderationController.test.js`; `services/moderationApi.test.js`; `models/moderation.test.js` | Disponible; sin cubrir: auditoría/transacción SQL de moderación y UI Command Center (T6). Evidencia T7: TC-ALPHA-29 (RUN-111, pasó): comandos de moderación con motivo en staging |
| HU-21 | RF21 | Administrator: revisar auto-ocultamientos y restaurar datos tras denuncias diversas | TC-TRAZA-29, TC-TRAZA-51 | `supabase/functions/api/services/flag-service.test.js`; `supabase/functions/api/tests/flag-postgres.test.js` | Disponible; sin cubrir: flujo UI completo de revisión/restore (T6); SQL auto-hide disponible |
| HU-22 | RF22 | Reportero público y Asociación: obtener atributos con poco esfuerzo y sin identificar individuos | TC-TRAZA-30, TC-TRAZA-31; TC-REPORTE-21, TC-REPORTE-22 | `models/dogColor.test.js`; `models/reportPayload.test.js`; `tests/ui/reportForm.spec.js`; evidencia T7 `docs/testing/ALPHA.md` | Disponible con extracción simulada y override; fotos reales quedan en T7. Evidencia T7: TC-ALPHA-07 (RUN-89, pasó): color sugerido y editable con fotos reales |
| HU-23 | RF23 | Administrator y Asociación: evitar doble conteo con decisión humana canónica reversible | TC-TRAZA-32, TC-TRAZA-33, TC-TRAZA-34, TC-TRAZA-50 | `models/duplicateCandidate.test.js`; `supabase/functions/api/services/duplicateService.test.js`; `tests/ui/duplicateManagement.spec.js`; `supabase/functions/api/tests/duplicatePostgres.test.js` | Disponible; sin cubrir: candidatos SQL reales/actores de staging; T6 amplía límites. Evidencia T7: TC-ALPHA-30 (RUN-112, pasó): duplicados resueltos y revertidos sin borrar originales en staging |
| HU-24 | RF24 | Reportero público: responder solo preguntas pertinentes para completar con rapidez | TC-TRAZA-09, TC-TRAZA-35; TC-REPORTE-13 a TC-REPORTE-16 | `models/reportPayload.test.js`; `supabase/functions/api/controllers/reportController.test.js`; `supabase/functions/api/tests/reportPostgres.test.js` | Disponible; T5 agrega trigger PostgreSQL real para `details`; ejecución requiere Docker/`REPORT_TEST_DATABASE_URL` |

### Comprobación automática

PR de T4: [#57](https://github.com/CardozoPapaDelAme/dog_report_app/pull/57).
La corrida de ese PR aporta verificación automática; no sustituye resultados
de alfa, usuarios, no funcionales ni aceptación.

`scripts/check-doc-paths.mjs` comprueba las citas de archivo de este documento y
los archivos de texto de `docs/testing/` recursivamente. Solo se excluye
`docs/testing/BACKLOG.md`, porque conserva citas incorrectas deliberadas. Enlaces
externos, contratos HTTP/campos y parámetros de plantilla no son rutas concretas;
las citas concretas (incluidos ejemplos) deben existir y estar desde la raíz.

npm run test:docs ejecuta la comprobación sola; npm test la ejecuta como suite docs
antes de Deno/node:test/Playwright mediante `scripts/test-all.mjs`. El workflow
`.github/workflows/tests.yml` ya ejecuta npm test en PR/main desde T2.
`scripts/check-doc-paths.test.js` prueba detección de rutas inválidas, ejemplos,
links, documentos anidados y la exclusión exacta del backlog. El fallo imprime
archivo, línea y cita, y devuelve un código distinto de cero.

RF03 incorpora controller/Service de foto, estado terminal y cola report-first.
RF19 incorpora adaptador de cola y modelo de resumen; T6 agrega
`supabase/functions/api/services/moderationService.test.js` (ruta, controlador,
repositorio y presentador de la cola sin base de datos) y
`tests/ui/commandCenter.spec.js` (Command Center con HTTP interceptado). Casos en
`docs/testing/cases/mapa-y-roles.md`.
RF20 incorpora dominio/transiciones, parser de nota, adaptador hide/restore y
actualización de cola; estos tests no demuestran auditoría SQL de moderación.
