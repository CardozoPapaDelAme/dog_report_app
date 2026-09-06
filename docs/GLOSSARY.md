# Glossary

This file provides short vocabulary reminders. Nuanced behavior remains owned by
the linked contract documents.

## Actors and access

- **anonymous public reporter** — external actor using public report/map/flag
  features without an Auth account.
- **Association** — authenticated read-only business-intelligence role. It receives
  accepted canonical data and export, not moderation internals.
- **Administrator** — authenticated moderation role with specific audited commands
  and an explicit configuration-management exception. It does not inherit BI.
- **technical operator** — infrastructure/Auth operator who provisions accounts,
  deploys migrations, and performs recovery; not an application role.
- **service identity** — server-only identity used by Edge Functions/retention for
  narrow service RPCs; never embedded in the app.

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
- **SECURITY DEFINER** — function execution under a constrained owner; requires
  fixed search path and narrow grants.
- **Supabase managed boundary** — one provider-operated cloud boundary, logically
  decomposed into Auth, Data API/PostgREST, Edge Functions, Storage, and
  PostgreSQL/PostGIS without claiming physical internals.
- **PostgREST/Data API** — generated HTTP adapter exposing approved SQL functions;
  not a custom Controller-Service-Repository API.
- **image-specific Edge Function** — non-relational boundary that validates,
  decodes, and re-encodes image bytes without persisting the raw input.
- **private approved Storage** — private bucket holding sanitized output only;
  access requires an authorized short-lived delivery path.
- **managed Free project** — Supabase project used for the academic prototype;
  subject to current quotas, inactivity pausing, and no automatic backups.
- **demo/test geofence** — clearly labeled candidate geometry used for validation;
  it is not an Association-approved live boundary.

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
