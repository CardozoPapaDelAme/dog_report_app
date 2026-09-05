# Requirements Traceability Matrix

This matrix maps every immutable SRS identifier to implementation surfaces. It
records many-to-many relationships; it does not imply that one user story equals
one functional requirement.

## Functional requirements

| ID | Flow/component | Data/API boundary | Verification focus |
|---|---|---|---|
| RF01 | Anonymous report flow | `submit_report`; `reports` | No login; command-only insert |
| RF02 | Privacy copy and form | Minimized command parameters | No identity fields; incidental-PII warning |
| RF03 | Camera/photo capture | Local file; `request_report_photo_upload`; `get_report_photo_status`; quarantine worker | Optional single photo capture, authorized upload, and acknowledged cleanup |
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
| RNF01 | Availability posture | Best-effort single VPS; future 99.9% target | No current SLA claim; recovery drill |
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
| RNF12 | Offline sync | Expo SQLite + local file + retry state | Crash-safe idempotent sync |
| RNF13 | Privacy | Minimized projections and retention | No solicited public identity; PII moderation |
| RNF14 | Database recovery | Daily encrypted backup | RPO ≤24 h/RTO ≤4 h restore drill |
| RNF15 | Hosting | OVH 4 vCPU/8 GB minimum | Provisioning evidence/resource baseline |
| RNF16 | Network | Host and OVH firewalls | Port scan permits 443; restricted 22 |
| RNF17 | Server administration | SSH keys; no root/password login | Configuration audit |
| RNF18 | Infrastructure recovery | Off-host backup/snapshot | Restore drill independent of live VPS |
| RNF19 | Database | PostgreSQL/PostGIS in `extensions` | Confirm installed Supabase/Postgres version; no public-schema assumption |
| RNF20 | Authorization | RLS plus grants/revokes plus RPCs | Cross-role negative tests |
| RNF21 | API/Auth | PostgREST functions and Supabase Auth | JWT and command contract integration |
| RNF22 | Edge routing | Dokploy/Traefik/Envoy/TLS | HTTPS redirect and certificate checks; Kong only if explicitly overridden |
| RNF23 | Internal services | Private DB/Studio/Envoy internals | External scan and network inspection |
| RNF24 | Secrets | Environment-managed server secrets; anon client key | Bundle/secret scanning |
| RNF25 | Operations | CPU/RAM/disk/log/backup monitoring | Alerts and dashboard smoke tests |
| RNF26 | Anti-abuse | Fingerprint hashes; 30-day retention | Rate limits and retention job |
| RNF27 | Submission integrity | Honeypot signal to trust worker | Suspicious goes to review, not discard |
| RNF28 | Trust workflow | Trusted assessment boundary | High publishes; medium/low reviews |
| RNF29 | Flag integrity | Fingerprint uniqueness/diversity; rate limit | Coordinated flags cannot bypass threshold policy |
| RNF30 | Duplicate workflow | Candidate/groups/memberships | Detection never resolves automatically |
| RNF31 | Public edge | Proxy/worker rate limits | Report/flag abuse tests |
| RNF32 | Image processor | `request_report_photo_upload`; status RPC; private quarantine; decode/re-encode | MIME/size/dimension/decode, status acknowledgment, and orphan cleanup |
| RNF33 | Audit | Append-only `audit_log` | Every admin/config/duplicate command recorded |
| RNF34 | Sessions | Short access token + rotating refresh/session policy | Expiry, refresh, logout limitation messaging |
| RNF35 | Deferred re-identification | No DINOv2/pgvector in prototype | Absence from runtime/schema |
| RNF36 | Dynamic form | DB validator | Type/key/value boundary cases |

## User stories

| ID | Related requirements | Flow/component | Data/API | Verification focus |
|---|---|---|---|---|
| HU-01 | RF01, RNF12 | Anonymous report | `submit_report` | Offline/no-login creation |
| HU-02 | RF02, RNF13 | Privacy/form | Minimized payload | No identity solicitation |
| HU-03 | RF03, RF09 | Camera | Photo RPCs and worker | Capture, authorized upload, status, validation |
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
`docs/TESTING.md` defines the test levels.
