# Creel Stray Dog Reporting App

Cross-platform mobile app for anonymous reporting and Business Intelligence on
stray/feral dogs in Creel, Chihuahua, Mexico. Built for the **Asociación de
Hoteles de Chihuahua, A.C.**

Anyone (tourist or resident) can submit an anonymous, photo-backed sighting
report. Reports feed a public map and a private BI dashboard used by the
Association to design strategies for reducing stray dog presence in the tourist
zone (Barrancas del Cobre region).

## Status

Prototype. Requirements (SRS Etapa 1) complete; database schema and data
contracts defined; implementation starting.

## Documentation map

Start here, then drill down:

- `docs/README.md` — index of all documentation
- `docs/product/` — the "why" and "what": problem, vision, requirements, roadmap
- `docs/architecture/` — high-level system overview and decision records (ADRs)
- `docs/DATA-MODEL.md` — database schema, tables, and the dynamic-form JSON contract
- `docs/STACK.md` — technology choices
- `docs/SECURITY.md` — security model (RLS, anti-abuse, hardening)
- `docs/DEPLOYMENT.md` — how it's deployed (Dokploy + Supabase self-hosted)
- `AGENTS.md` / `CLAUDE.md` — guidance for AI coding agents working in this repo

## Tech stack (short version)

React Native (Expo) · Supabase self-hosted (Docker, via Dokploy) on an OVHcloud
VPS · PostgreSQL + PostGIS · Row Level Security. See `docs/STACK.md` for the full
picture and rationale.

## Key constraints to keep in mind

- **Offline-first**: reports are created and stored offline, synced on reconnect.
- **Anonymous public layer**: no personal data collected from reporters.
- **Single-tenant**: the Association is the only administrator; two authenticated
  roles (Association, Administrator) plus anonymous public access.
- **Bilingual**: Spanish/English across all flows.
- **Modest hardware**: 4 vCPU / 8 GB RAM VPS — heavy ML (e.g. visual
  re-identification) is explicitly out of scope for the prototype.
