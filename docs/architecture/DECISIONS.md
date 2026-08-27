# Architecture Decision Records

Each record: the decision, why, and the trade-off accepted. Newest concerns first.

---

## ADR-001 — Single-tenant architecture

**Decision.** One administrator (the Association) manages everything. City/zone is a
data attribute, not a tenant boundary.
**Why.** The client is one nonprofit association for one region. Multi-tenant was an
earlier incorrect assumption, explicitly corrected.
**Trade-off.** No multi-city scaling without rework — accepted; not a goal.
**Do not** reintroduce multi-tenant patterns.

---

## ADR-002 — Two manually-provisioned roles, no public sign-up

**Decision.** Exactly two authenticated roles — Association and Administrator — both
created manually at setup. Plus anonymous public access.
**Why.** Dues-funded nonprofit; no commercial/tiered model needed. Anonymous
reporting is core (RF01). Manual provisioning avoids exposing the dashboard to
arbitrary sign-ups.
**Trade-off.** No self-service onboarding — accepted; there are only two accounts.

---

## ADR-003 — Self-hosted Supabase (not managed BaaS)

**Decision.** Supabase self-hosted via Docker on an OVHcloud VPS, not Supabase Cloud
or Firebase.
**Why.** Reduce operational dependency on a managed provider while keeping Auth, RLS,
PostgREST, Storage, Studio ready-made instead of building an API from scratch.
**Trade-off.** The team patches the stack itself (GoTrue, PostgREST, Postgres,
Storage). Single VPS = no HA by default.

---

## ADR-004 — Dokploy for deployment (replaces manual Nginx/Caddy)

**Decision.** Deploy via Dokploy (open-source self-hosted PaaS); use its Supabase
template and integrated Traefik reverse proxy with automatic SSL.
**Why.** One-click Supabase, automatic Let's Encrypt TLS, built-in DB backups, less
manual proxy config.
**Trade-off.** Another moving piece to understand. **SSH hardening is still required
separately** — the Dokploy web panel does not replace key-only SSH (see SECURITY).

---

## ADR-005 — PostgreSQL + PostGIS

**Decision.** Postgres with the PostGIS extension as the DBMS.
**Why.** The system is geospatial at its core: geofencing to Creel (RNF08/RF), map
clustering (RF11–RF14), and distance-based duplicate detection (RF23) all need
native spatial types, functions, and GIST indexing.
**Trade-off.** None significant for this use case; PostGIS is the standard.

---

## ADR-006 — Client-generated UUIDs for reports (offline-first)

**Decision.** `reports.id` is a UUID generated on the device, not a DB serial.
**Why.** Offline-first (RNF12): a report must have its final identity at creation
time, with or without connectivity, and sync later without collisions.
**Trade-off.** IDs aren't sequential — irrelevant here.

---

## ADR-007 — RLS (rows) + public view (columns) for access separation

**Decision.** Use Postgres Row Level Security to filter rows by role, and a
`public_reports` view to restrict columns exposed to anonymous users.
**Why.** RLS filters rows but not columns. The public must never receive sensitive
columns (device fingerprint, confidence scores, EXIF). The view enforces that in the
database, not just in the frontend.
**Trade-off.** Two mechanisms to keep in sync — acceptable and explicit.

---

## ADR-008 — Defense in depth: DB re-validates client checks

**Decision.** Client-side validation (geofence, form structure) is for UX; the
database independently re-validates via triggers.
**Why.** Any client-side check can be bypassed by calling the API directly. The DB is
where nobody can skip validation.
**Trade-off.** Some duplicated logic — intended, not redundant.

---

## ADR-009 — Dog attributes: simple now, visual re-ID deferred

**Decision.** Capture simple attributes (color auto via on-device pixel analysis;
size/collar manual). Defer visual re-identification (DINOv2 embeddings + pgvector) to
a future phase (RNF35).
**Why.** Re-ID needs GPU/dedicated inference the 8 GB/4-core VPS can't provide and
breaks offline-first for that function. Simple attributes are cheap, feed the
confidence score and the duplicate heuristic, and pre-filter candidates for a future
re-ID phase.
**Trade-off.** The prototype cannot assert "same dog" or count distinct dogs — stated
honestly. Simple attributes are a human-support signal, not identification.

---

## ADR-010 — On-device dog/no-dog validation with a standard model

**Decision.** Photo validation (RF09) uses a lightweight, pre-trained, industry-
standard vision model (MobileNet/EfficientNet-Lite via TF Lite, or ML Kit) on the
device.
**Why.** "Dog present?" is a solved classification task; no custom training or
server compute needed. Runs offline. **On-device ≠ on the VPS** — the phone provides
the compute.
**Trade-off.** Attribute inference beyond color (size, collar) is not reliable from a
single photo, so those stay manual.

---

## ADR-011 — Duplicate detection: heuristic, human-decided

**Decision.** RF23 flags possible duplicates by spatial + temporal proximity + shared
attributes, into an admin review queue. Never auto-merges or auto-hides.
**Why.** Cheap to compute on the current VPS; avoids the hard CV problem; keeps a
human in the loop for a judgment call.
**Trade-off.** Not certain — it suggests, the admin decides (RNF30).

---

## ADR-012 — Dynamic form via validated JSONB

**Decision.** Conditional per-incident answers live in a `reports.details` JSONB
column with a documented contract, validated in the DB per incident type (RF24,
RNF36).
**Why.** Avoids many mostly-null columns (rigid, migration-heavy) and avoids an
unstructured blob (unsafe). Flexible but enforced.
**Trade-off.** Contract and validation trigger must be updated together; new keys
should be added as optional to avoid breaking historical reports. See DATA-MODEL.
