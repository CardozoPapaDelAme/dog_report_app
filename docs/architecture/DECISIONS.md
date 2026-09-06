# Architecture Decision Records

This document owns accepted and superseded technical rationale. It preserves why
choices were made; current structural orientation belongs to
[`OVERVIEW.md`](OVERVIEW.md), and exact contracts belong to the schema and
contract documents.

Approved product amendments live in
[`../product/APPROVED-CLARIFICATIONS.md`](../product/APPROVED-CLARIFICATIONS.md).
These records define how the prototype implements them.

## ADR-001 — Single tenant, sibling roles, multiple accounts

**Decision.** Keep one organizational tenant and exactly two authenticated roles,
Association and Administrator. Allow multiple individually attributable accounts
per role, provisioned by a technical operator.

**Why.** Roles describe authority, not account count. Individual accounts preserve
accountability without introducing hotel tenants or a role hierarchy.

**Constraint.** No public signup, in-app account administration, per-hotel tenant,
or Administrator inheritance of Association BI/export.

## ADR-002 — RPC-only client data boundary

**Decision.** Expose minimized SECURITY DEFINER projections and commands; revoke
mobile table CRUD. Keep RLS enabled as a second boundary.

**Why.** Broad INSERT/UPDATE lets clients set trust, moderation, server-controlled
lifecycle/audit timestamps, and audit fields. The narrow report command separately
accepts and validates `p_client_created_at` as the observation timestamp. RLS
filters rows but does not by itself constrain columns or command semantics.

**Constraint.** Empty `search_path`, qualified names, dedicated NOLOGIN owner,
PUBLIC revocation, narrow EXECUTE grants, role checks, and negative tests are
mandatory.

## ADR-003 — Explicit server moderation state

**Decision.** Use `pending_review`, `visible`, `hidden`, and `deleted`; represent
duplicate disposition separately. Restore returns to review. Public expiry is a
projection rule, not a moderation state.

**Why.** One overloaded status cannot correctly express review, reversible logical
deletion, canonical duplicates, and time-limited public display.

## ADR-004 — Human canonical duplicate groups

**Decision.** Heuristics create candidate pairs. Administrator creates a group with
one canonical member; non-canonical members are excluded from public/Association
outputs. Resolution is reversible and audited.

**Why.** RF23/RNF30 prohibit automatic certainty, hiding, or merging.

## ADR-005 — Versioned typed configuration and geofences

**Decision.** Replace key/value settings with validated immutable config versions.
Version zone source metadata and geometry separately. Activation atomically swaps
the active set and requires an Association approval reference.

**Why.** Runtime configuration is security-sensitive behavior, not free-form text.
The current INEGI polygon is only a candidate, not an approved tourist boundary.

## ADR-006 — Durable offline queue with Expo SQLite

**Decision.** Store complete drafts and deterministic local queue state in Expo
SQLite; store an optional single image in an app-private local file. Generate the
final UUID at draft creation and retry idempotently with bounded backoff.

**Why.** SQLite gives transactional, crash-safe metadata while a file avoids large
image blobs in rows. Server moderation state remains separate.

**Trade-off.** Queue/file compensation and orphan cleanup must be tested explicitly.

## ADR-007 — Direct image Function plus private sanitized Storage

**Decision.** Submit the report first, then send the optional reduced image as
multipart form data to an image-specific Edge Function. Validate binding and
configured MIME/size/dimension limits, decode, derive EXIF coherence transiently,
and re-encode in memory/ephemeral processing. Persist only sanitized output in a
private bucket. Use source hashes and status RPCs for idempotent retries; different
content for the same report conflicts and replacement is out of scope.

**Why.** Postgres/PostgREST cannot safely decode/re-encode untrusted media. The
managed Function can process bytes without persisting a raw quarantine object,
reducing state and Storage exposure while preserving RNF32 and offline recovery.

**Constraint.** Private images are delivered only through an image-specific GET
authorization path or equivalent short-lived managed signed delivery. No
permanent public object URL is exposed.

## ADR-008 — MapLibre React Native with hosted vector tiles

**Decision.** Use `@maplibre/maplibre-react-native` in Expo development/release
builds with MapTiler Cloud vector styles/tiles. The map is online-only. Server RPCs
provide domain clusters; MapLibre renders them and uses cluster expansion/zoom
interaction. Restrict the public MapTiler key according to provider controls.

**Why.** It provides native vector maps and documented GeoJSON clustering controls
without coupling domain data to Google/Apple map implementations. Provider URL,
key restrictions, attribution, licensing, plan, quota, and expected usage must be
verified before release.

**Constraint.** It is not available in Expo Go. Public data clustering remains
server-authoritative because exact locations and severity semantics must not leak.

Reference: <https://maplibre.org/maplibre-react-native/docs/setup/expo/> and
<https://maplibre.org/maplibre-react-native/docs/components/sources/geo-json-source/>.
Provider integration reference: <https://docs.maptiler.com/react-native/>.

## ADR-009 — Custom bundled TFLite via react-native-fast-tflite

**Decision.** Bundle one versioned MobileNetV3-Small INT8 TFLite ImageNet
classifier and invoke it through `react-native-fast-tflite` on CPU first. Aggregate
the documented ImageNet dog classes into the dog/no-dog decision, use deterministic
224×224 preprocessing, and evaluate blur/quality separately. Add delegates only
after device benchmarks; do not train a custom model for the prototype.

**Why.** This is a concrete offline custom-TFLite path compatible with Expo native
builds and avoids a cloud call. CPU-first minimizes device-specific delegate risk.

**Constraint.** Expo development builds are required; Expo Go is insufficient.
Model provenance, license, checksum, input tensor, normalization, outputs,
threshold calibration, and supported-device latency remain implementation evidence,
not assumptions. On-device success does not replace server image sanitization.

Reference: <https://github.com/mrousavy/react-native-fast-tflite>.

## ADR-010 — Metric server clustering and stable public approximation

**Decision.** Transform exact report locations to EPSG:32613 for fixed zoom-band
DBSCAN radii. Return a centroid snapped to a deterministic 50 m metric grid, highest
severity, and per-type counts. Individual pins use the same grid.

**Why.** Degree-based epsilon is not meters. Query-dependent jitter can be averaged;
a stable grid avoids that failure while preserving useful map placement.

## ADR-011 — Trust routes; deterministic validation rejects

**Decision.** High server-derived trust publishes; medium/low, mock location,
imprecise GPS, and suspicious honeypot signals enter review. Heuristics never
discard. Invalid structure and outside-geofence coordinates reject deterministically.

**Why.** Heuristic uncertainty must not destroy evidence or bypass a human decision.

## ADR-012 — Authentication sessions are not instantly revocable JWTs

**Decision.** Disable signup, provision accounts manually, check active profiles on
every privileged RPC, use short access tokens and supported refresh/session
controls, and document logout limitations.

**Why.** Stateless access JWTs ordinarily remain valid until expiry. A disabled
profile gives the application an immediate server-side authorization check without
claiming unsupported token invalidation.

## ADR-013 — Separate stacks on one VPS

**Status: superseded by ADR-016.** This records the audited checkpoint only and is
not the managed target.

**Decision.** Production and on-demand Staging have separate Supabase stacks,
Storage, databases, secrets, backups, and domains but share one physical OVH VPS.

**Why.** Logical isolation supports migration rehearsal within prototype budget.

**Trade-off.** Shared CPU/RAM/disk create contention and correlated failure. Staging
must be stopped after validation. This is not HA and 99.9% is not a current SLA.

## ADR-014 — Retention by data class

**Decision.** Public reports/photos: 90 days; de-identified business data: 5 years;
fingerprints: 30 days; audit: 2 years; logical deletion purge: 1 year; raw EXIF:
never persisted.

**Why.** Different purposes require bounded lifetimes. Storage deletion uses a
mark/delete/ack compensation flow so database and object storage converge safely.

## ADR-015 — PostgreSQL/PostGIS and self-hosted Supabase via Dokploy

**Status: superseded by ADR-016.** This records the audited checkpoint only and is
not the managed target.

**Decision.** Retain PostgreSQL/PostGIS and separate self-hosted Supabase stacks on
Dokploy/Traefik over an OVH VPS. Pin the prototype to snapshot `self-hosted/v0.8.0`
with Envoy as the API gateway and PostGIS/pgcrypto installed in schema `extensions`.

**Why.** PostGIS supports the geospatial core; Supabase supplies Auth, PostgREST,
and Storage while preserving infrastructure control. Current self-hosted defaults
use Envoy, not Kong, and keep extensions out of `public`.

**Trade-off.** The team owns patching, backup validation, capacity, and recovery.
Confirm the installed versions before Auth/Storage migrations. Kong remains
available only as an explicit override. No pgvector/DINOv2 or heavy server
inference is included.

## ADR-016 — Supabase managed Free as the Phase 1 provider boundary

**Decision.** Use Supabase managed Free directly. Model Supabase Cloud as one
managed provider boundary, logically decomposed into Auth, Data API/PostgREST,
Edge Functions, Storage, and PostgreSQL/PostGIS. One remote project is sufficient
for the five-week prototype; a second Free project is optional for isolated
demo/testing. The local Supabase Docker stack is optional; the version-checked
Supabase CLI is the selected remote deployment tool.

**Why.** Managed operation removes the VPS, container, gateway, TLS, and dual-stack
work that does not differentiate the product. The team still owns migrations,
schema, RLS, SQL privileges, RPCs, Functions, Storage policies, secrets,
retention, and quota monitoring.

**Evolution strategy.** Phase 1 optimizes for learning speed and short feedback
loops, not for implementing the final backend in one pass. Build and validate one
vertical product flow at a time, evolving PostgreSQL, RLS, and RPC contracts through
ordered migrations with compatibility and regression tests. `db/schema.sql`
describes the target contract; it must not be applied monolithically to an existing
project. Managed Supabase reduces undifferentiated infrastructure work, but it does
not make later refactoring automatic or risk-free.

Add a standalone application API only when observed requirements justify its
operational cost—for example, substantial orchestration across external services,
long-running workflows that do not fit SQL or focused Edge Functions, a stable
versioned API shared by multiple independent clients, or a concrete portability
requirement. Schema size or hypothetical future scale alone is not sufficient
evidence. Until then, PostgREST plus narrow RPCs is the application API rather than
a temporary absence of one.

**Constraint.** PostgREST is the generated HTTP adapter, not a custom Controller.
SQL RPCs own transactional use cases, PostgreSQL owns persistence/RLS/PostGIS, and
Edge Functions remain limited to non-relational image work and external
integrations. No service key or database credential ships to the app.

**Trade-off.** Free has no automatic backups and may pause after inactivity. The
prototype requires milestone database dumps, a separate checksummed private-object
export, and a tested isolated restore procedure. A public production launch must
first adopt a plan or backup mechanism that meets the required RPO/RTO. Pricing
and quotas must be rechecked before the demo; no production SLA, PITR, or custom
domain is promised.

## ADR-017 — Optional Phase 2 visual duplicate suggestions

**Decision.** Phase 1 remains fully functional with heuristic candidates and
manual canonical resolution. If time remains, a temporary/serverless GPU may
produce one visual embedding per sanitized photo; a future migration may add
pgvector, and similarity is combined with time/distance filters to suggest
candidates. Human confirmation remains mandatory.

**Why.** Visual similarity can improve review ordering without making model output
authoritative or placing GPU cost in the Phase 1 critical path.

**Constraint.** No pgvector extension, embedding column/table, or GPU dependency is
part of the Phase 1 baseline schema. External ML integration belongs behind an
Edge Function.
