# Diagram Readiness and Inventory

Contracts are now specific enough to draw sequence, activity, component,
authorization, ER, and deployment diagrams. Production geofence geometry is still
an external approval gate, not an implemented polygon. Installed Auth/Storage
schemas must be confirmed on the target images before those objects are drawn as
physical columns.

## Quick path

1. Draw actors, RPCs, and the Envoy default gateway from this inventory.
2. Mark Production geofence activation as “Association approval required.”
3. Do not invent Storage/Auth columns or a Kong hop unless an operator explicitly
   enables the Kong override.

## Required diagrams

| Diagram | Must show | Primary sources | Ready |
|---|---|---|---|
| System context | Three actors; one mobile app; technical operator; external INEGI source | `architecture/OVERVIEW.md`, product clarifications | Yes |
| Containers/deployment | Production and on-demand Staging stacks sharing one VPS; Traefik edge; Envoy API gateway; isolation and no HA | `DEPLOYMENT.md`, `STACK.md` | Yes, with version confirmation at provision |
| Components | Mobile features, PostgREST RPC boundary, image processor, Auth, Storage, PostgreSQL/PostGIS in `extensions` | `architecture/OVERVIEW.md`, `API.md` | Yes |
| Report sequence | Offline UUID, SQLite/local file, `submit_report` replay-before-geofence, `request_report_photo_upload`, signed-URL worker, `get_report_photo_status`, cleanup | `API.md`, `DATA-MODEL.md` | Yes |
| Moderation state | Pending, visible, hidden, logical deletion, restoration, flag lock, expiry, purge including NULL `purge_after` | `DATA-MODEL.md` | Yes |
| Duplicate resolution | Pending connected candidates, canonical selection, active-group projection, reversible memberships, audit | `DATA-MODEL.md`, `API.md` | Yes |
| Authorization | Actor-to-RPC matrix, `get_my_profile`, no direct table writes, no Association analytics for Administrator | `SECURITY.md`, `API.md` | Yes |
| ERD | Reports, photos, flags, duplicate groups, configs, zones with required checksum, audits | `../db/schema.sql`, `DATA-MODEL.md` | Yes |
| Operations | Backup/restore, migration promotion, retention using server `now()`, staging lifecycle | `DEPLOYMENT.md` | Yes |

## Diagram rules

- Keep offline-local sync state separate from server moderation state.
- Represent Association and Administrator as siblings, never inheritance.
- Label every write as a command/RPC or trusted worker action; do not draw broad
  CRUD access to tables.
- Show exact coordinates only inside the trusted server boundary. Public outputs
  use the stable approximate grid.
- Show raw uploads in private quarantine and only sanitized images in approved
  storage.
- Draw Envoy as the Supabase API gateway. Do not draw Kong unless the optional
  override is actually enabled.
- Qualify PostGIS/pgcrypto as `extensions.*`, not `public.*`.
- Mark the Production geofence as “approval required,” not “complete.”

## Remaining input

| Item | Blocks diagrams? | Owner |
|---|---|---|
| Association approval of a Production geofence checksum/version | No. Draw the gate, not coordinates | Association |
| Exact Auth/Storage catalog columns on the installed images | Yes for physical Auth/Storage ERDs only | Operator, after version confirmation |
| Live domains and backup destinations | No. Use placeholders until provisioned | Operator |
| Expo/React Native package versions | No for backend diagrams | Mobile implementation |

## Checklist

- [ ] Sequence diagrams use named photo RPCs and the signed-URL worker, not an unnamed upload arrow.
- [ ] Duplicate reversal starts from an active group id returned by the admin API.
- [ ] Deployment diagram shows Traefik → Envoy, not Traefik → Kong, unless overridden.
- [ ] Retention activity includes photos whose `purge_after` is NULL when the report is eligible.
