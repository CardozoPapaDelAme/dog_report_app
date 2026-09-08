# Architecture Overview

This document owns the current architectural shape, component boundaries, and
responsibility split. Exact calls, persistent state, security controls, and
operations belong to their dedicated contracts.

## Current shape

One Expo mobile app uses Supabase Auth for sessions and one plain-JavaScript Hono
API for every domain operation. The API is deployed as the single Supabase Edge
Function `api`. Its API-oriented modules separate Controllers, Services,
Repositories, Domain, and JSON Presenters. Repositories issue parameterized SQL
directly through a least-privilege PostgreSQL connection; mobile domain access
never crosses PostgREST or exposed domain/service SQL functions.

```text
anonymous public reporter ─┐
Asociación de Hoteles de Chihuahua ─┼─> React Native / Expo development build
Administrator ─────────────┘     ├─ camera + bundled MobileNetV3-Small TFLite
                                 ├─ Expo SQLite queue + local photo file
                                 ├─ MapLibre online map
                                 └─ role-protected navigation
                                             │ HTTPS
                    ┌────────────────────────┴────────────────────────┐
                    │ Supabase Cloud — managed provider boundary      │
                     │ ├─ Auth (sessions)                              │
                     │ ├─ Edge Function api (Hono application)         │
                    │ ├─ private approved Storage                     │
                    │ └─ PostgreSQL + PostGIS                         │
                    └─────────────────────────────────────────────────┘
```

The decomposition is logical. It does not claim physical provider topology. One
remote Free project is sufficient for the five-week prototype; a second is
optional for isolated demo/testing.

## Responsibility boundary

| Team-owned | Supabase-owned |
|---|---|
| App; `api` Function; migrations/schema; RLS/grants; Storage policies; secrets/configuration; data lifecycle; quota monitoring | Physical hosts; managed gateway/Edge runtime; TLS; Auth/Storage/PostgreSQL operation |

## Application module boundary

```text
supabase/functions/api/
├── index.js                 # Edge entrypoint
├── app.js                   # Hono composition root and error presenter
├── routes/                  # method/path registration only
├── controllers/             # HTTP parse/validate/adapt
├── services/                # authz, policy, orchestration, transactions
├── repositories/            # parameterized SQL and Storage adapters
├── domain/                  # invariants, state machines, typed policies
├── presenters/              # stable JSON views/errors
├── middleware/              # request id, auth, limits, internal secret
└── infrastructure/          # postgres.js, JWT/JWKS, Storage, config
```

The tree is a future implementation contract; this repository change does not
create runtime source. Every domain flow follows Controller → Service → Repository
and returns through a Presenter. Services open short transactions and set
transaction-local `app.user_id` and `app.role` after authentication checks.
PostgreSQL retains constraints, RLS, grants, PostGIS, locks, append-only audit,
JSON validation, and narrow private atomic/set-based primitives.

## Actor boundaries

| Actor | Reads | Commands |
|---|---|---|
| anonymous public reporter | Recent visible canonical reports with approximate location; authorized sanitized photo delivery; own photo status | Submit/flag through `api`; upload optional normalized JPEG/PNG |
| Asociación de Hoteles de Chihuahua | Accepted canonical business data retained up to five years; authorized retained photos | None; dashboard/export are read-only |
| Administrator | Moderation, flag, trust, duplicate, photo, and configuration context | Audited moderation, duplicate, zone, and threshold commands |
| technical operator | Managed project and Auth administration | Provision/deactivate accounts; link/apply migrations; deploy `api`; exports/restores |
| scheduler | No UI | Call the cron-secret-gated retention route; never access domain tables directly |

Asociación de Hoteles de Chihuahua and Administrator are sibling roles. Administrator does not inherit
analytics/export. Its configuration commands are an explicit exception to its
otherwise moderation-focused scope.

## Contract handoff

| Concern | Authoritative detail |
|---|---|
| HTTP routes, schemas, presenters, and errors | [`../API.md`](../API.md) |
| Entities, state machines, duplicate semantics, and retention | [`../DATA-MODEL.md`](../DATA-MODEL.md) |
| Authorization, privacy, and threat controls | [`../SECURITY.md`](../SECURITY.md) |
| Technology selections | [`../STACK.md`](../STACK.md) |
| External dependencies and fallbacks | [`../INTEGRATIONS.md`](../INTEGRATIONS.md) |
| Deployment and operations | [`../DEPLOYMENT.md`](../DEPLOYMENT.md) |

The mobile queue remains separate from server moderation state. Public location
is privacy-minimized. Media and retention are modules of the same `api` Function,
not separate domain boundaries. The linked contracts define those rules precisely.
