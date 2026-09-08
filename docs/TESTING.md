# Verification Strategy

This document owns test levels, release gates, and scenario coverage. Business
rules remain in their product/data/API/security owners; RF/RNF/HU mapping remains
in [`TRACEABILITY.md`](TRACEABILITY.md).

## Release gates

| Gate | Required proof |
|---|---|
| Schema | Ordered migration dry-run and apply succeed on a linked managed project with verified extensions/catalogs |
| Authorization | Positive/negative tests for every actor/route plus RLS context; mobile domain-table/function access denied |
| State machine | Every valid transition succeeds; every invalid transition fails |
| Privacy | No raw EXIF column/object metadata; public coordinates remain on stable 50 m grid |
| Offline | Crash/restart-safe queue; idempotent UUID/payload retries; local cleanup only after acknowledgment |
| Images | Binding/hash conflict, header spoof, configured size/dimension limits, corrupt decode, metadata strip, timeout, idempotent retry, private delivery, and compensation tests |
| Duplicates | Detection only suggests; connected pending-candidate membership; reversal discoverable; audit works |
| Retention | Time-controlled 30d/90d/1y/2y/5y tests; NULL `purge_after` cannot block report purge; mark/list/delete/ack retries use server `now()` |
| Operations | Database dumps and private object-byte export restore successfully; Free backup/SLA gap is explicit; quotas and pause state checked before demo |

## Database and API tests

### Contract-retarget verification boundary

This change verifies an implementation-ready target contract, not a Hono runtime.
Its scenarios are executable now through these structural and PostgreSQL checks:

| ID | Executable in this change | Required result |
|---|---|---|
| `CONTRACT-001` | Route/error/traceability assertion | 22 unique API routes; exact `POST /reports/:report_id/flags`; every typed error has one status, including `415 unsupported_photo_type` |
| `CONTRACT-002` | SRS/API/data/test ownership assertion | Authorized, denied, idempotent, media, photo-free trust, rate-limit, and retention behavior has one consistent future-runtime contract |
| `SQL-CONTRACT-001` | PostgreSQL 16/PostGIS 3.4 schema and authorization harness | Schema loads; grants are column-minimal; unset/spoofed/cross-role and cross-origin mutations fail closed; audits and configuration versions are immutable |
| `SQL-CONTRACT-002` | Concurrent limiter and retention harness | Atomic buckets cap concurrent requests; retention requires internal context and mark/discover/acknowledge retries converge |
| `SQL-CONTRACT-003` | Media persistence negatives | Approved rows require sanitized MIME, bytes, dimensions, output SHA-256, path, and approval timestamp |

The future backend implementation SDD must turn `HTTP-RED-001`–`004` and
`OPS-RED-001`–`003` below into executable RED tests before production code. It
must also add Hono coverage for authorized requests, authorization/data failures,
idempotent retries, complete media processing, photo-free trust, typed `429`
no-mutation behavior, and external Storage partial-delete recovery. Those runtime
results MUST NOT be claimed by this contract-retarget change.

### RED contract cases required before backend implementation

These cases are executable acceptance-test specifications. They must be written
as failing tests before the corresponding Hono route or deployment automation is
implemented; this documentation-only change records the RED contract because no
test runner or backend exists yet.

| ID | Boundary | Given / when | Required result before any service call |
|---|---|---|---|
| `HTTP-RED-001` | Router | Unknown method/path | `404 not_found` or `405 method_not_allowed`; service spy count is zero |
| `HTTP-RED-002` | Request parser | Malformed JSON, invalid query, or invalid path parameter | `400 invalid_request`; service spy count is zero |
| `HTTP-RED-003` | Authentication | An invalid, expired, or unverifiable Bearer token on any route | `401 invalid_token`; request is never reclassified as anonymous; service spy count is zero |
| `HTTP-RED-004` | Authorization | Valid token, inactive/missing profile, claim/profile mismatch, or wrong sibling role | `403 forbidden`; repository mutation count is zero |
| `OPS-RED-001` | Deployment | CLI link/project ref or expected environment differs from the approved target | Preflight aborts before migrations, secret changes, or Function deployment |
| `OPS-RED-002` | Scheduler | Retention request has an absent/incorrect cron secret | `401 invalid_internal_secret`; mark/list/delete/ack counts are zero |
| `OPS-RED-003` | Retention retry | Object deletion partially succeeds | Only deleted objects are acknowledged; failures remain discoverable as `purge_pending`; retry converges |

Unknown routes and malformed requests use the centralized error presenter and
must not leak stack traces. Deployment and scheduler tests must prove the abort
or retry state through spies/fakes before any live-project exercise.

- Assert `anon`, `authenticated`, and `service_role` have no application domain
  table privileges and cannot execute private primitives.
- Assert `app_backend` is LOGIN, `NOBYPASSRLS`, `NOINHERIT`, owns no application
  object, cannot alter roles/schema, and has only documented grants.
- With unset, malformed, or mismatched `app.user_id`/`app.role`, assert sensitive
  reads/writes fail. Prove Asociación de Hoteles de Chihuahua and Administrator sibling-role negatives.
- Asociación de Hoteles de Chihuahua can call only its accepted canonical projection and cannot retrieve
  flags, trust, moderation, operator identities, pending/hidden/deleted rows, or
  non-canonical duplicates.
- Administrator can read moderation context and execute audited commands but cannot
  call Asociación de Hoteles de Chihuahua export or edit original report fields.
- Disabled/missing profiles and JWT claim/profile/route-role mismatches fail
  privileged routes despite an otherwise valid signature.
- Each Service transaction sets actor context locally before Repository SQL; pool
  reuse begins with no residual context.
- Report UUID replay with identical payload is idempotent even after the active
  geofence no longer covers the original point; changed payload fails.
- New submissions outside the current geofence still reject; missing geofence
  fails closed; boundary point behavior is explicit; imprecise/mock inputs remain
  pending.
- `client_created_at` 31 days in the past or more than 1 hour in the future rejects
  new rows and does not block identical replay.
- Details contract receives one boundary/unknown-key/type test per incident,
  including decimal counts and solitary quantity greater than 1.
- FlagService locks the report before insert/count, rejects non-canonical and
  non-public rows, counts distinct unexpired origins, and auto-hides only visible
  rows.
- Photo upload/status routes bind the submitting
  fingerprint and source hash, deny others, converge for identical retry, reject
  different content, and allow local cleanup after every terminal state or when no
  photo was expected.
- Unsupported detected or declared media returns exactly
  `415 unsupported_photo_type`; size and decode failures remain `413` and `422`.
- Status is monotonic across `approved` → `purge_pending` → `purged`:
  `processing_complete` and `local_cleanup_allowed` stay true, exact state is
  preserved, and `upload_succeeded` is true only for `approved`.
- Same-content retry after `purge_pending` and after `purged` returns the exact
  terminal state, performs no processed-photo registration, deletes local input,
  and stops upload retry. Neither state is treated as deliverable success.
- Processing registration/rejection is backend-only and idempotent for the same
  outcome. No raw-image path, object, or EXIF field is persisted.
- Public photo delivery rejects hidden, expired, deleted, and active non-canonical
  reports. Asociación de Hoteles de Chihuahua and Administrator paths enforce their distinct role rules;
  invalid user tokens cannot fall back to anonymous access, and no response exposes
  a permanent public object URL.
- A retry after object-write/SQL-registration interruption reuses the stable photo
  id/path and converges without leaving duplicate sanitized objects.
- Mobile direct `SELECT` on `profiles` is denied; `GET /me` returns the caller.
- Restore returns to pending, approval republishes, and logical delete never hard
  deletes directly.
- Duplicate resolution without pending connected candidates fails.
  The Administrator duplicate-group route returns the group id after success.
- Zone create/activate without `source_sha256` fail. Activation rejects using the
  Administrator note as the Asociación de Hoteles de Chihuahua approval citation.
- Administrator queue includes original business fields, GPS accuracy,
  mock-location, photo expectation, and component trust scores, and cannot call
  Asociación de Hoteles de Chihuahua analytics.
- The internal retention route accepts no caller clock. The private mark primitive
  is granted only to `app_backend`; its deterministic timestamp form is test-only.
- Photos on purge-eligible reports become `purge_pending` even when `purge_after`
  is NULL.
- Retention lists every `purge_pending` row and acknowledges only successful
  object deletion. Partial failure remains discoverable and an identical retry
  converges without duplicate destructive work.
- Report and flag limits use atomic database buckets under concurrency across
  simulated instances. An identical report replay neither increments nor rejects
  due to quota; changed content still conflicts.
- Photo-free report creation invokes TrustService once with nullable photo signals
  and a policy version; it never remains `unassessed` awaiting an image.

## Map tests

- Use fixtures with known meter distances in EPSG:32613 and test every supported
  zoom band.
- Verify highest-severity order and that `type_counts` always contains all six
  incident-type keys, including zeros.
- Confirm active non-canonical duplicates never count.
- Confirm exact coordinates are absent from public payloads and repeated requests
  return the same approximate point.
- Confirm cluster queries honor the documented viewport and the 2,000/5,000 report
  cap rather than scanning unbounded history.
- Test online loading under the RNF02 prototype target and explicit offline UX.

## Mobile/native tests

- Build development and release clients for supported iOS/Android targets; Expo Go
  is not an acceptance environment.
- Test the bundled MobileNetV3-Small INT8 TFLite model offline on representative
  devices, recording model checksum, ImageNet dog-label set, 224×224 preprocessing,
  thresholds, confusion matrix/sample set, peak memory, and latency. Test
  dog/no-dog and blur/quality retry copy separately.
- Test bilingual layouts, camera-first cold start, photo-free path, single-photo
  maximum, incidental-PII warning, and report completion under five minutes.
- Simulate airplane mode, process kill, low storage, permission denial, clock skew,
  duplicate taps, flaky upload, app upgrade, and file/SQLite mismatch.

## Managed platform/security tests

- Secret/bundle scan, managed TLS smoke test, API/database rate limiting, and
  login/refresh controls.
- `supabase db push --dry-run` lists only reviewed migrations before apply; deployed
  Function `api` matches versioned source. No CLI token, database password, service key,
  or Function secret is tracked.
- If a second Free project is used, verify endpoints, keys, data, and Storage are
  isolated. Do not require a second project for the prototype.
- Execute the documented milestone runbook: verify roles/schema/data checksums,
  restore with `psql`, recreate/verify private bucket policy, restore object bytes,
  compare manifest paths/counts/checksums with `photo_assets`, and run data/access
  smoke tests. Record that Free supplies no automatic backup and no rehearsal has
  occurred until evidence is captured; the prototype procedure does not itself
  prove the required production RPO/RTO.
- Check current Free database, Storage, egress, Function invocation, active-project,
  and inactivity-pause limits immediately before the demo.

## Traceability

[`TRACEABILITY.md`](TRACEABILITY.md) is the complete pre-implementation inventory.
Replace each verification focus with concrete test IDs as suites are implemented;
preserve its many-to-many mappings.
