# Integrations and External Boundaries

This document owns contracts with external providers, datasets, and optional
services, including release gates and degraded behavior. Technology selection
itself belongs to [`STACK.md`](STACK.md).

## External contract matrix

| Dependency | Contract | Failure or fallback | Release gate |
|---|---|---|---|
| Supabase managed Free | Hosts Auth sessions, Edge Function `api`, private Storage, PostgreSQL/PostGIS, secrets, TLS, and gateway; the team owns application authorization and lifecycle | Detect pause/quota/service failure; retain queued reports and show unavailable online features | Recheck plan limits/catalogs; verify JWT mode, pooler, codec, scheduler, access, and recovery |
| MapTiler Cloud | Supplies online vector styles/tiles through restricted public client configuration with required attribution | Map becomes explicitly unavailable; reporting remains usable | Approve attribution, key restrictions, quota, and expected cost |
| INEGI | Supplies reproducible candidate geometry and provenance, not live-boundary authority | Live intake remains fail-closed without Asociación de Hoteles de Chihuahua approval | Follow [`product/GEOFENCE-CANDIDATE.md`](product/GEOFENCE-CANDIDATE.md) |
| Optional Phase 2 compute | May generate visual-similarity suggestions from sanitized images | Phase 1 heuristic/manual duplicate review continues unchanged | Separate future approval, privacy review, and migration |

Supabase operational commands belong to [`DEPLOYMENT.md`](DEPLOYMENT.md); all
domain endpoint contracts belong to [`API.md`](API.md).

## Explicit non-integrations

No direct government feed, push provider, second domain API, direct mobile
database boundary, or individual-dog identity service is part of Phase 1.
Asociación de Hoteles de Chihuahua export remains CSV/Excel from its approved projection rather than an
external integration.
