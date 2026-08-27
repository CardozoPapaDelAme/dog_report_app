# Architecture Overview

## System shape

```
┌─────────────────────────────┐         ┌──────────────────────────────────────┐
│  Mobile app (React Native /  │         │  OVHcloud VPS (4 vCPU / 8 GB RAM)     │
│  Expo) — iOS & Android       │         │  Dokploy (PaaS)                       │
│                              │         │   └─ Traefik (reverse proxy, TLS)     │
│  • Camera-first report flow  │  HTTPS  │        │                              │
│  • On-device photo validate  │ ──────▶ │      Kong (Supabase gateway)          │
│  • On-device color extract   │         │        ├─ GoTrue (Auth / JWT)         │
│  • Offline queue + sync      │         │        ├─ PostgREST (auto REST API)   │
│  • Public map + clusters     │         │        ├─ Storage (photos)            │
│  • Dashboard (auth roles)    │ ◀────── │        └─ Studio (internal only)      │
└─────────────────────────────┘         │                                        │
                                         │      PostgreSQL + PostGIS              │
                                         │        • RLS policies                  │
                                         │        • triggers (geo, dup, form)     │
                                         │        • public_reports view           │
                                         └──────────────────────────────────────┘
```

## Components

**Mobile app (React Native + Expo)**
Single app serving three audiences: anonymous public (report + map), Association
(dashboard/export), Administrator (moderation). Bilingual ES/EN. Offline-first
report creation.

**Reverse proxy (Traefik, via Dokploy)**
Terminates TLS (Let's Encrypt, auto), routes to Kong. Internal Supabase ports
(Postgres, Kong, Studio) are not exposed to the internet.

**Supabase stack (self-hosted, Docker)**
- **GoTrue** — authentication, issues JWTs for the two roles.
- **PostgREST** — auto-generates the REST API from the Postgres schema.
- **Storage** — stores report photos.
- **Studio** — admin UI, internal access only.

**PostgreSQL + PostGIS**
The heart of the system. Holds all data, enforces access with RLS, and does real
work in triggers/functions: geofencing validation, dynamic-form validation,
duplicate detection, and map clustering.

## Data flow: creating a report

1. App opens on camera (RF07). User takes a photo.
2. On-device: dog/no-dog + quality check (RF09); color extraction (RF22). Runs
   offline.
3. User fills the dynamic form for the chosen incident type (RF24).
4. A client-generated UUID identifies the report (offline-first, RNF12).
5. On connectivity, the app syncs via PostgREST (anon key + RLS).
6. Server-side: triggers validate location is inside Creel, validate the `details`
   JSON structure, run duplicate detection, and (re)compute the confidence score.
7. The report appears on the public map (via the `public_reports` view) unless held
   for review.

## Access model

Three access levels, enforced by RLS + a restricted public view:

| Level | Sees | Can do |
|---|---|---|
| Anonymous (anon key) | Visible reports (via `public_reports`, no sensitive columns) | Create reports, file flags |
| Association | All reports incl. hidden | Read stats, export |
| Administrator | All reports + flags + duplicate queue | Hide/delete/restore, resolve queues |

## Where the logic lives

- **On device**: photo validation, color extraction, offline queue, form UX.
- **In the database**: access control (RLS), geofencing, form-structure validation,
  duplicate detection, clustering, auto-hide on flag threshold, audit logging.
- **Server-side (trigger or Edge Function)**: authoritative confidence score.

See `docs/DATA-MODEL.md` for the schema and `docs/SECURITY.md` for the security model.
