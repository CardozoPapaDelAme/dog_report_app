# Verification Strategy

This document owns test levels, release gates, and scenario coverage. Business
rules remain in their product/data/API/security owners; RF/RNF/HU mapping remains
in [`TRACEABILITY.md`](TRACEABILITY.md).

## Release gates

| Gate | Required proof |
|---|---|
| Schema | Ordered migration dry-run and apply succeed on a linked managed project with verified extensions/catalogs |
| Authorization | Positive and negative tests for every actor/RPC; direct table CRUD denied |
| State machine | Every valid transition succeeds; every invalid transition fails |
| Privacy | No raw EXIF column/object metadata; public coordinates remain on stable 50 m grid |
| Offline | Crash/restart-safe queue; idempotent UUID/payload retries; local cleanup only after acknowledgment |
| Images | Binding/hash conflict, header spoof, configured size/dimension limits, corrupt decode, metadata strip, timeout, idempotent retry, private delivery, and compensation tests |
| Duplicates | Detection only suggests; connected pending-candidate membership; reversal discoverable; audit works |
| Retention | Time-controlled 30d/90d/1y/2y/5y tests; NULL `purge_after` cannot block report purge; production RPC uses server `now()` |
| Operations | Database dumps and private object-byte export restore successfully; Free backup/SLA gap is explicit; quotas and pause state checked before demo |

## Database and API tests

- Assert anon/authenticated roles have no application table INSERT/UPDATE/DELETE.
- Assert PUBLIC cannot execute command functions and service RPCs reject mobile
  roles.
- Association can call only its accepted canonical projection and cannot retrieve
  flags, trust, moderation, operator identities, pending/hidden/deleted rows, or
  non-canonical duplicates.
- Administrator can read moderation context and execute audited commands but cannot
  call Association export or edit original report fields.
- Disabled profiles fail privileged calls despite an otherwise valid JWT.
- SECURITY DEFINER functions have expected owner, empty `search_path`, and exact
  grants.
- Report UUID replay with identical payload is idempotent even after the active
  geofence no longer covers the original point; changed payload fails.
- New submissions outside the current geofence still reject; missing geofence
  fails closed; boundary point behavior is explicit; imprecise/mock inputs remain
  pending.
- `client_created_at` 31 days in the past or more than 1 hour in the future rejects
  new rows and does not block identical replay.
- Details contract receives one boundary/unknown-key/type test per incident,
  including decimal counts and solitary quantity greater than 1.
- Flag RPC locks the report before insert/count, rejects non-canonical and
  non-public rows, counts distinct unexpired origins, and auto-hides only visible
  rows.
- `service_begin_photo_processing` / `get_report_photo_status` bind the submitting
  fingerprint and source hash, deny others, converge for identical retry, reject
  different content, and allow local cleanup after every terminal state or when no
  photo was expected.
- Status is monotonic across `approved` → `purge_pending` → `purged`:
  `processing_complete` and `local_cleanup_allowed` stay true, exact state is
  preserved, and `upload_succeeded` is true only for `approved`.
- Same-content retry after `purge_pending` and after `purged` returns the exact
  terminal state, performs no processed-photo registration, deletes local input,
  and stops upload retry. Neither state is treated as deliverable success.
- Processing registration/rejection is service-only and idempotent for the same
  outcome. No raw-image path, object, or EXIF field is persisted.
- Public photo delivery rejects hidden, expired, deleted, and active non-canonical
  reports. Association and Administrator paths enforce their distinct role rules;
  invalid user tokens cannot fall back to anonymous access, and no response exposes
  a permanent public object URL.
- A retry after object-write/SQL-registration interruption reuses the stable photo
  id/path and converges without leaving duplicate sanitized objects.
- Direct `SELECT` on `profiles` is denied; `get_my_profile` returns the caller.
- Restore returns to pending, approval republishes, and logical delete never hard
  deletes directly.
- Duplicate resolution without pending connected candidates fails.
  `get_administrator_active_duplicate_groups` returns the group id after success.
- Zone create/activate without `source_sha256` fail. Activation rejects using the
  Administrator note as the Association approval citation.
- Administrator queue includes original business fields, GPS accuracy,
  mock-location, photo expectation, and component trust scores, and cannot call
  Association analytics.
- `service_run_retention()` has no `p_now` argument. `app_private.run_retention_at`
  is not granted to app or service roles.
- Photos on purge-eligible reports become `purge_pending` even when `purge_after`
  is NULL.

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

- Secret/bundle scan, managed TLS smoke test, API/Function rate limiting, and
  login/refresh controls.
- `supabase db push --dry-run` lists only reviewed migrations before apply; deployed
  Functions match versioned source. No CLI token, database password, service key,
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
