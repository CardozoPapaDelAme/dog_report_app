# Data Model and State Contracts

This document owns conceptual entity, state, duplicate, and retention semantics.
[`../db/schema.sql`](../db/schema.sql) is the authoritative exact target; this
explanation does not override its names, signatures, or constraints. Consumer
calls belong to [`API.md`](API.md).

## Core entities

| Entity | Purpose |
|---|---|
| `profiles` | Multiple active individual accounts with one sibling role each |
| `zone_sets`, `zones` | Immutable source/version metadata and geofence geometry |
| `config_versions` | Typed thresholds with one active version per environment |
| `reports` | Immutable submitted content plus server-controlled state and derived signals |
| `photo_assets` | Sanitized-image processing, approval/rejection, and purge lifecycle; maximum one per report/source hash |
| `report_flags` | Public flags with temporary hashed-origin signal |
| `duplicate_candidates` | Heuristic pairs awaiting human review |
| `duplicate_groups`, `duplicate_memberships` | Canonical, reversible human resolution |
| `audit_log` | Append-only report, duplicate, zone, and configuration actions |

There is intentionally no raw-image or raw-EXIF object/column. Only a source
SHA-256 for retry identity, sanitized object metadata, and derived numeric
consistency signals may persist.

## Photo state and idempotency

```text
no photo row ──image Function begins──> processing ──valid──> approved
                                           │
                                           └─invalid───────> rejected
approved/rejected/stale processing ──retention──> purge_pending ──delete ack──> purged
```

The report is created first with its final UUID and `photo_expected`. The image
Function computes the source hash and calls `service_begin_photo_processing`.
The same report/hash returns the existing state; a different hash conflicts in
every state, so implicit replacement cannot overwrite approved evidence. The
client resolves unknown network outcomes through retry plus
`get_report_photo_status`. `approved` means only a sanitized private object exists.
Raw input and raw EXIF exist only during in-memory/ephemeral Function processing.

`approved`, `rejected`, `purge_pending`, and `purged` are terminal upload states.
Once any is observed, `processing_complete` and `local_cleanup_allowed` remain
true and the client stops retrying. `upload_succeeded` is true only in `approved`;
it becomes false in `purge_pending`/`purged` because retention has removed current
delivery eligibility. The exact state remains visible so cleanup is distinguishable
from validation rejection. A same-content retry that reaches
`service_begin_photo_processing` after `purge_pending` or `purged` returns that
state and performs no re-registration.

## Server moderation state machine

```text
submit ──> pending_review ──approve/high trust──> visible
              │    │                              │
              │    └─hide──────────────────────> hidden
              │                                   │
              └─logical delete──────> deleted <───┘

hidden/deleted ──restore──> pending_review
visible ──flag threshold──> hidden
```

| From | To | Cause |
|---|---|---|
| new | `pending_review` | All submissions begin under server control |
| `pending_review` | `visible` | Trusted high score or Administrator approval |
| `pending_review` | `hidden` | Administrator command |
| `visible` | `hidden` | Administrator command or distinct-origin flag threshold |
| non-deleted | `deleted` | Administrator logical-delete command |
| `hidden`/`deleted` | `pending_review` | Restore; review and approval are required before republication |

Mock-location and over-threshold GPS reports cannot take the automatic high-trust
path. A honeypot signal also remains pending. Medium/low trust remains pending.
Invalid JSON/coordinates and
outside-geofence submissions are rejected before a **new** report row is accepted.
An identical UUID+payload replay is accepted even if the active geofence later
changed. `client_created_at` for new rows must fall in `[now()-30 days, now()+1 hour]`.

Public expiry after 90 days does not change `visible`; it is a projection/retention
condition. Association may still use accepted canonical business data until five
years. Confirmed duplicate disposition is orthogonal to moderation status and is
represented by active membership, not another overloaded report status.

## Duplicate model

Detection writes candidate pairs only. Administrator resolution creates one active
group, exactly one canonical membership, and one or more duplicate memberships.
Every member must appear in a pending candidate whose both ends are in the set, and
those pending edges must connect the set. All original rows/photos/evidence remain
linked. Active non-canonical memberships are excluded from public and Association
projections and analytics. The moderation queue and
`get_administrator_active_duplicate_groups` expose active group ids so reversal is
discoverable. Reversal marks the group reversed, deactivates memberships, restores
candidate review, and writes an audit entry.

Phase 1 candidate generation uses only stored time, distance, and manual dog
attributes. Optional Phase 2 may add one embedding per sanitized photo and
pgvector similarity through a separate future migration. It may rank/suggest
candidates only; the Phase 1 heuristic path and human confirmation remain
mandatory when GPU/vector support is absent.

## Typed configuration and zones

Configuration versions validate flag threshold, duplicate radius/window, trust
bands, GPS accuracy, public report/flag rates, and fixed retention periods. A
publish command creates a new immutable version and atomically switches active
status.

Zone sets carry source URI/version and a required SHA-256 checksum plus geometry.
Create and activate reject a missing or malformed checksum. Activation stores an
Association approval citation that is distinct from the Administrator note. SQL
cannot prove the Association approved; Production activation remains an external
gate. Direct table writes are unavailable to mobile roles. Production begins with
no active geometry and fails closed until the candidate is approved.

## Dynamic-form JSON contract

`reports.details` is an object with no undeclared keys. `descripcion`, when present,
is an optional string of at most 2,000 characters.

| Incident | Allowed keys | Required validation |
|---|---|---|
| `avistamiento_simple` | `cantidad_aprox`, `descripcion` | Integer counts only. Pack requires 2–1000. Solitary may omit count or send `1`; quantity greater than 1 is rejected |
| `ataque_humano` | `hubo_mordida`, `descripcion` | `hubo_mordida` boolean |
| `ataque_mascota` | `tipo_animal`, `resulto_herido`, `descripcion` | `tipo_animal` string; injury optional boolean |
| `ataque_ganado` | `tipo_animal`, `cantidad_afectada`, `descripcion` | animal string and integer count 1–1000 |
| `perro_lastimado` | `situacion`, `descripcion` | `herido`, `atropellado`, `atrapado`, or `mal_estado` |
| `otro` | `descripcion` | No category-specific required key |

## Location and clustering

- Exact WGS84 coordinates are stored internally.
- Public points are transformed to UTM zone 13N and snapped to a stable 50 m grid,
  then returned as WGS84.
- Cluster membership is calculated server-side over exact UTM metric points.
- Aggregate centroids are snapped to the same stable grid before release.
- `type_counts` always includes all six incident types, with zeros when absent.
- Cluster queries accept an optional complete viewport and cap input reports at
  2,000 by default (5,000 maximum), most recent first.
- Severity is: `ataque_humano` > `ataque_ganado` > `ataque_mascota` >
  `perro_lastimado` > `otro` > `avistamiento_simple`.

## Retention

| Data | Rule |
|---|---|
| Public report/image availability | 90 days from publication |
| De-identified accepted business report | 5 years |
| Report/flag fingerprint hash | Cleared after 30 days |
| Audit log | Purged after 2 years |
| Logically deleted report | Purged after 1 year |
| Raw EXIF | Never persisted |

The database marks photos `purge_pending` when any of these is true: approved and
`purge_after` has passed; processing/rejected and older than one day; or the parent
report is itself eligible for hard deletion. A NULL `photo_assets.purge_after` must
not block that last path. The approved output starts with a 90-day deadline, which
is reset from publication when the report becomes visible. A Function deletes the
private object and acknowledges `purged`. A report row is not hard-deleted while
its photo still needs external cleanup. Retention uses server `now()` only.

## Local queue is separate

Recommended client states are `draft`, `queued`, `submitting`, `uploading`,
`awaiting_processing`, `retry_wait`, `synced`, and `terminal_error`. They are local
transport states and must never be serialized into `reports.status`.
