# Guidance for AI Coding Agents

This file orients any AI agent (or new contributor) working in this repo. Read it
before making changes.

## What this project is

A prototype mobile app for anonymous stray-dog sighting reports in Creel,
Chihuahua, for the Asociación de Hoteles de Chihuahua. Read `docs/product/` for
full context and `docs/architecture/OVERVIEW.md` for the system shape.

## Source of truth

- **Requirements**: the SRS ("Etapa 1. Requerimientos"), referenced throughout
  docs by requirement IDs (RF01–RF24 functional, RNF01–RNF36 non-functional,
  HU-01–HU-24 user stories).
- **Database**: `docs/DATA-MODEL.md` and the schema SQL. The schema is
  authoritative; do not invent columns or tables not described there without
  updating the docs.
- **Dynamic form**: the JSON contract in `docs/DATA-MODEL.md` defines what the
  `reports.details` field may contain per incident type. Honor it on both client
  and server.

## Non-negotiable constraints

These come from the requirements and the client's nature. Do not violate them
without an explicit decision recorded in `docs/architecture/DECISIONS.md`:

1. **No personal data from public reporters** (RNF13). Anonymous means anonymous —
   device fingerprint only, never name/email/phone.
2. **Offline-first** (RNF12). Report creation must work with no connection; the
   report holds its final UUID from creation, synced later.
3. **Defense in depth**: client-side validation is for UX; the database re-validates
   (location inside Creel, dynamic-form structure). Never rely on the client alone.
4. **Single-tenant, two roles**: Association and Administrator, both manually
   provisioned. No public sign-up for these roles (RF15, RF18, RNF07).
5. **Modest hardware**: no heavy ML on the server (4 vCPU / 8 GB RAM). Visual
   re-identification (DINOv2) is deferred to a future phase (RNF35).
6. **Row Level Security**: all data access separation goes through Postgres RLS
   plus the public view. Don't bypass it with the service_role key on the client.

## Conventions

- Documentation language: English. Product-facing SRS is Spanish; keep requirement
  IDs identical across both.
- Reference requirements by ID when implementing (e.g. "implements RF23").
- Secrets (service_role key, JWT secret) live in environment variables, never in
  the mobile client. The app uses only the anon key (RNF24).

## Where to look

| Need | File |
|---|---|
| Problem & goals | `docs/product/PROBLEM-CONTEXT.md`, `VISION.md` |
| What to build | `docs/product/HIGH-LEVEL-REQUIREMENTS.md` |
| Why decisions were made | `docs/architecture/DECISIONS.md` |
| DB schema & data contract | `docs/DATA-MODEL.md` |
| Security model | `docs/SECURITY.md` |
| Deploy | `docs/DEPLOYMENT.md` |
