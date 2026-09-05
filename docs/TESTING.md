# Verification Strategy

## Release gates

| Gate | Required proof |
|---|---|
| Schema | Migration applies/rolls back on the pinned PostgreSQL/PostGIS/Supabase version |
| Authorization | Positive and negative tests for every actor/RPC; direct table CRUD denied |
| State machine | Every valid transition succeeds; every invalid transition fails |
| Privacy | No raw EXIF column/object metadata; public coordinates remain on stable 50 m grid |
| Offline | Crash/restart-safe queue; idempotent UUID/payload retries; local cleanup only after acknowledgment |
| Images | Header spoof, oversized/dimension bomb, corrupt decode, metadata strip, timeout, orphan, and compensation tests |
| Duplicates | Detection only suggests; connected pending-candidate membership; reversal discoverable; audit works |
| Retention | Time-controlled 30d/90d/1y/2y/5y tests; NULL `purge_after` cannot block report purge; production RPC uses server `now()` |
| Operations | Backup restore meets RPO/RTO target; Staging isolation and shutdown verified |

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
- `request_report_photo_upload` / `get_report_photo_status` succeed for the
  submitting fingerprint, deny others, and allow local cleanup only after
  approved/rejected/purged or when no photo was expected.
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

## Infrastructure/security tests

- External port scan, TLS redirect/certificate renewal, secret/bundle scan, API
  rate limiting, login/refresh limits, and internal Studio/database reachability.
- Validate Production/Staging use distinct endpoints, keys, databases, Storage, and
  domains. Start Staging under load and observe Production contention.
- Restore an encrypted backup into isolation and execute data/access smoke tests.

## Traceability

`TRACEABILITY.md` is the complete pre-implementation inventory for RF01–RF24,
RNF01–RNF36, and HU-01–HU-24. Replace each verification focus with concrete test
IDs as suites are implemented; preserve many-to-many mappings.
