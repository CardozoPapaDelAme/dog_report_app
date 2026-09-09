# Hono HTTP API Contract

This document is the exact domain HTTP contract. All routes are owned by one
plain-JavaScript Hono app deployed as Supabase Edge Function `api`. The managed
invocation prefix is `/functions/v1/api`; paths below are relative to it.
[`../db/schema.sql`](../db/schema.sql) is the peer persistence contract and
[`DATA-MODEL.md`](DATA-MODEL.md) owns state semantics. A discrepancy is a release
blocker; neither contract silently overrides the other.

## Boundary and request rules

- Mobile uses Supabase Auth only for sessions. Every domain operation uses this
  API; mobile code never accesses domain tables or calls SQL functions directly.
- JSON requests use `Content-Type: application/json`; photo upload uses
  `multipart/form-data`. Unknown fields are rejected unless a schema says
  otherwise. UUIDs are lowercase canonical strings; timestamps are RFC 3339 UTC.
- Public routes permit no `Authorization` header. If a Bearer token is supplied,
  it is verified; an invalid token returns `401 invalid_token` and never
  downgrades to anonymous.
- Authenticated routes require a valid Supabase access JWT, required claims, an
  active profile, and claim/profile/route-role agreement. Missing credentials are
  `401 authentication_required`; mismatch or wrong sibling role is `403 forbidden`.
- Every response has `X-Request-Id`. JSON success is `{ "data": ... }`; error is
  `{ "error": { "code": string, "message": string, "request_id": string,
  "details"?: object } }`. No stack trace, SQL text, secret, or private path leaks.
- Controllers parse/adapt HTTP; Services authorize, apply policy, and own short
  transactions; Repositories issue parameterized SQL; Domain modules enforce
  invariants; Presenters shape these JSON views.

## Route inventory

| Method and path | Actor | Success | Service |
|---|---|---:|---|
| `GET /health` | public | 200 | HealthService |
| `POST /reports` | anonymous public reporter | 201/200 replay | ReportService |
| `POST /reports/:report_id/flags` | anonymous public reporter | 201 | FlagService |
| `GET /public/reports` | public | 200 | PublicMapService |
| `GET /public/clusters` | public | 200 | PublicMapService |
| `GET /reports/:report_id/photo-status` | submitting origin | 200 | PhotoService |
| `POST /reports/:report_id/photo` | submitting origin | 201/200 replay | PhotoService |
| `GET /reports/:report_id/photo` | public or authenticated | 200/302 | PhotoService |
| `GET /me` | authenticated | 200 | IdentityService |
| `GET /association/reports` | Asociación de Hoteles de Chihuahua | 200 | AssociationService |
| `GET /admin/moderation-queue` | Administrator | 200 | ModerationService |
| `POST /admin/reports/:report_id/approve` | Administrator | 200 | ModerationService |
| `POST /admin/reports/:report_id/hide` | Administrator | 200 | ModerationService |
| `POST /admin/reports/:report_id/delete` | Administrator | 200 | ModerationService |
| `POST /admin/reports/:report_id/restore` | Administrator | 200 | ModerationService |
| `GET /admin/duplicate-groups` | Administrator | 200 | DuplicateService |
| `POST /admin/duplicate-groups` | Administrator | 201 | DuplicateService |
| `POST /admin/duplicate-groups/:group_id/reverse` | Administrator | 200 | DuplicateService |
| `GET /admin/configuration` | Administrator | 200 | ConfigurationService |
| `POST /admin/configuration` | Administrator | 201 | ConfigurationService |
| `POST /admin/zone-sets` | Administrator | 201 | ZoneService |
| `POST /admin/zone-sets/:zone_set_id/activate` | Administrator | 200 | ZoneService |
| `POST /internal/retention/run` | scheduler | 200/207 | RetentionService |

Unknown paths return `404 not_found`; a known path with the wrong method returns
`405 method_not_allowed` with `Allow`; malformed input returns
`400 invalid_request`. All occur before a Service call.

## Public report and flag commands

### `POST /reports`

Body:

```json
{
  "id": "uuid",
  "location": { "longitude": -107.63, "latitude": 27.75, "accuracy_meters": 12.5, "mock_suspected": false },
  "incident_type": "avistamiento_simple",
  "sighting_type": "solitario",
  "details": { "cantidad_aprox": 1, "descripcion": "optional, max 2000" },
  "dog": { "predominant_color": "café", "size": "mediano", "has_collar": null },
  "photo": { "expected": false, "client_check_passed": null },
  "anti_abuse": { "device_fingerprint": "opaque-min-16", "honeypot_filled": false },
  "client_created_at": "2026-09-07T20:00:00Z"
}
```

`dog` fields are nullable; `details` follows the incident contract in
[`DATA-MODEL.md`](DATA-MODEL.md). A new row requires `client_created_at` in
`[server now - 30 days, server now + 1 hour]` and an active environment geofence.
Mock/imprecise/honeypot input enters review. The server hashes origin material.

The Service first checks an existing `id` and canonical submission hash. Identical
replay returns `200` and the original result without consuming rate quota, even if
the geofence changed. Changed content returns `409 report_id_payload_conflict`.
Only a new identity atomically consumes the durable `report` hourly bucket; an
exhausted bucket returns `429 report_rate_limit_exceeded` with `Retry-After` and no
mutation. A photo-free report is immediately evaluated by TrustService with
nullable photo signals and the active policy version.

Response `ReportReceiptView`:

```json
{ "data": { "report_id": "uuid", "moderation_status": "pending_review", "photo_expected": false, "photo_status_url": "/reports/uuid/photo-status" } }
```

### `POST /reports/:report_id/flags`

Body is `{ "reason": "foto_falsa|contenido_inapropiado|burla|no_es_callejero|incidental_pii|otro", "detail"?: "max 1000", "device_fingerprint": "opaque-min-16" }`.
The Service locks a visible, unexpired canonical report, consumes the durable
`flag` hourly bucket, enforces one effective flag per report/origin, counts
unexpired distinct origins, and atomically auto-hides at the active threshold.
Returns `201 { "data": { "flag_id": "uuid", "report_status": "visible|hidden" } }`.
Failures include `404 report_not_flaggable`, `409 flag_already_submitted`, and
`429 flag_rate_limit_exceeded`; no failed request changes the report.

## Public queries

`GET /public/reports?since=<timestamp>&limit=<1..1000>` returns
`PublicReportView[]`: `report_id`, stable `approximate_location {longitude,
latitude}`, `incident_type`, `sighting_type`, public `details`, nullable dog
attributes, `has_sanitized_photo`, `occurred_at`, and `has_flags`. Only visible,
unexpired canonical reports are included; exact coordinates and object paths are
never included.

`GET /public/clusters?zoom=<0..22>&min_longitude=&min_latitude=&max_longitude=&max_latitude=&limit=<1..5000>`
requires either all viewport values or none. It returns `ClusterView[]` with
`cluster_id`, `report_count`, stable approximate location, `highest_severity`, and
`type_counts` containing all six incident keys including zeros. Input is most
recent first and defaults to 2,000 reports.

## Photo lifecycle

The report is created before a photo. The app reduces dimensions/bytes, normalizes
HEIC/HEIF to JPEG with correct orientation, and sends only JPEG/PNG. Raw HEIC and
raw EXIF never cross into persistent server state.

### Status and upload

`GET /reports/:report_id/photo-status` requires `X-Device-Fingerprint`. It returns
`PhotoStatusView`: `report_id`, `photo_expected`, nullable `state`, nullable
`rejection_code`, `processing_complete`, `upload_succeeded`, and
`local_cleanup_allowed`.

| State | Complete | Succeeded | Cleanup | Client action |
|---|---:|---:|---:|---|
| not expected | true | false | true | clear accidental file |
| absent / `processing` | false | false | false | retain and retry same content |
| `approved` | true | true | true | stop and clear local file |
| `rejected` | true | false | true | stop, clear, show reason |
| `purge_pending` / `purged` | true | false | true | stop, clear, show retention state |

`POST /reports/:report_id/photo` requires the same header and multipart part
`photo`. It sniffs and decodes bytes, allows detected `image/jpeg` or `image/png`
only, enforces configured body/dimension/resource limits, extracts minimized
signals transiently, and re-encodes without metadata. It writes a stable private
object path then records sanitized MIME, bytes, dimensions, source/output SHA-256,
and trust inputs transactionally. SQL failure after object write triggers object
compensation; retry converges on the same identity. Identical source replay returns
the current view; different source returns `409 photo_content_conflict`. Rejection
persists a stable code. `image/heic`, mislabeled, corrupt, oversized, or undecodable
input returns a typed 4xx without raw persistence.

### Authorized delivery

`GET /reports/:report_id/photo` streams sanitized bytes or returns a short-lived
managed redirect. Anonymous access requires visible, unexpired, canonical data;
Asociación de Hoteles de Chihuahua requires accepted canonical business data;
Administrator follows moderation authority. Invalid supplied tokens fail `401`.
Missing authorization returns `404 photo_not_available` to avoid existence leaks.
Permanent public URLs, object paths, bucket listing, and raw bytes are forbidden.

## Identity and Asociación de Hoteles de Chihuahua

`GET /me` returns `ProfileView { user_id, role, display_name, active }` after all
JWT/profile checks.

`GET /association/reports?from=&to=&limit=<1..5000>&cursor=` returns accepted,
canonical business rows retained up to five years plus `next_cursor`. Each
`AssociationReportView` has report id, exact location, incident/sighting, business
details, dog attributes, `has_sanitized_photo`, occurred/accepted timestamps.
It excludes pending/hidden/deleted/non-canonical records, fingerprints, raw EXIF,
flags, trust, moderation, private paths, and operator identities. CSV/Excel export
must use this exact paginated projection. Administrator receives `403`.

## Administrator contract

`GET /admin/moderation-queue?limit=<1..500>&cursor=` returns original report fields,
exact location, GPS/mock/honeypot signals, moderation reason, photo expectation and
availability, component trust scores, flags, pending duplicate candidates, active
group/member role, occurred/synced timestamps, and `next_cursor`.

Moderation command bodies are `{ "note": "required except approve" }`. Approve
allows pending/hidden → visible and starts/restarts the 90-day window; hide allows
pending/visible → hidden; delete allows non-deleted → reversible deleted; restore
allows hidden/deleted → pending review. Each locks the row and inserts audit in the
same transaction. Invalid/stale state returns `409 invalid_*_transition`.

`GET /admin/duplicate-groups` returns active group id, canonical id, member ids,
resolved timestamp and version. `POST /admin/duplicate-groups` accepts
`{ "canonical_report_id": "uuid", "report_ids": ["uuid", "uuid"], "note"?: string }`.
Members must form a connected pending-candidate graph and have no active membership.
`POST /admin/duplicate-groups/:group_id/reverse` requires `{ "note": string }`.
Both are locked, reversible, and audited.

`GET /admin/configuration` returns the active typed configuration and versioned
zone metadata. `POST /admin/configuration` accepts all nine validated values:
flag threshold, duplicate radius/window, high/medium trust thresholds, GPS maximum,
report/flag hourly rates, and `change_note`; it creates and activates a new version
atomically and audits it.

`POST /admin/zone-sets` accepts `name`, `source_uri`, `source_version`, lowercase
64-hex `source_sha256`, and Polygon/MultiPolygon GeoJSON. It validates geometry and
creates an immutable version. `POST /admin/zone-sets/:zone_set_id/activate` accepts
`association_approval_reference` plus optional distinct Administrator `note`,
atomically retires the prior set, and audits. Production has no active geometry
until the Asociación de Hoteles de Chihuahua approves the exact checksum/version.

## Internal retention

`POST /internal/retention/run` requires `X-Internal-Secret` compared in constant
time and deployment project/environment preflight. It accepts no caller clock.
RetentionService uses server `now()` to:

1. clear expired report/flag origin hashes;
2. invoke the backend-only set-based mark primitive;
3. list every discoverable `purge_pending` photo with private object path;
4. delete objects idempotently and acknowledge only successful deletion;
5. purge eligible reports only after photo cleanup, and purge expired audits.

Returns counts and per-object typed failures. All success is `200`; partial object
failure is `207` and remains retryable/discoverable; preflight or secret failure
does no work. Scheduler retries use bounded backoff and converge.

## Error and status mapping

| HTTP | Codes |
|---:|---|
| 400 | `invalid_request`, `invalid_coordinates`, `invalid_details`, `client_created_at_out_of_bounds` |
| 401 | `authentication_required`, `invalid_token`, `invalid_internal_secret` |
| 403 | `forbidden`, `inactive_profile`, `role_mismatch` |
| 404 | `not_found`, `report_not_flaggable`, `photo_not_available` |
| 405 | `method_not_allowed` |
| 409 | `report_id_payload_conflict`, `flag_already_submitted`, `photo_content_conflict`, `invalid_*_transition`, duplicate/zone conflicts |
| 413 | `photo_too_large` |
| 415 | `unsupported_photo_type` |
| 422 | `photo_decode_failed` |
| 429 | `report_rate_limit_exceeded`, `flag_rate_limit_exceeded`, `photo_rate_limit_exceeded` |
| 503 | `geofence_not_configured`, `configuration_unavailable`, `dependency_unavailable`, `preflight_mismatch` |

Transient 5xx responses preserve local queue/photo state for bounded retry.
Controllers map known persistence codes explicitly; unknown errors become
`500 internal_error` with only the request id exposed.
