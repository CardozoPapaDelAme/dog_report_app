# Technology Stack

This document owns selected technologies and why each is present. It does not
define deployment steps or external-service operating contracts; see
[`DEPLOYMENT.md`](DEPLOYMENT.md) and [`INTEGRATIONS.md`](INTEGRATIONS.md).

| Layer | Selected technology | Why it is present |
|---|---|---|
| Mobile runtime | React Native with Expo development/release builds | One native iOS/Android codebase with required custom modules |
| Localization | `react-i18next` | Bilingual flows with structured translation resources |
| Offline metadata | Expo SQLite | Transactional, restart-safe drafts and queue state |
| Offline images | App-private local files | Durable media without storing image blobs in SQLite |
| Map renderer | `@maplibre/maplibre-react-native` | Native vector-map rendering and interaction |
| Map provider | MapTiler Cloud | Hosted online styles and vector tiles |
| On-device vision | `react-native-fast-tflite` with MobileNetV3-Small INT8 | Offline dog/quality assistance with a bundled model |
| Managed platform | Supabase Cloud Free | Prototype Auth, Data API, Functions, Storage, and PostgreSQL boundary |
| Data transport | Supabase Data API/PostgREST | Generated HTTP transport for narrow SQL RPCs |
| Database | PostgreSQL with PostGIS/pgcrypto | Transactional, spatial, authorization, and integrity rules |
| Image processing | Supabase Edge Functions | Decode/re-encode work that does not belong in SQL |
| Object storage | Supabase private Storage | Sanitized image output behind authorized delivery |
| Deployment tools | Supabase CLI, `psql`, and Docker where required | Versioned remote changes and rehearsable recovery |

## Selection boundaries

- Native map and TFLite modules require Expo development/release builds, not Expo Go.
- The local Supabase stack is optional; selected deployment procedures remain in
  [`DEPLOYMENT.md`](DEPLOYMENT.md).
- Version, license, quota, and benchmark evidence are release work owned by
  [`TESTING.md`](TESTING.md).
- Optional Phase 2 visual similarity is not part of this selected Phase 1 stack;
  see [ADR-017](architecture/DECISIONS.md#adr-017--optional-phase-2-visual-duplicate-suggestions).
