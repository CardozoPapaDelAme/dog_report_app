# Data Model

**Authoritative schema:** `db/schema.sql` (PostgreSQL + PostGIS, with in-database
docstrings via `COMMENT ON`). This document explains it; the SQL is the source of
truth.

## Extensions

- `postgis` — geospatial types/functions (geofencing, clustering, distances).
- `pgcrypto` — `gen_random_uuid()`.
- `vector` (pgvector) — **commented out**, future phase only (RNF35).

## Tables

### `reports` — core
Every sighting. Anonymous-insertable (RF01), no reporter PII (RNF13).

Notable columns:
- `id UUID` — **client-generated** for offline-first (RNF12).
- `location GEOGRAPHY(POINT,4326)` — validated inside Creel by trigger (RNF08).
- `gps_accuracy_meters`, `mock_location_suspected` — GPS quality / spoofing signals.
- `photo_url` — nullable (RF05 allows photoless reports).
- `incident_type`, `sighting_type` — enums (RF06, RF04).
- `details JSONB` — dynamic-form answers, validated per type (see contract below).
- `color_predominante` (auto), `tamano`, `tiene_collar` (manual) — attributes (RF22).
- `status` + `hidden_reason` — moderation state (RF19–RF21).
- `device_fingerprint`, `exif_metadata` — anti-abuse signals (RNF26).
- `confidence_score` + 4 component scores — **recompute server-side**, don't trust
  the client (RNF28).
- `client_created_at` vs `synced_at` — real sighting time vs. server receipt, kept
  separate so offline delays don't distort trends.

### `report_flags` — user flags (RF08)
1-to-many with reports. `UNIQUE(report_id, device_fingerprint)` stops one source from
flagging the same report repeatedly (anti-abuse, RNF29).

### `duplicate_candidates` — possible-duplicate queue (RF23)
Pairs of reports suspected to be the same sighting, by proximity + time + attributes.
Never merges/hides — feeds admin review (RNF30). Normalized so `report_a < report_b`.

### `profiles` — the two accounts (RF15, RF18)
Extends Supabase `auth.users` (never modified directly) with a `role`.

### `zones` — Creel polygon (RNF08)
Stored as data (not code) so the boundary can change without redeploying.

### `app_settings` — runtime config
Configurable thresholds: flag auto-hide count, GPS accuracy max, duplicate radius,
duplicate time window (RF21/HU-21, RF23).

### `audit_log` — admin accountability (RNF33)
Immutable record of hide/delete/restore. No UPDATE/DELETE policy by design.

## Triggers & functions

- `fn_validate_report_location` (BEFORE INSERT) — rejects reports outside any active
  zone (RNF08). Defense in depth vs. a bypassed client.
- `fn_validate_report_details` (BEFORE INSERT) — enforces the dynamic-form contract
  per incident type (RNF36).
- `fn_check_flag_threshold` (AFTER INSERT on flags) — auto-hides a report when flags
  reach the configurable threshold (RF21).
- `fn_detect_duplicates` (AFTER INSERT on reports) — queues possible duplicates
  (RF23).
- `get_report_clusters(eps_meters)` — real-time map clustering with
  `ST_ClusterDBSCAN` (RF11–RF14).

## Access: RLS + public view

- RLS filters **rows** per role.
- `public_reports` view exposes **safe columns only** to anon (omits fingerprint,
  scores, EXIF) and a boolean `has_flags` (RF21) instead of flag details.

---

## Dynamic-form JSON contract (`reports.details`)

`details` is JSONB but **not free-form**. Each incident type has expected keys,
enforced by `fn_validate_report_details`. All `descripcion` keys are optional.

### `avistamiento_simple`
| Key | Type | Required | Notes |
|---|---|---|---|
| `cantidad_aprox` | number | only if `sighting_type = manada` | approx dog count |
| `descripcion` | string | optional | free text |

```json
{ "cantidad_aprox": 5, "descripcion": "Near the lookout, scavenging" }
```

### `ataque_humano`
| Key | Type | Required | Notes |
|---|---|---|---|
| `hubo_mordida` | boolean | yes | bite/injury occurred |
| `descripcion` | string | optional | |

### `ataque_mascota`
| Key | Type | Required | Notes |
|---|---|---|---|
| `tipo_animal` | string | yes | affected pet type |
| `resulto_herido` | boolean | optional | pet injured |
| `descripcion` | string | optional | |

### `ataque_ganado`
| Key | Type | Required | Notes |
|---|---|---|---|
| `tipo_animal` | string | yes | livestock type |
| `cantidad_afectada` | number | yes | approx count affected |
| `descripcion` | string | optional | |

### `perro_lastimado`
| Key | Type | Required | Notes |
|---|---|---|---|
| `situacion` | string | yes | herido / atropellado / atrapado / mal_estado |
| `descripcion` | string | optional | |

### `otro`
| Key | Type | Required | Notes |
|---|---|---|---|
| `descripcion` | string | optional | free text |

### Rules for evolving the contract
- The app must build the correct JSON and validate before sending (good UX); the DB
  trigger is the last line of defense.
- Add new keys as **optional**; making an existing key required would require
  migrating historical reports.
- Update the trigger and this contract **together**.
- `details` is exposed in `public_reports` (incident detail is public map info);
  sensitive report columns are not.
