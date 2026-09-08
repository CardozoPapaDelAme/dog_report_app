# Glossary

This file provides short vocabulary reminders. Nuanced behavior remains owned by
the linked contract documents.

## Actors and access

- **anonymous public reporter** — external actor using public report/map/flag
  features without an Auth account.
- **Asociación de Hoteles de Chihuahua** — authenticated read-only business-intelligence role. It receives
  accepted canonical data and export, not moderation internals.
- **Administrator** — authenticated moderation role with specific audited commands
  and an explicit configuration-management exception. It does not inherit BI.
- **technical operator** — infrastructure/Auth operator who provisions accounts,
  deploys migrations, and performs recovery; not an application role.
- **scheduler** — server-only caller of the cron-secret-gated retention route;
  never embedded in the app and never granted database access.
- **app_backend** — least-privilege PostgreSQL login used only by `api`; it is
  `NOBYPASSRLS`, owns no application objects, and is never shipped to clients.

## Data and workflow

- **accepted** — server-approved business record.
- **visible** — accepted report eligible for authorized business use; public use
  additionally requires an unexpired 90-day window and canonical disposition.
- **logical deletion** — reversible non-public state; retention performs later hard
  deletion.
- **canonical report** — human-selected representative of a confirmed duplicate
  group. Evidence on other members remains linked.
- **local queue state** — device transport progress; unrelated to server moderation.
- **raw EXIF** — source image metadata processed transiently and never stored.
- **derived EXIF signal** — minimized scalar consistency score produced by the
  trusted image boundary.
- **stable public approximation** — deterministic point snapped to a 50 m metric
  grid, identical across requests.

## Platform

- **Expo development build** — custom native app build required for MapLibre and
  TFLite modules; unlike Expo Go, it contains project native dependencies.
- **MapLibre React Native** — chosen native online map renderer.
- **TFLite** — bundled on-device model format used through
  `react-native-fast-tflite`.
- **RLS** — row-level PostgreSQL authorization; used with, not instead of, SQL
  GRANT/REVOKE.
- **transaction-local actor context** — `app.user_id` and `app.role` values set by
  a Service inside one transaction after authentication; RLS fails closed when
  absent or inconsistent.
- **Supabase managed boundary** — one provider-operated cloud boundary, logically
  decomposed into Auth, Edge Function `api`, Storage, and
  PostgreSQL/PostGIS without claiming physical internals.
- **Hono API** — the only domain HTTP boundary, deployed as one plain-JavaScript
  Supabase Edge Function named `api`.
- **Controller / Service / Repository / Domain / Presenter** — respectively HTTP
  adaptation; policy/orchestration/transactions; parameterized persistence;
  invariants; and stable JSON shaping.
- **image route** — module inside `api` that validates, decodes, and re-encodes
  JPEG/PNG bytes without persisting raw input.
- **purge_pending** — durable photo state discoverable by RetentionService until
  private object deletion succeeds and is acknowledged.
- **private approved Storage** — private bucket holding sanitized output only;
  access requires an authorized short-lived delivery path.
- **managed Free project** — Supabase project used for the academic prototype;
  subject to current quotas, inactivity pausing, and no automatic backups.
- **demo/test geofence** — clearly labeled candidate geometry used for validation;
  it is not an Asociación de Hoteles de Chihuahua-approved live boundary.

## Requirement identifiers

- **RF** — functional requirement, RF01–RF24.
- **RNF** — non-functional requirement, RNF01–RNF36.
- **HU** — user story, HU-01–HU-24.

Their relationships are many-to-many; see
[`TRACEABILITY.md`](TRACEABILITY.md).

## Contract owners

- Actor permissions and security terms: [`SECURITY.md`](SECURITY.md)
- State and data terms: [`DATA-MODEL.md`](DATA-MODEL.md)
- Platform shape: [`architecture/OVERVIEW.md`](architecture/OVERVIEW.md)
- Requirement relationships: [`TRACEABILITY.md`](TRACEABILITY.md)
