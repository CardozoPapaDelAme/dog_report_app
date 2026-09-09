# Requirements Traceability Matrix

This document exclusively owns the complete historical SRS → normative SRS v2 →
HTTP/data → verification mapping. Every row preserves the same exact identifier
in [`product/ETAPA1-REQUERIMIENTOS.md`](product/ETAPA1-REQUERIMIENTOS.md) and
[`product/ETAPA1-REQUERIMIENTOS-V2.md`](product/ETAPA1-REQUERIMIENTOS-V2.md).
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
| RF08 | Public report detail | `POST /reports/:report_id/flags`; FlagService; `report_flags` | One effective flag per fingerprint/report; durable limit |
| RF09 | On-device vision | Bundled TFLite model | Dog/quality failures and retry offline |
| RF10 | Online public map | `GET /public/reports`; presenter/repository | Approximate recent visible canonical pins |
| RF11 | Map clustering | `GET /public/clusters`; PostGIS repository query | Metric grouping at supported zooms; documented viewport/limit |
| RF12 | Cluster renderer | `report_count` | Circle size follows count |
| RF13 | Cluster renderer | `highest_severity`; `type_counts` | Highest severity and all six type keys, zeros included |
| RF14 | Map interaction | Fixed zoom-to-radius repository contract | Progressive expansion to pins |
| RF15 | Asociación de Hoteles de Chihuahua login | Auth JWT + `GET /me` + profile/role agreement | Multiple provisioned accounts; no signup |
| RF16 | Asociación de Hoteles de Chihuahua dashboard | `GET /association/reports` | Accepted canonical business data only |
| RF17 | Asociación de Hoteles de Chihuahua export | Same paginated role route/view | CSV/Excel parity and authorization |
| RF18 | Administrator login | Auth JWT + `GET /me` + profile/role agreement | Provisioned account; no signup |
| RF19 | Administrator Command Center and moderation queue | `GET /admin/moderation-queue`; `CommandCenterScreen`; `useModerationQueue` | Original fields, GPS/mock, photo expectation, component trust; page-scoped responsive ES/EN summary; no aggregate/BI endpoint |
| RF20 | Administrator moderation commands | Report command routes; generic mobile command client | Approve/delete update the queue projection; no direct mobile database update; audited reversible deletion |
| RF21 | Flag review/state machine | FlagService + restore/approve routes | Threshold, audit, restore semantics |
| RF22 | On-device attributes | Structured report columns | Color automatic; size/collar manual |
| RF23 | Duplicate review | Administrator duplicate routes; candidates/groups/memberships | Human-only, pending connected set, canonical, reversible, audited |
| RF24 | Dynamic form | `details` JSONB validator | Allowed keys/types per incident |

## Non-functional requirements

| ID | Flow/component | Data/API/operations boundary | Verification focus |
|---|---|---|---|
| RNF01 | Availability posture | Managed Free best effort; future 99.9% target | No current SLA/PITR claim; pause/readiness check |
| RNF02 | Public map | Bounded queries, indexes, pagination | <5 s target under prototype load |
| RNF03 | API/database | Bounded Hono queries, spatial/time indexes | Load test growth profile |
| RNF04 | Report UX | Camera-first dynamic form | Usability session under 5 min |
| RNF05 | Mobile app | Expo development builds, iOS/Android | Supported-device smoke tests |
| RNF06 | Localization | `react-i18next`; all role flows | ES/EN coverage and layout |
| RNF07 | Auth/navigation | Two sibling roles; profile checks | No public signup or role inheritance |
| RNF08 | On-device vision | `react-native-fast-tflite`; MobileNetV3-Small INT8 | Runs offline in development/release build |
| RNF09 | Location validation | Versioned zones; ReportService + PostGIS repository | New points outside rejected; identical replay still accepted; mock/imprecise reviewed |
| RNF10 | Photo validation | On-device model; transient EXIF signals | Offline inference; no raw EXIF persistence |
| RNF11 | Dog attributes | Structured columns and duplicate signals | Offline color extraction; no identity claim |
| RNF12 | Offline sync | Expo SQLite + local file + Hono receipts/status | Crash-safe idempotent sync; purge states stop upload retry |
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
| HU-08 | RF08, RF21, RNF29 | Public detail/flagging | Hono flag route | Warning, durable limit, auto-hide behavior |
| HU-09 | RF09, RNF08, RNF10 | On-device vision | Bundled TFLite model | Offline retake reasons |
| HU-10 | RF10, RNF13 | Online map | Public reports route/view | Approximate visible pins/offline UX |
| HU-11 | RF11, RF14 | Map clusters | Public clusters route/view | Geographic grouping |
| HU-12 | RF12 | Cluster renderer | `report_count` | Proportional size |
| HU-13 | RF13 | Cluster detail | Severity/count fields | Highest severity and breakdown |
| HU-14 | RF14 | Map zoom | Fixed zoom levels | Progressive expansion |
| HU-15 | RF15, RNF07 | Asociación de Hoteles de Chihuahua auth | JWT/profile/role + `GET /me` | Provisioned multi-account role |
| HU-16 | RF16 | Asociación de Hoteles de Chihuahua dashboard | Role route/presenter | Accepted canonical data only |
| HU-17 | RF17 | Asociación de Hoteles de Chihuahua export | Same role route/presenter | Export parity |
| HU-18 | RF18, RNF07 | Administrator auth | JWT/profile/role + `GET /me` | Provisioned access |
| HU-19 | RF19, RF08 | Command Center moderation queue | Administrator route/presenter + responsive Expo screen | Flag/trust context, explicitly page-scoped summary, pagination, refresh, empty/error/session states |
| HU-20 | RF20, RNF33 | Moderation | Hono approve/delete routes + generic Expo command client | Audited logical deletion; successful commands update the local queue projection |
| HU-21 | RF21, RNF29 | Flag review | FlagService + restore/approve routes | Configured threshold workflow |
| HU-22 | RF22, RNF11 | Attributes | Structured columns | Color/size/collar semantics |
| HU-23 | RF23, RNF30 | Duplicate review | Administrator duplicate routes | Canonical/reverse/audit |
| HU-24 | RF24, RNF36 | Dynamic form | JSON contract | Conditional required fields |

## Test ownership

Executable Deno tests cover Hono, domain, repository, service, and mobile
model/client behavior. Expo Doctor and Android/web exports provide mobile-shell
and bundling checks; supported-device interaction and accessibility smoke tests
remain release evidence as described by [`TESTING.md`](TESTING.md).
