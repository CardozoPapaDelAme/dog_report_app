# Roadmap

This document owns phase order, dependencies, and exit gates. Architecture,
technology selection, and operational commands belong to their linked owners.

## Prototype sequence

| Phase | Outcome | Depends on | Exit gate |
|---|---|---|---|
| 1. Foundations | Buildable mobile shell, ordered migrations, contract clients, and test harnesses | Approved contracts | Schema dry-run and baseline authorization tests pass |
| 2. Public reporting | Durable anonymous report flow with optional evidence and recovery | Phase 1 | Offline restart and idempotent sync scenarios pass |
| 3. Trusted ingestion | Server validation, trust routing, private delivery, and cleanup compensation | Phases 1–2 | Image, abuse, privacy, and failure-recovery scenarios pass |
| 4. Public map | Privacy-preserving reports, clusters, and offline-unavailable UX | Phases 1–3 | Map correctness, privacy, and performance targets pass |
| 5. Authenticated flows | Separate Association and Administrator capabilities | Phases 1–4 | Cross-role negative tests and audit scenarios pass |
| 6. Operational readiness | Deployable, observable, recoverable prototype | All prior phases | Managed-project smoke tests and isolated restore rehearsal pass |

## External gate

Live report intake cannot launch until the Association approves a geofence
version. [`GEOFENCE-CANDIDATE.md`](GEOFENCE-CANDIDATE.md) defines the candidate and
approval procedure.

## Deferred

- 99.9% SLA and high availability/multi-node recovery.
- Optional Phase 2 visual duplicate suggestions: temporary/serverless GPU plus a
  future pgvector migration, always combined with time/distance and human review.
- Production SLA/PITR/custom domain and a backup mechanism that proves the
  required RPO/RTO.
- Multi-city/multi-tenant or per-hotel accounts.
- Sterilization-campaign tracking, push notifications, and direct authority APIs.

## Start gate

Implementation starts from migrations derived from [`../../db/schema.sql`](../../db/schema.sql),
with planned tests for every [`TRACEABILITY.md`](../TRACEABILITY.md) row. Deployment
commands and tool-version requirements belong to [`../DEPLOYMENT.md`](../DEPLOYMENT.md).
