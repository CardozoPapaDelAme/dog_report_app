# Deployment and Operations

This document owns remote deployment, migration, quota, recovery, retention-job,
monitoring, and incident procedures. The current shape and responsibility boundary
belong to [`architecture/OVERVIEW.md`](architecture/OVERVIEW.md).

Phase 1 deploys directly to Supabase managed Free. One remote project is enough
for the prototype; a second is optional for isolated demo/testing.

## Managed Free planning assumptions

Verified for planning on 2026-09-05; recheck the current pricing/usage pages and
project dashboard before the demo:

| Resource/behavior | Planning assumption |
|---|---|
| Active Free projects | Up to 2 |
| Database | 500 MB per project |
| File storage | 1 GB |
| Egress | 5 GB |
| Edge Function invocations | 500,000 |
| Automatic backups | Not included |
| Inactivity | Project may pause |

Do not promise a production SLA, point-in-time recovery, automatic daily backups,
or a custom domain on this target. Keep the project active and verify it is
unpaused before a scheduled demonstration.

## Remote-first workflow

The local Supabase Docker stack (`supabase start`) is optional. The selected remote
deployment workflow uses the Supabase CLI; database restore additionally uses
`psql`, and the documented `supabase db dump` implementation uses Docker for an
ephemeral `pg_dump` container without starting a local Supabase stack. Record and
review tool versions before each milestone operation:

```bash
supabase --version
psql --version
docker --version
```

Do not assume a future CLI default. Edge Functions are deliberately deployed with
the current explicit `--use-api` flag, which bundles server-side without Docker.
The team may otherwise develop directly against the linked managed project while
keeping all migrations and Functions in version control.

```bash
# Authenticate outside Git, then link this directory to the intended project.
supabase link --project-ref <project-ref>

# Review pending versioned migrations before changing the remote database.
supabase db push --dry-run

# Apply the reviewed migrations.
supabase db push

# Deploy the single versioned backend without local Docker bundling.
supabase functions deploy api --use-api
```

There is no separate domain/image/retention Function. Never commit access tokens, database
passwords, connection strings, service keys, JWT secrets, or Function secrets.
Set server secrets through supported Supabase project/CLI secret management and
expose only the project URL plus publishable client key in the mobile build.

[`../db/schema.sql`](../db/schema.sql) is the authoritative target, not a one-shot
migration for a populated database. Derive ordered, reviewable migrations and
verify the installed managed Auth/Storage catalogs before writing provider-owned
schema policies.

## Project bootstrap

1. Create or select the managed Free project and record whether it is `staging`
   (demo/test) or `production` (approved live) in the environment migration.
2. Disable public signup and unused Auth providers; manually provision named
   Asociación de Hoteles de Chihuahua/Administrator accounts and matching profiles.
3. Enable/verify PostGIS and pgcrypto in the managed `extensions` schema.
4. Apply ordered migrations only after `supabase db push --dry-run`; verify
   `app_backend` is `NOBYPASSRLS`, owns no objects, RLS is enabled, mobile grants
   are empty, audit is insert-only, and private primitive grants are exact.
5. Create the private approved-image bucket and least-privilege policies only
   against the verified managed Storage schema.
6. Configure the database pooler URL, JWT verification mode, Storage server
   credential, internal scheduler secret, project ref, and expected environment as
   Function secrets. Deploy only `api`. The mobile app receives none of them.
   Retention uses the exact names `INTERNAL_RETENTION_SECRET`,
   `EXPECTED_SUPABASE_PROJECT_REF`, `EXPECTED_DEPLOYMENT_ENVIRONMENT`, and
   `APPROVED_PHOTOS_BUCKET`; `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` remain
   provider-managed server configuration.
7. Configure/restrict the MapTiler public key and verify attribution/quota.
8. For a demo/test project, import the INEGI geometry only as a clearly labeled
   candidate/test fixture. An approved live project must fail closed until the
   Asociación de Hoteles de Chihuahua approves the exact checksum/version.

## Required preflight and promotion

Before migration, secret mutation, Function deployment, or scheduler enablement,
an operator records and compares all of the following: authenticated CLI account,
linked project ref, expected project ref, `deployment_metadata.environment`,
migration head/checksum, installed CLI version, required secret *names* (never
values), and intended Function name exactly `api`. Any mismatch aborts before
work. There is no fallback project, environment, Function name, or Data API path.

Required implementation spikes must record tested versions and limits for Edge
multipart/body/memory and JPEG/PNG codec behavior; iOS/Android HEIC→JPEG output,
orientation and metadata; postgres.js with Supavisor pool mode/concurrency; project
JWT/JWKS versus supported legacy verification; and managed-Free scheduling. An
unproven spike blocks the affected capability and fails closed.

## Promotion and verification

For a single-project prototype, review migration checksums, take a complete
milestone export using the runbook below, run the dry-run, push, and execute
SQL/RLS/API/image/E2E smoke and negative-authorization tests. If a second Free
project is used, validate the same migration checksum there first. Never copy live
data into a test project unless it is explicitly approved and de-identified.

## Milestone export and restore runbook

Free does **not** provide automatic backups. This runbook is the required,
rehearsable prototype procedure; it has not been executed or proven by this
documentation change. Run it from an encrypted, operator-controlled directory
outside the repository. Every value in angle brackets is a placeholder. Keep
`DATABASE_URL`, `TARGET_DATABASE_URL`, tokens, backup files, and manifests out of
Git and shell history where practical.

### Export a milestone

1. Record the milestone, UTC timestamp, source project ref, migration revision,
   and the outputs of `supabase --version`, `psql --version`, and
   `docker --version` in the encrypted operator record.
2. Set `DATABASE_URL` to the percent-encoded source connection string in the
   operator environment. From the external backup directory, run the current
   official database exports exactly:

   ```bash
   supabase db dump --db-url "$DATABASE_URL" -f roles.sql --role-only
   supabase db dump --db-url "$DATABASE_URL" -f schema.sql
   supabase db dump --db-url "$DATABASE_URL" -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
   ```

3. Compute and record checksums and byte sizes for `roles.sql`, `schema.sql`, and
   `data.sql`. Database backups include Storage metadata, but **not Storage object
   bytes**; the private approved bucket therefore requires a separate export.
4. Run an operator-controlled Storage API export script outside this repository.
   It must authenticate from environment/secret storage, recursively list the
   private approved bucket with pagination, download every object, preserve the
   exact object path under `<backup-root>/storage/<bucket-name>/`, and produce a
   machine-readable manifest containing bucket, path, byte size, content type when
   available, and SHA-256. It must fail the export on any list/download/checksum
   error and must not print credentials. No recursive download CLI command is
   assumed by this runbook.
5. Compare the object manifest with project-owned approved photo paths, record
   expected missing objects already in retention cleanup, and resolve every other
   missing/orphan mismatch. Encrypt the complete database files, object bytes,
   manifests, checksums, and run record in operator-controlled storage outside the
   managed project and repository.

### Restore into an isolated managed project

1. Provision `<target-project-ref>`, verify it is isolated, enable the required
   PostGIS/pgcrypto extensions, and obtain a fresh target connection string. Link
   deliberately and keep credentials outside Git:

   ```bash
   supabase link --project-ref <target-project-ref>
   ```

2. Decrypt/copy the selected milestone into a temporary operator-controlled
   directory, verify every recorded checksum before use, and set
   `TARGET_DATABASE_URL` to the percent-encoded target connection string.
3. Restore roles, schema, and data with the current documented `psql` sequence:

   ```bash
   psql \
     --single-transaction \
     --variable ON_ERROR_STOP=1 \
     --file roles.sql \
     --file schema.sql \
     --command 'SET session_replication_role = replica' \
     --file data.sql \
     --dbname "$TARGET_DATABASE_URL"
   ```

4. Apply or verify the target-version Storage bucket configuration and policies
   from reviewed, versioned migrations. Confirm the approved bucket is private and
   Function-only writes/deletes plus authorized delivery remain enforced. Do not
   invent or patch provider-owned `auth`/`storage` columns.
5. Restore private object bytes, preserving manifest-relative paths, using the
   current official experimental upload syntax after linking the target:

   ```bash
   supabase storage cp /path/to/downloaded/files ss:///bucket_name -r --experimental
   ```

   `/path/to/downloaded/files` and `bucket_name` are placeholders. The source
   directory must contain the bucket-relative tree, not an extra backup wrapper.
6. Recursively list/download the restored private bucket through an auditable
   operator check; compare object count, paths, byte sizes, and SHA-256 values with
   the manifest. Verify every retained `photo_assets.approved_object_path` has one
   matching object and investigate every unreferenced object.
7. Run schema/RLS/grant checks, cross-role negative tests, Auth/profile login,
   public and authenticated Hono smoke tests, image authorization/delivery, and
   retention mark/delete/ack compensation. Record elapsed time and results, then
   securely remove temporary decrypted material according to the operator policy.

A milestone is not considered restorable until this procedure succeeds and its
evidence is recorded. This document does not claim that rehearsal has occurred.
A public production launch remains gated on a plan or backup mechanism that
demonstrably satisfies the required RPO/RTO.

## Retention and monitoring

Schedule `POST /functions/v1/api/internal/retention/run` only after project,
environment, Function name, scheduler capability, and secret-name preflight. The
scheduler sends the dedicated internal secret and no caller clock. The Service
clears expired fingerprints, invokes the set-based mark primitive, discovers every
`purge_pending` row, deletes private objects idempotently, acknowledges successful
deletes, purges old audits, and hard-deletes eligible reports only after cleanup.
Partial failure returns evidence, leaves failed rows discoverable, and retries with
bounded backoff. Alert on stuck rows, Function failures, orphans, scheduler drift,
and unexpected delete volume.

Monitor database/storage/egress/Function usage against Free quotas, API latency and
errors, Auth failures, Postgres connections/slow queries, image outcomes, retention
lag, complete milestone-export age, security audit volume, and project pause state.

## Incident priorities

1. Protect and rotate secrets; deactivate compromised profiles/sessions.
2. Preserve logs, audit evidence, exports, and migration history.
3. Restore into an isolated managed project when integrity is uncertain.
4. Keep approved live intake fail-closed without an active Asociación de Hoteles de Chihuahua-approved
   geofence.
5. Communicate managed Free limits honestly; do not claim provider recovery or
   availability features that the selected plan does not include.
