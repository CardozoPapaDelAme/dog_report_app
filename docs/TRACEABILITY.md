# Requirements Traceability Matrix

This document exclusively owns the complete RF/RNF/HU mapping from immutable SRS
identifiers to implementation surfaces and verification focus. Relationships are
many-to-many; one user story does not imply one functional requirement.

## Functional requirements

| ID | Flow/component | Data/API boundary | Verification focus |
|---|---|---|---|
| RF01 | Anonymous report flow | `submit_report`; `reports` | No login; command-only insert |
| RF02 | Privacy copy and form | Minimized command parameters | No identity fields; incidental-PII warning |
| RF03 | Camera/photo capture | Local file; image Function POST; `get_report_photo_status` | Optional single photo, report-first upload, terminal-state monotonic retry/cleanup |
| RF04 | Dynamic form | `reports.sighting_type` | Solitary/pack validation |
| RF05 | Camera quick action | Offline draft without photo | Report completes photo-free |
| RF06 | Dynamic form | `incident_type`; validated `details` | Every category accepted/rejected correctly |
| RF07 | Root navigation | Camera-first anonymous route | Cold-start route test |
| RF08 | Public report detail | `submit_report_flag`; `report_flags` | One effective flag per fingerprint/report |
| RF09 | On-device vision | Bundled TFLite model | Dog/quality failures and retry offline |
| RF10 | Online public map | `get_public_reports` | Approximate recent visible canonical pins |
| RF11 | Map clustering | `get_public_clusters` | Metric grouping at supported zooms; documented viewport/limit |
| RF12 | Cluster renderer | `report_count` | Circle size follows count |
| RF13 | Cluster renderer | `highest_severity`; `type_counts` | Highest severity and all six type keys, zeros included |
| RF14 | Map interaction | Fixed zoom-to-radius RPC | Progressive expansion to pins |
| RF15 | Association login | Auth + profile role check | Multiple provisioned accounts; no signup |
| RF16 | Association dashboard | `get_association_reports` | Accepted canonical business data only |
| RF17 | Association export | `get_association_reports` pagination/export | CSV/Excel parity and authorization |
| RF18 | Administrator login | Auth + profile role check | Provisioned account; no signup |
| RF19 | Moderation queues | `get_administrator_moderation_queue` | Original fields, GPS/mock, photo expectation, component trust; no BI endpoint |
| RF20 | Moderation commands | `admin_hide_report`, `admin_logical_delete_report` | No direct update; reversible deletion |
| RF21 | Flag review/state machine | Auto-hide trigger; restore/approve commands | Threshold, audit, restore semantics |
| RF22 | On-device attributes | Structured report columns | Color automatic; size/collar manual |
| RF23 | Duplicate review | Candidate/resolution commands; `get_administrator_active_duplicate_groups` | Human-only, pending connected set, canonical, reversible, audited |
| RF24 | Dynamic form | `details` JSONB validator | Allowed keys/types per incident |

## Non-functional requirements

| ID | Flow/component | Data/API/operations boundary | Verification focus |
|---|---|---|---|
| RNF01 | Availability posture | Managed Free best effort; future 99.9% target | No current SLA/PITR claim; pause/readiness check |
| RNF02 | Public map | Bounded queries, indexes, pagination | <5 s target under prototype load |
| RNF03 | API/database | Spatial/time indexes and bounded RPCs | Load test growth profile |
| RNF04 | Report UX | Camera-first dynamic form | Usability session under 5 min |
| RNF05 | Mobile app | Expo development builds, iOS/Android | Supported-device smoke tests |
| RNF06 | Localization | `react-i18next`; all role flows | ES/EN coverage and layout |
| RNF07 | Auth/navigation | Two sibling roles; profile checks | No public signup or role inheritance |
| RNF08 | On-device vision | `react-native-fast-tflite`; MobileNetV3-Small INT8 | Runs offline in development/release build |
| RNF09 | Location validation | Versioned zones; report command | New points outside rejected; identical replay still accepted; mock/imprecise reviewed |
| RNF10 | Photo validation | On-device model; transient EXIF signals | Offline inference; no raw EXIF persistence |
| RNF11 | Dog attributes | Structured columns and duplicate signals | Offline color extraction; no identity claim |
| RNF12 | Offline sync | Expo SQLite + local file + exact retry state | Crash-safe idempotent sync; purge states stop upload retry |
| RNF13 | Privacy | Minimized projections and retention | No solicited public identity; PII moderation |
| RNF14 | Database recovery | Roles/schema/data dumps plus private-object manifest/export; production backup gate | Isolated `psql`/object restore rehearsal; do not claim Free meets required RPO/RTO |
| RNF15 | Hosting | Supabase managed Free amendment | Managed project readiness and quota evidence; historical OVH wording superseded |
| RNF16 | Network | Supabase-managed TLS/gateway plus app access controls | HTTPS smoke test; no team-operated host firewall claim |
| RNF17 | Server administration | Managed dashboard/CLI access with operator MFA/least privilege | No SSH/VPS operation; operator access audit |
| RNF18 | Infrastructure recovery | External encrypted DB dumps, private bytes/manifest, migrations/Functions | Checksummed restore into isolated managed project |
| RNF19 | Database | Managed PostgreSQL/PostGIS in `extensions` | Verify project catalogs; no provider-column/public-schema assumption |
| RNF20 | Authorization | RLS plus grants/revokes plus RPCs | Cross-role negative tests |
| RNF21 | API/Auth | PostgREST functions and Supabase Auth | JWT and command contract integration |
| RNF22 | Edge routing | Supabase-managed gateway/runtime/TLS | HTTPS smoke test; no custom gateway topology claim |
| RNF23 | Internal services | One managed boundary with logical Auth/Data API/Functions/Storage/Postgres | No direct database exposure or invented physical internals |
| RNF24 | Secrets | Managed server secrets; publishable client configuration only | Bundle/secret scanning |
| RNF25 | Operations | Managed usage, errors, pause state, retention, and export-age monitoring | Quota alerts/dashboard smoke tests |
| RNF26 | Anti-abuse | Fingerprint hashes; 30-day retention | Rate limits and retention job |
| RNF27 | Submission integrity | Honeypot signal to SQL trust assessment | Suspicious goes to review, not discard |
| RNF28 | Trust workflow | Trusted assessment boundary | High publishes; medium/low reviews |
| RNF29 | Flag integrity | Fingerprint uniqueness/diversity; rate limit | Coordinated flags cannot bypass threshold policy |
| RNF30 | Duplicate workflow | Candidate/groups/memberships | Detection never resolves automatically |
| RNF31 | Public edge | Managed platform plus Function/database rate controls | Report/flag/image abuse tests |
| RNF32 | Image processor | Multipart image Function; service/status RPCs; private sanitized Storage | Binding/hash, validation, monotonic terminal acknowledgment, no raw persistence, authorized delivery |
| RNF33 | Audit | Append-only `audit_log` | Every admin/config/duplicate command recorded |
| RNF34 | Sessions | Short access token + rotating refresh/session policy | Expiry, refresh, logout limitation messaging |
| RNF35 | Optional Phase 2 visual similarity | Future GPU/pgvector migration; Phase 1 heuristic fallback | Absent from baseline schema; suggestions remain human-confirmed |
| RNF36 | Dynamic form | DB validator | Type/key/value boundary cases |

## User stories

| ID | Related requirements | Flow/component | Data/API | Verification focus |
|---|---|---|---|---|
| HU-01 | RF01, RNF12 | Anonymous report | `submit_report` | Offline/no-login creation |
| HU-02 | RF02, RNF13 | Privacy/form | Minimized payload | No identity solicitation |
| HU-03 | RF03, RF09 | Camera | Report-first image Function plus exact status RPC | Capture, binding, terminal retry stop, validation, cleanup |
| HU-04 | RF04, RF24 | Form | `sighting_type` | Required classification |
| HU-05 | RF05, RF07 | Camera quick action | Offline draft | Visible no-photo path |
| HU-06 | RF06, RF13, RF24 | Incident form | `incident_type`, `details` | Categories and severity |
| HU-07 | RF07 | Navigation | N/A | Camera is initial route |
| HU-08 | RF08, RF21, RNF29 | Public detail/flagging | `submit_report_flag` | Warning and auto-hide behavior |
| HU-09 | RF09, RNF08, RNF10 | On-device vision | Bundled TFLite model | Offline retake reasons |
| HU-10 | RF10, RNF13 | Online map | Public report RPC | Approximate visible pins/offline UX |
| HU-11 | RF11, RF14 | Map clusters | Cluster RPC | Geographic grouping |
| HU-12 | RF12 | Cluster renderer | `report_count` | Proportional size |
| HU-13 | RF13 | Cluster detail | Severity/count fields | Highest severity and breakdown |
| HU-14 | RF14 | Map zoom | Fixed zoom levels | Progressive expansion |
| HU-15 | RF15, RNF07 | Association auth | Profile role | Provisioned multi-account role |
| HU-16 | RF16 | Association dashboard | Association projection | Accepted canonical data only |
| HU-17 | RF17 | Association export | Association projection | Export parity |
| HU-18 | RF18, RNF07 | Administrator auth | Profile role | Provisioned access |
| HU-19 | RF19, RF08 | Moderation queue | Administrator projection | Flag/trust context |
| HU-20 | RF20, RNF33 | Moderation | Hide/delete commands | Audited logical deletion |
| HU-21 | RF21, RNF29 | Flag review | Auto-hide/restore/approve | Configured threshold workflow |
| HU-22 | RF22, RNF11 | Attributes | Structured columns | Color/size/collar semantics |
| HU-23 | RF23, RNF30 | Duplicate review | Resolution commands and active-group projection | Canonical/reverse/audit |
| HU-24 | RF24, RNF36 | Dynamic form | JSON contract | Conditional required fields |

## Test ownership

Before release, each row must link to a test ID in the test suite. Until code
exists, the “Verification focus” column is the acceptance-test inventory and
[`TESTING.md`](TESTING.md) defines the test levels.
