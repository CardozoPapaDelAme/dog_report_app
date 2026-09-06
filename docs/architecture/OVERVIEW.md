# Architecture Overview

This document owns the current architectural shape, component boundaries, and
responsibility split. Exact calls, persistent state, security controls, and
operations belong to their dedicated contracts.

## Current shape

One Expo mobile app uses Supabase managed Free directly. Supabase Auth and the
generated Data API/PostgREST transport expose narrow SQL RPCs; there is no
redundant custom Controller-Service-Repository API. PostgreSQL/PostGIS owns
transactional use cases, persistence, RLS, geofencing, moderation, duplicate
resolution, and projections. Edge Functions are limited to non-relational image
work and future external integrations.

```text
anonymous public reporter ─┐
Association ───────────────┼─> React Native / Expo development build
Administrator ─────────────┘     ├─ camera + bundled MobileNetV3-Small TFLite
                                 ├─ Expo SQLite queue + local photo file
                                 ├─ MapLibre online map
                                 └─ role-protected navigation
                                             │ HTTPS
                    ┌────────────────────────┴────────────────────────┐
                    │ Supabase Cloud — managed provider boundary      │
                    │ ├─ Auth                                         │
                    │ ├─ Data API / PostgREST (generated RPC adapter) │
                    │ ├─ Edge Functions (image/external integrations) │
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
| App; versioned migrations and schema; RLS/grants; RPCs; Edge Function code; Storage policies; secrets/configuration; data lifecycle; quota monitoring | Physical hosts; managed gateway/runtime; TLS; managed service operation |

## Actor boundaries

| Actor | Reads | Commands |
|---|---|---|
| anonymous public reporter | Recent visible canonical reports with approximate location; authorized sanitized photo delivery; own photo processing status | Submit a report; send the optional photo to the image Function; flag a visible canonical report |
| Association | Accepted canonical business data retained up to five years; authorized retained photos | None; dashboard/export are read-only |
| Administrator | Moderation, flag, trust, duplicate, photo, and configuration context | Audited moderation, duplicate, zone, and threshold commands |
| technical operator | Managed project and Auth administration | Provision/deactivate accounts; link/deploy migrations and Functions; exports/restores |
| image/retention service identity | No UI | Record image processing outcomes, authorize private delivery, apply trust input, and run retention |

Association and Administrator are sibling roles. Administrator does not inherit
analytics/export. Its configuration commands are an explicit exception to its
otherwise moderation-focused scope.

## Contract handoff

| Concern | Authoritative detail |
|---|---|
| RPCs, transport, and image endpoints | [`../API.md`](../API.md) |
| Entities, state machines, duplicate semantics, and retention | [`../DATA-MODEL.md`](../DATA-MODEL.md) |
| Authorization, privacy, and threat controls | [`../SECURITY.md`](../SECURITY.md) |
| Technology selections | [`../STACK.md`](../STACK.md) |
| External dependencies and fallbacks | [`../INTEGRATIONS.md`](../INTEGRATIONS.md) |
| Deployment and operations | [`../DEPLOYMENT.md`](../DEPLOYMENT.md) |

The mobile queue remains separate from server moderation state, public location is
privacy-minimized, and the image Function is a specialized boundary rather than a
generic business API. The linked contracts define those rules precisely.
