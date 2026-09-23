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
- `GET /association/reports` rejects Administrator, validates RFC 3339 date
  bounds, `limit` 1–5000, and cursor shape; its repository enforces the five-year
  accepted/canonical window and its presenter allowlists the business projection.
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

## FAB-1 / L1 executable configuration tests

From the repository root, with Deno installed:

```sh
deno test --no-lock --config supabase/functions/api/deno.json supabase/functions/api
```

The configuration coverage includes all numeric limits/types/precision, strict
trust-band ordering, nonblank bounded notes, unknown/server-owned fields, HTTP
parsing and methods, request ids, both registered route aliases, missing/invalid
authentication, Service authorization, environment checks, typed errors, and
transaction orchestration. HTTP RED tests were run before the configuration route
module existed. The database integration test is skipped unless its dedicated
local test URL is supplied.

For actual SQL atomicity/concurrency tests, use a **fresh disposable local
PostgreSQL cluster** with an empty database named `fab1_configuration_test` and a
local owner connection. The suite refuses non-loopback URLs, other database
names, and nonempty application schemas. It creates the `app_backend` role in
this disposable cluster; never run it against Wildogscanner or a shared cluster.

```sh
CONFIGURATION_TEST_DATABASE_URL='postgres://LOCAL_TEST_OWNER:LOCAL_TEST_PASSWORD@127.0.0.1:55432/fab1_configuration_test' \
  deno test --no-lock --allow-env --allow-net=127.0.0.1:55432 --allow-read=db/schema.sql \
  --config supabase/functions/api/deno.json \
  supabase/functions/api/tests/configuration-postgres.test.js
```

Replace the local-only credentials and port with those of that disposable
instance, then discard the cluster after testing. The suite extracts the relevant
DDL, triggers, constraints and RLS policies from `db/schema.sql`; it uses real
PostgreSQL connections with `SET LOCAL ROLE app_backend` and NOBYPASSRLS. PostGIS
geometry and managed Auth/Storage catalogs are outside this fixture's scope.

Its eight steps verify:

1. GET after POST returns the new version, with unchanged historical values,
   actor attribution, JSON audit objects and untouched production configuration.
2. Failures after insert, activation or audit roll back rows and audit together.
3. A concurrent reader sees the old active version until the writer commits.
4. Six concurrent publications produce consecutive unique versions and one active row.
5. Invalid input, a disabled profile and environment mismatch leave data unchanged.
6. Database privileges/immutability reject history deletion/rewrites, audit edits
   and missing actor context; pooled transactions do not leak that context.
7. Active zone metadata is selected only from the deployment environment.
8. Missing active configuration returns `configuration_unavailable`; publication
   can restore an active version without deleting history.

Local verification used Deno 2.9.6 and PostgreSQL 18.4 in a temporary cluster.
This proves L1 SQL behavior on that local version, not migration compatibility
with the team's managed PostgreSQL version or the entire target schema.
The final managed smoke test still needs an active app Administrator with matching
JWT role, server environment configuration, and permission to change staging
thresholds. No shared Supabase data was changed by these tests.


### FAB-1 integration with main (2026-09-19)

Merged main `65f2cda`, including Ricky's identity flow and JP's hide command.
The shared app registration preserves identity, configuration and moderation
routes and main's `/api` base path. Updated the L1 mounted-route test to request
`/api/admin/configuration`; an unprefixed application request must return 404.
Added a regression test for `/api/me`, the moderation queue and the hide route: all
remain registered, return `401 authentication_required` without a session, and
include `X-Request-Id`. These tests do not prove authenticated live access.

The combined backend suite passes 47 tests. The opt-in PostgreSQL suite was
skipped in this integration run because its disposable local database is not
configured; its earlier eight-scenario result remains the prior verification.
Live Administrator GET/POST verification remains pending against an agreed staging
deployment containing FAB-1. No deployment or shared database mutation was performed.


### FAB-1 simulated Administrator session (2026-09-19)

`tests/identity-configuration.test.js` joins Ricky's real identity controller,
service and presenter with the real configuration routes, controller, Service,
validation and presenter in one Hono test application under `/api`. A test-only
middleware supplies a verified-session-shaped actor; an in-memory repository
supplies configuration and profile state. No production authentication code is
modified and no Supabase account is created or granted privileges.

Three scenarios cover identity → read → publish → reread with matching actor/audit
attribution; an association identity denied access to Administrator configuration;
and invalid values plus profile revocation after GET /me causing no publication.
These are integration tests between application layers, not JWT verification or
real PostgreSQL atomicity tests. The complete backend suite now passes 50 tests;
the opt-in PostgreSQL suite remains skipped without its disposable database.
An actual Administrator profile, matching JWT claims and staging deployment are
still required before claiming live Supabase verification.

## FAB-2 / L2 executable zone-set tests

The L2 unit and HTTP suites run with the same backend command. They verify strict
request shapes, lowercase checksums, deterministic `Polygon` → `MultiPolygon`
normalization, coordinate bounds and closed rings, checksum mismatch rejection,
separate Asociación approval and Administrator note, protected canonical `/api`
routes, Service profile/environment rechecks, draft-only creation, and transaction
rollback for missing/corrupt targets or a one-active-zone violation.

The opt-in `tests/zone-postgres.test.js` applies the complete ordered migration
chain to a fresh disposable **PostgreSQL with PostGIS** database. It proves real
PostGIS rejection of self-intersecting and empty geometry, narrow `retired_at`
privilege for `app_backend`, RLS/grant denial of direct mutations, atomic
replacement with retained timestamps, audit rollback, concurrent one-active-zone
behavior, and the actionable legacy-lifecycle migration preflight. It must never
target Wildogscanner or a shared database.

For a local Docker run, create the database *after* the container starts so its
PostGIS extension is not preinstalled in `public`; the migrations intentionally
install it in `extensions`:

```sh
docker run --platform linux/amd64 --detach --rm --name fab2-postgis-test \
  --tmpfs /var/lib/postgresql/data:rw \
  --env POSTGRES_PASSWORD=local-test-only \
  --publish 127.0.0.1:55433:5432 postgis/postgis:17-3.5
docker exec fab2-postgis-test sh -c \
  'until pg_isready -U postgres -d postgres; do sleep 1; done'
docker exec fab2-postgis-test psql -U postgres -d postgres \
  -c 'CREATE DATABASE fab2_zone_test;'
ZONE_TEST_DATABASE_URL='postgres://postgres:local-test-only@127.0.0.1:55433/fab2_zone_test' \
  deno test --no-lock --allow-env --allow-net=127.0.0.1:55433 \
  --allow-read=supabase/migrations \
  --config supabase/functions/api/deno.json \
  supabase/functions/api/tests/zone-postgres.test.js
docker stop fab2-postgis-test
```

Use the portable Deno executable if it is not on `PATH`. On an Intel Docker host,
omit `--platform linux/amd64`. The test refuses a non-loopback, nonempty, or
wrongly named database.

## FAB-3 / L3 executable duplicate-group tests

Run the complete backend suite with the existing Deno command above. L3 adds
14 domain, Service and HTTP tests. The HTTP suite uses real routes, Controller,
Service, Domain and Presenter with test-only authentication and persistence.
It covers connected chains, disconnected/externally connected sets, strict input,
optional creation note, mandatory reversal reason, conflicting memberships,
profile/environment rejection, safe errors, and L1/L2 route registration.

For real SQL verification, use a new disposable PostgreSQL/PostGIS container
and a new empty database named `fab3_duplicate_test`:

```sh
docker run --platform linux/amd64 --detach --rm --name fab3-postgis-test \
  --tmpfs /var/lib/postgresql/data:rw \
  --env POSTGRES_PASSWORD=local-test-only \
  --publish 127.0.0.1:55434:5432 postgis/postgis:17-3.5
docker exec fab3-postgis-test sh -c \
  'until pg_isready -U postgres -d postgres; do sleep 1; done'
docker exec fab3-postgis-test psql -U postgres -d postgres \
  -c 'CREATE DATABASE fab3_duplicate_test;'
DUPLICATE_TEST_DATABASE_URL='postgres://postgres:local-test-only@127.0.0.1:55434/fab3_duplicate_test' \
  deno test --no-lock --allow-env --allow-net=127.0.0.1:55434 \
  --allow-read=supabase/migrations --config supabase/functions/api/deno.json \
  supabase/functions/api/tests/duplicate-postgres.test.js
docker stop fab3-postgis-test
```

Use a fresh container for every run: the suite creates database roles as well as
app tables. It refuses a non-loopback URL, another database name, existing tables
or preinstalled PostGIS. It applies the six existing migrations in order and runs
the real Repository under `app_backend` with local actor context. It never runs
against Wildogscanner. No L3 migration is required.

Its ten steps verify real system-generated candidate chains and HTTP resolution;
canonical filtering for anonymous and Association roles; reversal and new
resolution history; disconnected/missing/deleted/overlapping/nonpending rejection;
rollback after actual audit insertion; competing resolutions and reversals;
concurrent reverse/resolve; RLS, narrow grants and nonleaking pooled context;
preservation of later moderation and release after retention purges a member;
and disabled-profile/environment denial. Report and photo rows are compared
before/after commands, including timestamps and moderation state.

Verified 2026-09-22: full backend **78 passed, 0 failed, 3 ignored** (SQL suites
are opt-in); dedicated L3 PostgreSQL/PostGIS **1 passed, 10 steps, 0 failed**.
This proves local application/SQL behavior, not a managed Supabase JWT session.

Pending managed Administrator smoke test, after deployment is agreed:

1. Verify `/me`, role `administrator`, matching profile and staging environment.
2. Obtain genuine pending candidate pairs from the moderation context and record
   their original report/photo/moderation data. Do not invent unrelated report IDs.
3. GET active groups; POST a disconnected set and confirm 409 with no mutation.
4. POST a connected set including its canonical id and a review note; expect 201,
   one active membership per report, confirmed internal candidates and audit.
5. GET the new group and attempt an overlapping resolution; expect 409.
6. Reverse with a note; expect 200, version 2, inactive memberships, pending
   internal candidates, unchanged reports/photos/moderation and a reversal audit.
7. Repeating reversal must return 409; an Association account must receive 403.

The live test remains deferred by Fabián; no real account or shared database was
created/changed as part of this implementation.

## FAB-4 / L4 configuration form

The mobile screen follows `screens/ConfigurationScreen.js` →
`hooks/useConfiguration.js` → `services/configurationApi.js` → existing
`services/apiClient.js`. `models/configuration.js` owns editable strings, numeric
conversion and local validation. Tests check every numeric rule against FAB-1.
The contract remains **eight numeric thresholds plus change_note**, not nine
numeric settings. No API, SQL or migration change is required.

Run model, adapter, FAB-1 integration and backend regression tests:

```sh
deno test --no-lock --config supabase/functions/api/deno.json models services supabase/functions/api
```

Verified result: **104 passed, 0 failed, 3 ignored** (the existing opt-in SQL
suites). L4 adds eight model/adapter/integration cases. The integration test joins
the real mobile adapter to FAB-1 Controller/Service with in-memory persistence;
it does not claim a real JWT or PostgreSQL session.

Install locked development dependencies and the browser once, then run UI tests:

```sh
npm ci
npx playwright install chromium
npm run test:configuration-ui
```

**Eight browser tests pass** using the real Screen, hook, model and API adapter.
Playwright intercepts only the configuration HTTP endpoint; no Supabase traffic
or real credentials are used. Tests cover initial values, a blank new reason,
GPS 501 with the precise field message, numeric comma conversion, complete POST
payload, new active version, exact server field errors, double-click prevention,
logout during saving, denied/expired sessions, ambiguous POST recovery, reload,
unsaved-change confirmation and mobile/desktop layouts. Screenshots are generated
under ignored `test-results/`. The fixture and its test-session buttons live only
in `tests/ui`; they are never imported into the app entry point.

The test server is bound to loopback port 4174. Without Playwright interception,
its API route deliberately returns 500; `preview:configuration-test` is a fixture,
not a working session or a connection to shared data. Tests require that port free.

Build verification:

```sh
CI=1 EXPO_NO_TELEMETRY=1 npx expo export --platform all
```

Web, Android and iOS bundles were successfully exported. This is compilation,
not a physical-device/emulator test. Manually check screen-reader focus, the
numeric keyboard and Android hardware back on a development build before release.
The screen handles hardware back with the same unsaved-change confirmation.

### Runtime behavior and remaining live validation

`App` still receives its access token from the team's session integration; the
current `index.js` does not create a login. With no token, no configuration request
is sent. With a token, the protected FAB-1 GET must succeed before any editable
values appear. The backend remains the role/profile authority; 401/403 removes
the form. No session secrets are persisted by this screen.

From moderation, choose **Configurar umbrales**. Values load from FAB-1; the last
publication reason is read-only and the new reason starts blank. Client errors
are localized; `error.details.fields` messages from the server are preserved
verbatim beside the matching field. Invalid submissions focus the first affected
field. A successful POST supplies the new active version and resets the draft.

No POST is retried automatically. When its result is uncertain or conflicted,
editing/saving is blocked until the user explicitly reads the active version;
this avoids silently repeating a non-idempotent FAB-1 publication. Dirty reload
and navigation ask before discarding the draft. Late replies after token change
or unmount cannot update the form.

The deferred live check needs a real Administrator session and an agreed staging
deployment containing FAB-1. Read values, attempt GPS 501 and verify no publication,
correct it and enter a reason, publish once, then verify the new version and audit
in staging. Confirm the old configuration remains in history. No live publication,
account creation, migration or deployment was performed for L4.
