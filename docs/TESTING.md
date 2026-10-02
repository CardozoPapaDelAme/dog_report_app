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
  fails closed unless the explicit non-production
  `ALLOW_REPORTS_WITHOUT_ACTIVE_GEOFENCE=true` photo-verification flag is set;
  boundary point behavior is explicit; imprecise/mock inputs remain pending.
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

Executable L3 API coverage:

- `controllers/publicMapController.test.js`, `services/publicMapService.test.js`
  and `repositories/publicMapRepository.test.js` cover query defaults, invalid
  requests, anonymous Service context, zoom-radius mapping, highest severity,
  complete six-key `type_counts`, read-time public approximation and repository
  exclusions.
- `tests/publicMapPostgres.test.js` is opt-in against a fresh local
  PostgreSQL/PostGIS database named `fab_public_map_test`. It applies the real
  migrations and verifies stable non-exact public pins, canonical filtering,
  viewport clustering, highest severity and all six count keys.

```sh
PUBLIC_MAP_TEST_DATABASE_URL='postgres://postgres:local-test-only@127.0.0.1:55435/fab_public_map_test' \
  deno test --allow-env --allow-net=127.0.0.1:55435 \
  --allow-read=supabase/migrations --config supabase/functions/api/deno.json \
  supabase/functions/api/tests/publicMapPostgres.test.js
```

## Database suites: how they run and known issues

Each PostgreSQL suite is opt-in and requires a **fresh disposable loopback
PostGIS database** with a fixed name, supplied through its own URL variable:

| Suite file | Database name | Variable |
|---|---|---|
| `tests/configurationPostgres.test.js` | `fab1_configuration_test` | `CONFIGURATION_TEST_DATABASE_URL` |
| `tests/zonePostgres.test.js` | `fab2_zone_test` | `ZONE_TEST_DATABASE_URL` |
| `tests/duplicatePostgres.test.js` | `fab3_duplicate_test` | `DUPLICATE_TEST_DATABASE_URL` |
| `tests/flag-postgres.test.js` | `fab4_flag_test` | `FLAG_TEST_DATABASE_URL` |
| `tests/publicMapPostgres.test.js` | `fab_public_map_test` | `PUBLIC_MAP_TEST_DATABASE_URL` |

Suites refuse non-loopback URLs, other database names and nonempty schemas. The
flag and public map suites create cluster-level roles, so each needs a fresh
cluster (container) per run.

Policy regression: a step in `tests/zonePostgres.test.js` reads `pg_policies` and
asserts the exact set of permissive `app_backend` policies on `config_versions`,
`zone_sets` and `zones`: one per table and granted command, no `FOR ALL`, no
`zones` UPDATE and no DELETE policies. This guards against the Supabase
advisor `multiple_permissive_policies`; the migration is
`20261001120000_split_backend_mutate_policies.sql`.

The flag and public map suites load their migrations from hardcoded lists; keep
those lists complete (including `20260914183000_report_replay_lookup_rls.sql`,
which defines `app_private.requested_report_id()`) when adding a migration.


## Mobile/native tests

- Build development and release clients for supported iOS/Android targets; Expo Go
  is not an acceptance environment.
- Test the bundled MobileNetV3-Small (float32) TFLite model offline on representative
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
  supabase/functions/api/tests/configurationPostgres.test.js
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

The opt-in `tests/zonePostgres.test.js` applies the complete ordered migration
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
  supabase/functions/api/tests/zonePostgres.test.js
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
  supabase/functions/api/tests/duplicatePostgres.test.js
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

> Update 2026-10-01: the server flow was later exercised on staging with real
> Administrator and Asociación sessions (see `README.md`). Native-device checks
> listed here remain pending.

## RF15 / RF18 / RNF07 Expo login (L3)

Run the focused login and secure-storage checks with:

```sh
npm run test:auth
npx expo export --platform web
```

The controller checks that the role returned by `GET /me` selects the dashboard,
expired sessions refresh before profile lookup, unknown roles fail closed, and a
profile/refresh failure clears the current Supabase session. Secure-storage
checks cover chunked Unicode values, replacement failure, cleanup, and corrupt
or partial data. These tests use injected services and fake storage; they do not
prove a live Supabase login or device Keychain/Android Keystore behavior.

Copy the placeholders from `.env.example` into local Expo configuration and
provide only the Supabase URL and publishable client key. Then sign in on a
development build using provisioned accounts for both sibling roles and confirm
the `/me`-selected destinations. Do not use a `service_role` key in the app.
## FAB-5 / L5 zone-set screen verification (2026-09-29)

Run the complete client/backend suite using the API Deno configuration:

```sh
deno test --no-lock --config supabase/functions/api/deno.json models services supabase/functions/api
npm run test:admin-ui
CI=1 EXPO_NO_TELEMETRY=1 npx expo export --platform all
```

Verified: **156 passed, 0 failed, 5 ignored** in Deno; the ignored suites require
an explicitly configured isolated PostgreSQL environment and were not executed
for this UI ticket. FAB-5 adds **six model/adapter/integration cases**, including
real FAB-2 Controller/Service calls with simulated authentication and persistence.
The canonical hyphenated FAB-2 routes are covered again after a main-branch file
rename also changed their URLs; the camelCase URLs remain compatibility aliases.

**23 browser tests pass: 15 FAB-5 and eight FAB-4 regression cases.** Run just
L5 with `npm run test:zone-sets-ui`, or just L4 with
`npm run test:configuration-ui`. The shared isolated fixture still lives at
`tests/ui/serve-configuration.mjs`; `/?zones` selects the actual ZoneSetScreen.
HTTP interception supplies test responses, never real credentials or shared data.

FAB-5 browser coverage includes selecting a real browser File, canonical SHA-256,
paste/invalid JSON, replacing a valid file with an invalid one, checksum
invalidation after edits, exact server field errors, independent draft/activation
requests, required approval, prior active-zone preservation, double-click guards,
changed/revoked/missing sessions, late creation/activation replies, uncertain
POST results, GET-only activation reconciliation, conflict blocking and draft
navigation/reset. Screenshots under ignored `test-results/` were visually
inspected at 390 × 844 and 1200 × 900.

Android, iOS and web exports pass. Device file selection uses Expo DocumentPicker
with a cache copy and FileSystem File.text; native SHA-256 uses Expo Crypto.
Web uses a separate browser adapter. Native modules require a development build.
Reference APIs: [DocumentPicker SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/),
[Crypto SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/crypto/).
These exports are not a physical-device/emulator run: native picker cancellation,
keyboard/focus, screen-reader feedback and hardware back remain manual checks.

The postponed real Administrator check was pending at delivery time (see the
2026-10-01 staging update under L4). In an agreed staging
project, with the canonical FAB-2 routes deployed, enter **Gestionar zonas** from
moderation. Select an explicitly labeled reviewed test geometry, verify its
checksum, enter source metadata and save. Verify that the old zone remains active
and the new version is a draft. Obtain the appropriate external test approval,
enter its reference, activate once, and verify the new active version, prior
retirement and both audit records. A successful GET configuration does not itself
supply a session: the L3 login flow restores Supabase Auth and supplies its access
token only after `GET /me` confirms an active profile and role.

There is no draft GET/list endpoint in FAB-2. The screen can activate the draft
returned in the current screen session, but cannot retrieve it after leaving or
recover a lost creation response. It warns before leaving, displays the immutable
ID/checksum and blocks uncertain resubmission. An uncertain activation can only be
confirmed when GET configuration returns that exact ID/checksum; otherwise an
operator must inspect the result. No extra lookup endpoint or automatic replay
was invented for L5. See [the delivery record](FAB-5-DELIVERY.md).

## FAB-6 / L6 duplicate management verification (2026-09-30)

```sh
deno test --no-lock --config supabase/functions/api/deno.json models services controllers hooks supabase/functions/api
npm run test:admin-ui
# L6 only:
npm run test:duplicates-ui
CI=1 EXPO_NO_TELEMETRY=1 npx expo export --platform all
```

Deno: **194 passed, 0 failed, 5 ignored** in the normal suite. The five SQL
suites are opt-in; the duplicate SQL suite was also executed separately with a
new disposable PostgreSQL 17/PostGIS 3.5 container: **1 passed, 10 steps**.
No shared/Supabase database is involved. Use the FAB-3 container procedure above,
with the current test path `supabase/functions/api/tests/duplicatePostgres.test.js`.

L6 adds nine Deno cases (four model, two mobile API/integration, two HTTP and one
Service). Model tests enumerate all subsets of a five-report graph and compare
local induced connectivity with FAB-3. API tests join the real mobile adapter,
Controller and Service with simulated identity/persistence. SQL tests separately
exercise the actual Repository as `app_backend`, including visible endpoints,
anonymous/Association denial, candidate removal on resolution, reappearance on
reversal and preservation of original reports/photos. Existing SQL concurrency,
audit rollback and retention/reversal cases remain passing.

Playwright: **39 passed**, comprising 16 L6, eight L4 and 15 L5 cases. Real Screen,
hook, model and adapter run in the fixture; only HTTP is intercepted. Coverage:
connected components; A–C rejected until selected B connects them; disconnected
components; canonical deselection; exact server errors; double submission;
changed/missing/revoked sessions; late resolution/reversal; uncertain POST
recovery through GET; server conflict; dirty reload confirmation; confirmed
mutation followed by failed refresh; initial service failure and empty results.
Selection controls expose checked state to web assistive technology as well as
native accessibility. Mobile and desktop screenshots were inspected at
390 × 844 and 1200 × 900 in ignored `test-results/`.

The shared fixture URL `/?duplicates` opens L6. It is not production navigation
or a live authenticated session. In the app, use Administrator login → moderation
→ **Gestionar duplicados**. The login integration already exists on this branch's
main base; it is not a new login implementation in L6.

Web, Android and iOS exports pass. These are compilation checks, not device runs.
The postponed real Administrator/JWT check was pending at delivery time (see the
2026-10-01 staging update under L4), along with native
screen-reader, keyboard and Android hardware-back verification. Deploy the single
API with the new candidate GET and restored FAB-3 URLs before checking the screen
against managed staging. Without that backend version, L6 fails visibly rather
than substituting invented candidates. Reversal preserves moderation as agreed:
a hidden/deleted report is never published/restored by reversing duplicates.

For manual staging acceptance, use reviewed test reports and actual system
suggestions A–B–C. Select A/C and confirm that no resolution POST is sent. Include
B, choose a canonical report, resolve and verify the active group/audit. Reverse
with a reason, verify reviewable candidates return, and compare report/photo
content and moderation before/after. A component containing deleted reports may
not reappear until it has eligible endpoints; candidate review state and report
moderation are intentionally distinct.

## RIC-4 / L4 Asociación dashboard and CSV export

Run `deno test --no-lock --config supabase/functions/api/deno.json models/associationReport.test.js services/associationReportApi.test.js hooks/associationReportLoader.test.js` for date, projection, pagination and CSV model checks. Run `npx playwright test associationDashboard.spec.js` for the filtered table, downloaded CSV row parity, loading through the last cursor page, and the explicit empty-range state. The browser fixture mocks RIC-2; it does not prove a live managed-project session or native share-sheet behavior. Native CSV sharing uses `expo-sharing` and requires an Expo development build.

## ERI-9 public map

The app consumes `GET /public/clusters` and `GET /public/reports` (RF10–RF14,
HU-10–HU-14). Run the client unit tests (zoom bands, viewport, severity, response
validation, request building, debounced loader with stale-response protection, map
style configuration):

```bash
npx -y deno test --no-lock --config supabase/functions/api/deno.json models/publicMap.test.js services/publicMapApi.test.js hooks/publicMapLoader.test.js services/mapConfig.test.js
```

Run the browser tests with `npx playwright test publicMap.spec.js` (or
`npm run test:public-map-ui`). The `?map` fixture entry renders the real
`PublicMapScreen` with the web stub `components/PublicMapView.web.js`; the spec
intercepts `**/public/clusters**` and `**/public/reports**`, and `/public/*` is
never served by the fixture server. Cases: clusters with counts and severity;
six-type breakdown on cluster tap; zoom 13 to 17 switching to `/public/reports`
pins; pin details with and without the flag notice; empty state; 500 then 200
retry; offline (`network_unavailable`) message; no `Authorization` header on public
requests; viewport query parameters sent all-or-none.

Expo Go fallback: `/?map&expo-go` makes the fixture pass `mapAvailable={false}` to
`PublicMapScreen` (test-only override; production reads `expo-constants`). Two cases
in `publicMap.spec.js` cover the notice, the recent list built from the mocked
`GET /public/reports?limit=100`, row to pin sheet to **Denunciar** to flag sheet, an
error that recovers on retry, and that no `/public/clusters` request is made. Run
them with `npx playwright test publicMap.spec.js -g "Expo Go"`. The pure detection
helper has Deno tests in `services/mapAvailability.test.js`. Real Expo Go behavior
(that MapLibre is never loaded) is proven by a manual pass in Expo Go.

The fixture bundle aliases `expo-constants` to `tests/ui/expo-constants-stub.js`
(always a development build) and `expo-location` to `tests/ui/expo-location-stub.js`
(permission denied, so the map centres on Creel) and resolves
`PublicMapView.js` to the web stub.

What the web stub proves: the screen's states, the zoom-to-endpoint switch, the
data shown for clusters and pins, the modal and sheet content, and the HTTP
contract used by the client. What it does **not** prove: native MapLibre
rendering (cluster circle size and colour, pins), pan/pinch gestures and real
viewport bounds, tile and style loading from OpenFreeMap/MapTiler, attribution
placement on the map surface, location permission prompts, and photo loading.
These need a device or Expo development build (`npx expo run:ios` or
`npx expo run:android`) and a manual pass against the staging API.

## ERI-10 zone detail and flag

The cluster modal offers **Ver reportes de la zona**: the app loads
`GET /public/reports?limit=1000`, keeps the reports within the zoom-band radius of
the cluster centre (approximate locations only; there is no member endpoint) and
lists them; a row opens the pin sheet, which has **Denunciar**. The flag form sends
`POST /reports/:report_id/flags` anonymously with `reason`, optional `detail` and
`device_fingerprint` in the body. Unit tests:

```bash
npx -y deno test --no-lock --config supabase/functions/api/deno.json services/flagApi.test.js models/reportFlag.test.js models/publicMap.test.js hooks/zoneReports.test.js hooks/reportFlagSubmit.test.js
```

`npx playwright test publicMap.spec.js` adds: zone list with only in-area reports,
empty and error-then-retry states; flag 201 (neutral thanks, body has `reason` and
a fingerprint of 16+ characters, no `detail` when blank, trimmed `detail`, no
`Authorization`); 409, 404 and 429 (`Retry-After: 120` shows 2 min) messages;
aborted request keeps the form and retries; submit disabled without a reason and
above 1000 characters. The stub proves the UI states and the HTTP contract; it does
not prove the server limits, auto-hide, native sheet gestures or the SQLite device
fingerprint (the web fixture uses `localStorage`).

## On-device photo validation and dog colour (RF09, RF22)

```bash
npx -y deno test --no-lock --config supabase/functions/api/deno.json services hooks models
npx playwright test reportForm.spec.js
npx expo export --platform android --output-dir /tmp/out-a   # bundles the .tflite
npx expo export --platform web --output-dir /tmp/out-w       # must exclude it
```

Unit-proven (Deno, synthetic data): softmax/dog aggregation/blur maths
(`models/photoValidation.test.js`), base64 and JPEG decode (`services/photoPixels.test.js`),
inference wiring and output types (`services/photoInference.test.js`), predominant
colour for synthetic black/white/brown/grey/golden/mixed/unclear images
(`models/dogColor.test.js`), the fail-open colour step
(`services/photoColorFlow.test.js`) and that `predominant_color` follows the form
(auto value, manual override, cleared = null) in `models/reportPayload.test.js`.
Playwright (`tests/ui/reportForm.spec.js`) shows the detected colour, changes and
clears it, and checks the POST body. Colour is a signal: the server only compares
`lower(color)` equality for duplicates.

Device-only (not proven here): TFLite model load, inference latency and memory,
real-photo accuracy of the dog/blur thresholds (dog probability 0.3, Laplacian
variance 120 on 224 px are provisional), and colour accuracy on real photos
(lighting, backgrounds). Expo Go and web skip the model by design.
