# Diagram Handoff and Review Checklist

This document owns only diagram readiness, source handoff, and acceptance checks.
It does not define architecture. **Contract input is ready; diagrams are not marked
complete until their source files are delivered and checked below.** Versioned
sources live in [`diagrams/README.md`](diagrams/README.md) and are created only
when a specific diagram is requested.

## Source handoff

| Diagram | Read these owners before drawing | Contract input ready |
|---|---|---:|
| System context and components | [`architecture/OVERVIEW.md`](architecture/OVERVIEW.md), [`product/APPROVED-CLARIFICATIONS.md`](product/APPROVED-CLARIFICATIONS.md) | Yes |
| Deployment and operations | [`DEPLOYMENT.md`](DEPLOYMENT.md), [`STACK.md`](STACK.md), [`INTEGRATIONS.md`](INTEGRATIONS.md) | Yes |
| Report and image sequence | [`API.md`](API.md), [`DATA-MODEL.md`](DATA-MODEL.md), [`SECURITY.md`](SECURITY.md) | Yes |
| Moderation and duplicate states | [`DATA-MODEL.md`](DATA-MODEL.md) | Yes |
| Authorization | [`SECURITY.md`](SECURITY.md), [`API.md`](API.md) | Yes |
| ERD | [`../db/schema.sql`](../db/schema.sql), [`DATA-MODEL.md`](DATA-MODEL.md) | Yes |
| Requirement/activity coverage | [`TRACEABILITY.md`](TRACEABILITY.md), [`product/ETAPA1-REQUERIMIENTOS.md`](product/ETAPA1-REQUERIMIENTOS.md) | Yes |

## Remaining input

| Item | Blocks diagrams? | Owner |
|---|---|---|
| Association approval of a live geofence checksum/version | No. Draw the gate; demo may use a labeled candidate fixture | Association |
| Exact managed Auth/Storage catalog columns | Only for provider-internal physical ERDs, which are out of scope | Operator/provider docs |
| Optional second Free project | No. One project is sufficient | Team |
| Teammates' Mermaid sources | No for target contract; review later without changing current files | Team |
| Expo/React Native package versions | No for backend diagrams | Mobile implementation |

## Checklist

- [ ] Diagram scope and terminology match [`architecture/OVERVIEW.md`](architecture/OVERVIEW.md).
- [ ] Every call and return state matches [`API.md`](API.md); no invented route or service is shown.
- [ ] Persistent states and transitions match [`DATA-MODEL.md`](DATA-MODEL.md).
- [ ] Trust boundaries, private data, and actor permissions match [`SECURITY.md`](SECURITY.md).
- [ ] Deployment and recovery steps match [`DEPLOYMENT.md`](DEPLOYMENT.md) without inventing provider internals.
- [ ] ERD names and relationships match [`../db/schema.sql`](../db/schema.sql); provider-owned schemas remain external.
- [ ] The live geofence is shown as externally approval-gated, not already approved.
- [ ] Relevant RF/RNF/HU rows in [`TRACEABILITY.md`](TRACEABILITY.md) are covered.
