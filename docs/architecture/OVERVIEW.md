# Architecture Overview

## Outcome

One Expo mobile app talks to narrow Supabase RPCs and a lightweight image
processor. PostgreSQL/PostGIS owns accepted business state, authorization checks,
geofencing, moderation transitions, duplicate resolution, and projections.

```text
anonymous public reporter ─┐
Association ───────────────┼─> React Native / Expo development build
Administrator ─────────────┘     ├─ camera + bundled MobileNetV3-Small TFLite
                                 ├─ Expo SQLite queue + local photo file
                                 ├─ MapLibre online map
                                 └─ role-protected navigation
                                             │ HTTPS
                         ┌───────────────────┴────────────────────┐
                          │ Dokploy / Traefik / Envoy (default)    │
                         │ ├─ Auth (JWT + refresh session)        │
                         │ ├─ PostgREST (RPCs, no table CRUD)     │
                         │ ├─ private quarantine/approved Storage │
                         │ ├─ lightweight image processor         │
                         │ └─ PostgreSQL + PostGIS                │
                         └─────────────────────────────────────────┘
```

Production and on-demand Staging use separate Supabase stacks, data, Storage,
secrets, and domains while sharing one physical OVH VPS. This is not HA.

## Actor boundaries

| Actor | Reads | Commands |
|---|---|---|
| anonymous public reporter | Recent visible canonical reports with approximate location and sanitized photo; own photo processing status | Submit a report; request/status a quarantine upload; flag a visible canonical report |
| Association | Accepted canonical business data retained up to five years | None; dashboard/export are read-only |
| Administrator | Moderation, flag, trust, duplicate, and configuration context | Audited moderation, duplicate, zone, and threshold commands |
| technical operator | Deployment and Auth administration | Provision/deactivate accounts; migrations; restore operations |
| trusted worker | No UI | Validate/sanitize images, apply trust result, run retention |

Association and Administrator are sibling roles. Administrator does not inherit
analytics/export. Its configuration commands are an explicit exception to its
otherwise moderation-focused scope.

## Report creation and photo pipeline

1. The app creates a final UUID and stores the complete draft in Expo SQLite. A
   photo, when present, remains in an app-private local file.
2. The queue retries `submit_report` idempotently. The same UUID and payload hash
   return the existing server record even if the geofence later changed; a
   different payload for that UUID fails. New points still need the current
   geofence.
3. The report starts in server `pending_review`; clients cannot choose status or
   trust values.
4. If a photo is expected, the client calls `request_report_photo_upload`. The
   image worker mints a signed URL for that path (`POST
   /functions/v1/authorize-report-photo-upload`).
5. The worker verifies decoded type, size, dimensions, and image integrity, derives
   transient EXIF consistency signals, re-encodes without EXIF, and promotes only
   the sanitized object. Failed and orphaned objects are cleaned up.
6. The client polls `get_report_photo_status` and deletes local files only when
   `local_cleanup_allowed` is true.
7. The trusted assessment publishes high-trust reports. Medium/low trust, mock
   location, or imprecise GPS remains in review. Heuristics never auto-discard.

Local queue states such as `draft`, `queued`, `submitting`, `uploading`,
`awaiting_processing`, `retry_wait`, `synced`, and `terminal_error` are NOT
server moderation states.

## Public map

- The map is online-only and shows an explicit unavailable state offline.
- The server clusters exact authorized locations in UTM zone 13N, then returns a
  stable 50 m-grid aggregate point, highest severity, and per-type counts.
- Supported zoom bands map to fixed cluster radii, limiting query variability.
- Individual public pins also use the same deterministic grid. No jittered
  endpoint exists to average into a more exact location.

## Trust boundaries

- Client checks improve UX but are untrusted inputs.
- PostgREST exposes RPCs, not general table writes.
- RLS limits rows if a grant is accidentally broadened; GRANT/REVOKE limits which
  operations are callable. Both are mandatory.
- The image processor is intentionally lightweight (decode, validation,
  re-encoding, metadata-derived signals), not a server ML service.

See `../API.md`, `../DATA-MODEL.md`, and `../SECURITY.md` for exact contracts.
