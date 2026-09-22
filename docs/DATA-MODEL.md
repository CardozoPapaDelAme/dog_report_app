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
| `rate_limit_buckets` | Atomic report/flag counts by operation, hashed origin, and UTC hour |

There is intentionally no raw-image or raw-EXIF object/column. Only a source
SHA-256 for retry identity, sanitized object metadata, and derived numeric
consistency signals may persist.

## Photo state and idempotency

```text
no photo row ──PhotoService begins──> processing ──valid──> approved
                                           │
                                           └─invalid───────> rejected
approved/rejected/stale processing ──retention──> purge_pending ──delete ack──> purged
```

The report is created first with its final UUID and `photo_expected`. PhotoService
computes the source hash and uses parameterized repository statements.
The same report/hash returns the existing state; a different hash conflicts in
every state, so implicit replacement cannot overwrite approved evidence. The
client resolves unknown network outcomes through retry plus
the photo-status route. `approved` means only a sanitized private JPEG/PNG object
exists. HEIC/HEIF is normalized on device. Raw input and raw EXIF exist only during
in-memory/ephemeral route processing.

`approved`, `rejected`, `purge_pending`, and `purged` are terminal upload states.
Once any is observed, `processing_complete` and `local_cleanup_allowed` remain
true and the client stops retrying. `upload_succeeded` is true only in `approved`;
it becomes false in `purge_pending`/`purged` because retention has removed current
delivery eligibility. The exact state remains visible so cleanup is distinguishable
from validation rejection. A same-content retry that reaches
PhotoService after `purge_pending` or `purged` returns that
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
condition. Asociación de Hoteles de Chihuahua may still use accepted canonical business data until five
years. Confirmed duplicate disposition is orthogonal to moderation status and is
represented by active membership, not another overloaded report status.

## Duplicate model

Detection writes candidate pairs only. Administrator resolution creates one active
group, exactly one canonical membership, and one or more duplicate memberships.
Every member must appear in a pending candidate whose both ends are in the set, and
those pending edges must connect the set. All original rows/photos/evidence remain
linked. Active non-canonical memberships are excluded from public and Asociación de Hoteles de Chihuahua
projections and analytics. The moderation queue and
the Administrator duplicate-group route exposes active group ids so reversal is
discoverable. Reversal marks the group reversed, deactivates memberships, restores
candidate review, and writes an audit entry.

Phase 1 candidate generation uses only stored time, distance, and manual dog
attributes. Optional Phase 2 may add one embedding per sanitized photo and
pgvector similarity through a separate future migration. It may rank/suggest
candidates only; the Phase 1 heuristic path and human confirmation remain
mandatory when GPU/vector support is absent.

## Typed configuration and zones

Configuration versions validate flag threshold, duplicate radius/window, trust
bands, GPS accuracy, public report/flag rates, and fixed retention periods. L1
accepts eight numeric thresholds plus one required `change_note`:

| Field | Inclusive range | Precision |
|---|---|---|
| `flag_auto_hide_threshold` | 2–100 | Integer |
| `duplicate_radius_meters` | 10–1000 | Integer, meters |
| `duplicate_time_window_minutes` | 5–1440 | Integer, minutes |
| `trust_high_threshold` | 0–1 | At most 3 decimal places |
| `trust_medium_threshold` | 0–1 | At most 3 decimal places; strictly less than high |
| `gps_accuracy_max_meters` | 5–500 | At most 2 decimal places, meters |
| `report_rate_limit_per_hour` | 1–500 | Integer |
| `flag_rate_limit_per_hour` | 1–1000 | Integer |
| `change_note` | 1–1000 Unicode characters | Nonblank string |

These limits mirror `config_versions` in `db/schema.sql`. Reject excess decimal
precision before persistence so PostgreSQL cannot silently round the requested
thresholds. Numeric strings, booleans, missing values, undeclared fields and
client-controlled metadata are rejected. The five retention fields remain
server-controlled; this command uses their schema defaults.

The Service creates a complete new version, switches activation, and inserts its
audit in one transaction. Only `is_active` may change on an existing row; its
thresholds, note, author, version, and creation timestamp remain immutable. No
row is deleted. The partial unique index allows at most one active version per
environment; the Service preserves an active version throughout committed
publications. Configuration publication uses transaction advisory lock namespace
`102001`, key `1` for staging or `2` for production, before reading or allocating
a version. All future configuration publishers must use the same lock protocol.
Version numbers increase within each environment independently.

Zone sets carry immutable source URI/version, canonical normalized GeoJSON, and
its required SHA-256 checksum. The checksum is calculated over the API's UTF-8
canonical `MultiPolygon` JSON, never over client formatting or an unrelated raw
file. The `zones.boundary` geography is derived from that same canonical source
and PostGIS enforces valid, non-empty `MULTIPOLYGON(4326)` geometry.

The target schema snapshot requires `source_geojson`. Its compatibility migration
uses a not-yet-validated check instead of retroactively fabricating source bytes:
historical rows that predate L2 may remain readable with `NULL`, but every new or
changed row must carry a GeoJSON object. The Service refuses to activate a legacy
row without its original canonical bytes; publish a new immutable version from the
original GeoJSON instead.

Creation produces only a `draft`. Activation revalidates the stored checksum,
requires a distinct meaningful Asociación de Hoteles de Chihuahua approval
citation and may include a separate Administrator note. An environment-scoped
advisory lock (`102002`, staging key `1`, production key `2`) serializes version
allocation and replacement. The partial unique index is the database backstop
and the Domain explicitly rejects more than one active set. Replacement retires
the prior set in the same transaction, preserving `activated_at` and `retired_at`
as well as append-only audit before/after state. SQL cannot prove the Asociación
approved; Production activation remains an external gate. Direct table writes
are unavailable to mobile roles. Production begins with no active geometry and
fails closed until the candidate is approved.

Replacement timestamps use the database wall clock after the environment lock is
acquired, not the transaction-start clock. A request that waits behind another
activation therefore cannot record a retirement earlier than the activation it
replaces.

Before applying the L2 lifecycle migration to a populated database, operators
must resolve rows without real approval, activation, or retirement evidence. The
migration stops with a descriptive check-violation rather than creating dates or
approval citations. Those facts must be recovered from authoritative records, or
the affected version must be deliberately replaced.

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

The backend-only set-based primitive marks photos `purge_pending` when any of these is true: approved and
`purge_after` has passed; processing/rejected and older than one day; or the parent
report is itself eligible for hard deletion. A NULL `photo_assets.purge_after` must
not block that last path. The approved output starts with a 90-day deadline, which
is reset from publication when the report becomes visible. A Function deletes the
private object and acknowledges `purged`. A report row is not hard-deleted while
its photo still needs external cleanup. RetentionService lists every
`purge_pending` row, deletes the private object idempotently, and acknowledges only
successful deletion. Failed deletion remains discoverable on retry. Retention uses
server `now()` only.

## Durable rate limits and trust

`rate_limit_buckets` has one row per operation, server-hashed origin, and UTC-hour
window. A private atomic increment creates/locks the row and rejects counts above
the active versioned limit across every Edge instance. ReportService resolves an
existing UUID/payload replay before incrementing, so replay consumes no quota.

TrustService stores the active policy version and component scores. Photo-derived
scores are nullable when `photo_expected=false`; the report is assessed during
creation rather than waiting for an image. High trust may publish, while
mock/imprecise/honeypot or medium/low trust remains pending.

## Local queue is separate

Recommended client states are `draft`, `queued`, `submitting`, `uploading`,
`awaiting_processing`, `retry_wait`, `synced`, and `terminal_error`. They are local
transport states and must never be serialized into `reports.status`.
