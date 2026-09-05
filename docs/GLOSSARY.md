# Glossary

## Actors and access

- **anonymous public reporter** — external actor using public report/map/flag
  features without an Auth account.
- **Association** — authenticated read-only business-intelligence role. It receives
  accepted canonical data and export, not moderation internals.
- **Administrator** — authenticated moderation role with specific audited commands
  and an explicit configuration-management exception. It does not inherit BI.
- **technical operator** — infrastructure/Auth operator who provisions accounts,
  deploys migrations, and performs recovery; not an application role.
- **trusted worker** — server identity for image processing, trust application, and
  retention; never embedded in the app.

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
- **quarantine** — private untrusted-image area before server decode/re-encoding.
- **Envoy** — default self-hosted Supabase API gateway in the pinned prototype.
  Kong is an optional override, not the baseline.
- **Production/Staging** — isolated Supabase stacks sharing one physical VPS.

## Requirement identifiers

- **RF** — functional requirement, RF01–RF24.
- **RNF** — non-functional requirement, RNF01–RNF36.
- **HU** — user story, HU-01–HU-24.

Their relationships are many-to-many; see `TRACEABILITY.md`.
