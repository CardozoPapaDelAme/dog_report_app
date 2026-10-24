# Deployment Diagram

Managed deployment boundary for Phase 1. The Supabase decomposition is logical
(Auth, one Edge Function `api`, Storage, PostgreSQL/PostGIS); it does not claim
physical provider internals. Sources: `docs/architecture/OVERVIEW.md`,
`docs/INTEGRATIONS.md`, `docs/DEPLOYMENT.md`, `eas.json`.

```mermaid
flowchart LR
  subgraph Device["Phone (Android / iOS)"]
    App["Expo development build<br/>React Native app<br/>SQLite queue + TFLite model"]
  end

  subgraph EAS["Expo Application Services"]
    Build["EAS Build<br/>profiles: development, preview, production"]
  end

  subgraph Supabase["Supabase Cloud, managed Free (staging project)"]
    Auth["Auth<br/>staff sessions, JWT"]
    API["Edge Function api<br/>Hono: Controllers, Services,<br/>Repositories, Presenters"]
    DB[("PostgreSQL + PostGIS<br/>RLS, app_backend NOBYPASSRLS")]
    Storage[("Storage<br/>private approved-photos bucket")]
  end

  Tiles["OpenFreeMap<br/>vector style and tiles (no key)"]
  Uptime["External uptime monitor<br/>GET /functions/v1/api/health"]
  Dev["Developer machine / CI<br/>Supabase CLI, GitHub Actions"]

  Build -- "APK / install link" --> App
  App -- "HTTPS: login, refresh" --> Auth
  App -- "HTTPS JSON: every domain call" --> API
  App -- "HTTPS: map style and tiles" --> Tiles
  API -- "JWKS / JWT check" --> Auth
  API -- "parameterized SQL via pooler" --> DB
  API -- "server credential: sanitized images" --> Storage
  Uptime -- "HTTP probe" --> API
  Dev -- "db push, functions deploy api --use-api" --> Supabase
```

Notes:

- The mobile app never reaches PostgreSQL or Storage directly; it only holds the
  publishable client configuration (`EXPO_PUBLIC_*`).
- Production does not exist yet: it stays blocked (fail-closed) until the
  Asociación de Hoteles de Chihuahua approves a geofence version.
