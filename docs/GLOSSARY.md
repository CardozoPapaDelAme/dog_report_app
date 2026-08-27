# Glossary

## Domain

- **Association** — Asociación de Hoteles de Chihuahua, A.C. The nonprofit client and
  sole system administrator.
- **Report** — an anonymous sighting/incident record (dog present, incident type,
  location, optional photo).
- **Incident type** — category of a report: `avistamiento_simple`, `ataque_mascota`,
  `ataque_ganado`, `ataque_humano`, `perro_lastimado`, `otro`.
- **Sighting type** — `solitario` (lone dog) or `manada` (pack).
- **Flag** — a user marking a report as invalid (fake, inappropriate, mockery, or not
  a stray).
- **Creel** — the tourist town in Chihuahua; the geographic scope of the system.

## Roles

- **Anonymous public** — any reporter/viewer, no login.
- **Administrator** — moderates reports (hide/delete/restore, review queues).
- **Association account** — reads BI/stats, exports data.

## Technical

- **RF / RNF / HU** — Functional Requirement / Non-Functional Requirement / User Story
  (Historia de Usuario), from the SRS.
- **Single-tenant** — one administrator/organization; city/zone is a data attribute,
  not a tenant boundary.
- **Offline-first** — reports are created and stored on-device without connectivity
  and synced later.
- **RLS (Row Level Security)** — PostgreSQL feature restricting which rows a role can
  access.
- **PostGIS** — PostgreSQL extension for geospatial data/queries.
- **Geofencing** — restricting/validating reports to within Creel's polygon.
- **Device fingerprint** — an anonymous device identifier used for rate limiting; does
  not identify the person.
- **Honeypot field** — a hidden form field; if filled, the submission is likely a bot.
- **Confidence score** — a per-report 0–1 score from multiple signals deciding
  publish/review/discard.
- **Mock location / GPS spoofing** — faking device GPS; detected/flagged.
- **Cluster** — a group of nearby reports rendered as one circle on the map.
- **`details` (JSONB)** — the dynamic-form answers, structured per incident type.

## Stack

- **Supabase (self-hosted)** — the backend stack (GoTrue, PostgREST, Storage, Studio)
  run in Docker on the VPS.
- **GoTrue** — Supabase's auth service (issues JWTs).
- **PostgREST** — auto-generates the REST API from the schema.
- **Kong** — Supabase's internal API gateway.
- **Dokploy** — open-source self-hosted PaaS used to deploy and manage the stack.
- **Traefik** — reverse proxy (via Dokploy) handling TLS and routing.
- **OVHcloud VPS** — the server host (Beauharnois region).
- **LFPDPPP** — Mexican federal data-protection law (Ley Federal de Protección de
  Datos Personales en Posesión de los Particulares).

## Future-phase

- **DINOv2** — a vision model (embeddings) considered for visual dog
  re-identification in a future phase (RNF35).
- **pgvector** — PostgreSQL extension for vector similarity search (future phase).
- **Embedding** — a numeric vector representing an image's visual features.
- **Re-identification** — determining whether two photos show the same individual dog
  (future phase, not in prototype).
