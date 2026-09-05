# API Command and Projection Contract

Mobile clients call explicit RPCs. They do not insert, select, update, or delete
application tables directly. Function names and SQL signatures in
`../db/schema.sql` are authoritative.

## Quick path

1. Create a local UUID and call `submit_report`.
2. If a photo is expected, call `request_report_photo_upload`, upload through the
   signed-URL worker, then poll `get_report_photo_status` until cleanup is allowed.
3. Read public data through `get_public_reports` / `get_public_clusters`.
4. Authenticated roles use only their listed projections and commands.

## Anonymous/public RPCs

| RPC | Purpose | Important constraints |
|---|---|---|
| `submit_report` | Idempotently create a server report from the durable queue | Client supplies original content only. Identical UUID+payload replay is accepted even after a later geofence change. New submissions fail if outside the currently active approved geofence, if no geofence is active, or if `client_created_at` is outside `[now()-30 days, now()+1 hour]` |
| `request_report_photo_upload` | Authorize a private quarantine object path for an existing client UUID | Requires `photo_expected` and the original device fingerprint while that hash still exists. Does not mint a Storage signature |
| `get_report_photo_status` | Return processing state so the client can wait, retry, or delete local files | Same fingerprint binding. `local_cleanup_allowed` is true when the photo is approved, rejected, purged, or was never expected |
| `submit_report_flag` | Flag a currently public canonical report | Locks the report row before insert/count. Rejects hidden, expired, pending, deleted, and active non-canonical members. One effective flag per report/fingerprint |
| `get_public_reports` | Return public pin fields | Visible, unexpired, canonical only; stable approximate location; sanitized image path only |
| `get_public_clusters` | Return clusters for a supported zoom band | Optional viewport (`min/max` longitude/latitude, all four together) and `p_limit` (default 2,000, max 5,000 most recent eligible reports). Metric clustering; approximate centroid; highest severity; `type_counts` always includes all six incident types, zeros included |

`submit_report` rejects deterministic malformed details and coordinates outside the
active geofence. Missing Production geofence configuration fails closed. Mock or
imprecise GPS is accepted into review, never auto-published. Decimal animal counts
and solitary sightings with quantity greater than 1 are rejected.

## Photo upload worker boundary

Postgres cannot mint Supabase Storage signed URLs. The callable worker shape is:

`POST /functions/v1/authorize-report-photo-upload`

```json
{
  "report_id": "<client uuid>",
  "device_fingerprint": "<same secret used at submit_report>"
}
```

The worker:

1. Calls `request_report_photo_upload`.
2. Mints a short-lived signed upload URL for that exact `quarantine_object_path`.
3. Returns `{ report_id, photo_id, quarantine_object_path, upload_url, expires_at, max_bytes, allowed_content_types }`.

After the client PUTs the bytes, the trusted worker registers the object with
`service_register_quarantine_upload`, processes it, then calls
`service_register_processed_photo` or `service_reject_photo`. The client polls
`get_report_photo_status` and deletes local files only when
`local_cleanup_allowed` is true.

Storage schema/policy columns are not declared here. Confirm the installed
Storage version before writing bucket migrations.

## Association RPC

`get_association_reports(from, to, limit, offset)` returns accepted, visible,
canonical business records up to five years old. It may include exact coordinates,
structured report content, and the sanitized image reference. It excludes flags,
fingerprints, raw EXIF, trust scores, moderation reasons, deleted/hidden/pending
records, non-canonical duplicates, and operator identities.

CSV/Excel export consumes this same projection; there is no broader export route.

## Administrator RPCs

| RPC | Contract |
|---|---|
| `get_my_profile` | Caller's role, display name, and active flag. Direct `SELECT` on `profiles` is revoked |
| `get_administrator_moderation_queue` | Original immutable business fields, exact location, GPS accuracy, mock-location indicator, photo expectation, sanitized image, overall and component trust scores, flags, pending duplicate candidates, and active duplicate group id/role when present |
| `get_administrator_active_duplicate_groups` | Active groups with canonical id and member ids so `admin_reverse_duplicate_group` is discoverable |
| `get_administrator_configuration` | Current typed thresholds and versioned zone-set metadata for the mobile configuration screen |
| `admin_approve_report` | Pending/hidden → visible; starts/restarts 90-day public window |
| `admin_hide_report` | Pending/visible → hidden; reason required |
| `admin_logical_delete_report` | Non-deleted → deleted; reversible; reason required |
| `admin_restore_report` | Hidden/deleted → pending review; does not silently republish |
| `admin_resolve_duplicate_group` | Canonical plus members must form a connected graph of pending candidates; excludes non-canonical members from public/Association outputs |
| `admin_reverse_duplicate_group` | Deactivate resolution and return pair candidates to review |
| `admin_publish_configuration` | Publish a validated typed configuration version |
| `admin_create_zone_set` | Create immutable versioned geometry; `source_sha256` is required |
| `admin_activate_zone_set` | Atomically replace the active set. Requires an Association approval citation that is not the Administrator note, plus a stored checksum. SQL cannot verify the Association actually approved; Production activation remains an external gate |

Administrator is not authorized for `get_association_reports`. There is no general
report UPDATE endpoint and no endpoint that edits original report content.

## Trusted worker RPCs

Only the server-side service identity may call:

- `service_register_quarantine_upload`
- `service_register_processed_photo`
- `service_reject_photo`
- `service_apply_trust_assessment`
- `service_run_retention`
- `service_acknowledge_photo_purge`

`service_run_retention()` uses server `now()`. It has no caller clock argument.
`app_private.run_retention_at(p_now)` exists for tests only and is not granted to
`anon`, `authenticated`, or `service_role`.

The service credential never ships to the app. Rate limiting, signed upload
authorization, actual object movement/deletion, and decode/re-encode execution sit
in the lightweight server boundary because PostgREST/Postgres alone cannot safely
satisfy RNF31/RNF32.

## Error categories

Clients must map stable database messages to localized UX:

| Message | Meaning/recovery |
|---|---|
| `geofence_not_configured` | Intake blocked; retry only after operator resolution |
| `location_outside_geofence` | Deterministic rejection of a **new** submission; user must move/create a new draft |
| `client_created_at_out_of_bounds` | Device timestamp outside `[now()-30 days, now()+1 hour]` |
| `invalid_*` / `missing_*` | Deterministic validation failure; fix draft |
| `invalid_solitary_count` | Solitary sighting cannot declare quantity greater than 1 |
| `report_id_payload_conflict` | UUID reused with different content; stop and investigate |
| `report_not_flaggable` | Report is not currently public and canonical |
| `photo_not_expected` / `photo_state_conflict` | Do not upload; poll status or drop the photo |
| `report_photo_access_denied` / `report_photo_access_expired` | Fingerprint mismatch or 30-day hash already cleared |
| `duplicate_candidates_required` / `duplicate_group_not_connected` | Resolution set is not a connected pending-candidate group |
| `association_approval_required` / `approval_reference_must_not_be_admin_note` / `invalid_source_sha256` | Zone activation/create rejected |
| `*_role_required` | Session/role mismatch; refresh profile or sign out |
| `invalid_*_transition` | Stale moderation UI; refresh queue |
| transient network/5xx | Keep durable queue row and retry with bounded backoff |

## Storage boundary

Storage schema and policy details are deliberately not declared here. Before the
Storage migration, verify the installed self-hosted Supabase version and its owned
schema. Required behavior is two private namespaces/buckets (quarantine and
approved), short-lived upload authorization, no anonymous listing, worker-only
promotion/deletion, and public access only through an authorized signed/delivery
path for approved unexpired images.
