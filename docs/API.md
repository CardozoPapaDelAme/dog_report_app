# API Command and Projection Contract

This document owns the RPC and transport contract consumed by clients and trusted
Functions. [`../db/schema.sql`](../db/schema.sql) remains authoritative for exact
names, signatures, return columns, and constraints; persistent state semantics
belong to [`DATA-MODEL.md`](DATA-MODEL.md).

The mobile app uses Supabase Auth, the generated Data API/PostgREST adapter, and
narrow SQL RPCs. There is no custom Controller-Service-Repository API. Calls use
`supabase.rpc(...)` or, conceptually, `POST /rest/v1/rpc/<function>`; clients never
perform general application-table CRUD.

## Quick path

1. Create a final local UUID and call `submit_report`.
2. If a photo is expected, reduce it on device and POST it to the image Function.
3. On any unknown network outcome, retry the same content and call
   `get_report_photo_status`; identical content converges.
4. Read public, Association, or Administrator projections only through the RPCs
   assigned to that actor.

## Client-callable SQL RPC inventory

### Anonymous and authenticated clients

| SQL signature | Purpose |
|---|---|
| `submit_report(UUID, DOUBLE PRECISION, DOUBLE PRECISION, NUMERIC, BOOLEAN, public.incident_type, public.sighting_type, JSONB, TEXT, public.dog_size, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TIMESTAMPTZ)` | Idempotently create a report from the durable queue. Identical UUID+payload replay succeeds even after a geofence change; changed payload conflicts |
| `submit_report_flag(UUID, public.flag_reason, TEXT, TEXT)` | Flag a currently public canonical report; one effective flag per report/fingerprint |
| `get_public_reports(TIMESTAMPTZ, INTEGER)` | Visible, unexpired, canonical pins with stable approximate positions and `has_sanitized_photo`; no Storage path |
| `get_public_clusters(INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER)` | Bounded metric clusters with severity and all six type counts |
| `get_report_photo_status(UUID, TEXT)` | Fingerprint-bound exact state, monotonic terminal acknowledgment, current upload success, and local cleanup decision |

`submit_report` rejects malformed details, coordinates outside the active
geofence, and new rows whose device time falls outside `[now()-30 days,
now()+1 hour]`. Missing live geofence configuration fails closed. Mock,
imprecise-GPS, and suspicious inputs enter review rather than auto-publication.

### Authenticated role RPCs

| SQL signature | Authorized role and contract |
|---|---|
| `get_my_profile()` | Any authenticated user; caller role/display name/active flag |
| `get_association_reports(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER)` | Association only; accepted visible canonical business records up to five years, with `has_sanitized_photo` but no private path |
| `get_administrator_moderation_queue(INTEGER, INTEGER)` | Administrator only; original fields, exact location, trust/flag/duplicate context, and photo availability |
| `get_administrator_active_duplicate_groups()` | Administrator only; active groups and members for discoverable reversal |
| `get_administrator_configuration()` | Administrator only; active typed configuration and versioned zone metadata |
| `admin_approve_report(UUID, TEXT)` | Pending/hidden → visible; starts/restarts public window |
| `admin_hide_report(UUID, TEXT)` | Pending/visible → hidden; note required |
| `admin_logical_delete_report(UUID, TEXT)` | Non-deleted → reversible deleted state; note required |
| `admin_restore_report(UUID, TEXT)` | Hidden/deleted → pending review |
| `admin_resolve_duplicate_group(UUID, UUID[], TEXT)` | Resolve a connected set of pending candidates with one canonical report |
| `admin_reverse_duplicate_group(UUID, TEXT)` | Reverse an active group and return its candidate edges to review |
| `admin_publish_configuration(INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, INTEGER, INTEGER, TEXT)` | Publish one validated typed configuration version |
| `admin_create_zone_set(TEXT, TEXT, TEXT, TEXT, JSONB)` | Create immutable versioned geometry with a required source checksum |
| `admin_activate_zone_set(UUID, TEXT, TEXT)` | Atomically activate a set with a distinct Association approval citation |

Administrator cannot call the Association projection. Neither authenticated role
can edit original report content.

## Image-specific Edge Function contract

### Processing

`POST /functions/v1/process-report-photo` receives `multipart/form-data` after
`submit_report` succeeds. Required parts are `report_id`, `device_fingerprint`,
and `photo`. The app reduces image size before sending it; the deployment's tested
Function, decoder, memory, and Storage bucket limits are authoritative, so this
contract does not claim an unverified request-body ceiling.

The Function uses the service-only RPCs below and MUST branch on their exact state:
continue only from `processing`, return existing success from `approved`, and
return terminal non-success without registration from `rejected`, `purge_pending`,
or `purged`. Different content returns `photo_content_conflict`; replacement is out
of Phase 1 scope. Validation, sanitization, and delivery security controls belong
to [`SECURITY.md`](SECURITY.md).

`get_report_photo_status` keeps `processing_complete` and
`local_cleanup_allowed` true for `approved`, `rejected`, `purge_pending`, and
`purged`, so acknowledgment never regresses when retention begins. Its
`upload_succeeded` field is true only for exact state `approved`; it is false for
`purge_pending`/`purged` because no currently deliverable sanitized object remains.
The client retains its local file only while completion is false. After any
terminal state it deletes the local file and MUST stop upload retries while still
preserving the returned state for UX/diagnostics.

The lifecycle definition and retention transitions are owned by
[`DATA-MODEL.md`](DATA-MODEL.md); this table specifies only client handling of the
returned contract.

| Exact status | `processing_complete` | `upload_succeeded` | `local_cleanup_allowed` | Client action |
|---|---:|---:|---:|---|
| Photo not expected | true | false | true | No upload; clear any accidental local file |
| No photo row / `processing` | false | false | false | Retain file; query/retry same content |
| `approved` | true | true | true | Stop retry; clear local file; delivery still requires authorization |
| `rejected` | true | false | true | Stop retry; clear local file; show rejection |
| `purge_pending` | true | false | true | Stop retry; clear local file; report retention cleanup state |
| `purged` | true | false | true | Stop retry; clear local file; report completed retention cleanup |

### Authorized delivery

`GET /functions/v1/report-photo?report_id=<uuid>` is the image delivery boundary.
It rejects an invalid presented token (never downgrades it to anonymous), calls
`service_authorize_report_photo_delivery`, and streams the object or returns a
short-lived managed signed delivery. Anonymous access requires a visible,
unexpired, canonical report. Association access requires accepted visible
canonical data. Administrator access follows moderation authority. In every case,
the approved photo must still be retained. Permanent public object URLs and direct
bucket listing are forbidden.

## Service-only SQL RPC inventory

Only the server-side Function/retention identity may call:

| SQL signature | Purpose |
|---|---|
| `service_begin_photo_processing(UUID, TEXT, TEXT)` | Bind report/fingerprint/source hash and idempotently create/read stable photo id/exact state; callers must not re-register terminal states |
| `service_register_processed_photo(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TEXT, NUMERIC, NUMERIC)` | Persist sanitized object metadata and image-derived scores; idempotent for the same output |
| `service_reject_photo(UUID, TEXT, TEXT)` | Persist a stable rejection for the same source hash |
| `service_authorize_report_photo_delivery(UUID, UUID)` | Return a private path only when public or role-specific delivery is allowed |
| `service_apply_trust_assessment(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC)` | Apply validated trust inputs and the report state transition |
| `service_run_retention()` | Use server `now()` to mark/purge eligible data |
| `service_acknowledge_photo_purge(UUID)` | Record successful external object deletion |

`app_private.run_retention_at(TIMESTAMPTZ)` exists for controlled tests only and
is not granted to `anon`, `authenticated`, or `service_role`. Service credentials
are Function secrets and never ship in the app or Git.

## Error categories

| Message | Meaning/recovery |
|---|---|
| `geofence_not_configured` | Intake blocked until the target environment has an active approved/test geofence |
| `location_outside_geofence` | Deterministic rejection of a new submission |
| `client_created_at_out_of_bounds` | New-row device time outside the accepted window |
| `report_id_payload_conflict` | UUID reused with different report content |
| `report_not_flaggable` | Report is not currently public and canonical |
| `photo_not_expected` | Do not send a photo for this report |
| `report_photo_access_denied` / `report_photo_access_expired` | Fingerprint mismatch or expired binding |
| `photo_content_conflict` / `processed_photo_conflict` | Different photo content/output attempted; replacement is unsupported |
| `photo_delivery_access_denied` | Report, retention window, canonical disposition, or role does not permit delivery |
| `duplicate_candidates_required` / `duplicate_group_not_connected` | Resolution set lacks the required connected pending graph |
| `association_approval_required` / `approval_reference_must_not_be_admin_note` / `invalid_source_sha256` | Zone command rejected |
| `*_role_required` | Session/profile role mismatch |
| `invalid_*_transition` | Stale moderation UI; refresh projection |
| transient network/5xx | Preserve queue/local photo and retry with bounded backoff |

Storage ownership and threat controls are documented in
[`SECURITY.md`](SECURITY.md); deployment verification belongs to
[`DEPLOYMENT.md`](DEPLOYMENT.md).
