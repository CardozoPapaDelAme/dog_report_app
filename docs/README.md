# Documentation Index and Precedence

This file owns global documentation navigation and the source-of-truth order. Use
the topic map below instead of treating summary documents as competing contracts.

## Source-of-truth order

| Priority | Source | Purpose |
|---|---|---|
| 1 | [`product/APPROVED-CLARIFICATIONS.md`](product/APPROVED-CLARIFICATIONS.md) | Approved amendments; later numbered decisions govern conflicts |
| 2 | [`product/ETAPA1-REQUERIMIENTOS-V2.md`](product/ETAPA1-REQUERIMIENTOS-V2.md) | Normative consolidated SRS |
| 3 | [`../Etapa 1. Requerimientos.pdf`](../Etapa%201.%20Requerimientos.pdf), [`product/ETAPA1-REQUERIMIENTOS.md`](product/ETAPA1-REQUERIMIENTOS.md) | Historical wording and immutable identifiers |
| 4 | [`API.md`](API.md), [`../db/schema.sql`](../db/schema.sql) | Peer exact HTTP and persistence contracts |
| 5 | [`DATA-MODEL.md`](DATA-MODEL.md), [`architecture/DECISIONS.md`](architecture/DECISIONS.md) | Persistent semantics and technical rationale |

No summary document outranks these sources. RF/RNF/HU links are many-to-many;
use [`TRACEABILITY.md`](TRACEABILITY.md) rather than inferring one-to-one
relationships.

## Recommended reading path

1. [`product/README.md`](product/README.md)
2. [`architecture/OVERVIEW.md`](architecture/OVERVIEW.md)
3. [`API.md`](API.md) and [`DATA-MODEL.md`](DATA-MODEL.md)
4. [`SECURITY.md`](SECURITY.md) and [`DEPLOYMENT.md`](DEPLOYMENT.md)
5. [`TESTING.md`](TESTING.md) and [`TRACEABILITY.md`](TRACEABILITY.md)
6. [`DIAGRAM-READINESS.md`](DIAGRAM-READINESS.md)

## Product

- [`product/README.md`](product/README.md) — product navigation and authority
- [`product/ETAPA1-REQUERIMIENTOS.md`](product/ETAPA1-REQUERIMIENTOS.md) — immutable Spanish SRS transcription
- [`product/ETAPA1-REQUERIMIENTOS-V2.md`](product/ETAPA1-REQUERIMIENTOS-V2.md) — normative consolidated SRS
- [`product/APPROVED-CLARIFICATIONS.md`](product/APPROVED-CLARIFICATIONS.md) — approved amendments
- [`product/PROBLEM-CONTEXT.md`](product/PROBLEM-CONTEXT.md) — problem, stakeholders, and current gap
- [`product/VISION.md`](product/VISION.md) — outcomes, principles, and success
- [`product/HIGH-LEVEL-REQUIREMENTS.md`](product/HIGH-LEVEL-REQUIREMENTS.md) — capability-level orientation
- [`product/SOLUTION-EXPLORATION.md`](product/SOLUTION-EXPLORATION.md) — alternatives considered
- [`product/ROADMAP.md`](product/ROADMAP.md) — phases, dependencies, and exit gates
- [`product/GEOFENCE-CANDIDATE.md`](product/GEOFENCE-CANDIDATE.md) — candidate provenance and approval procedure

## Architecture and technical contracts

- [`architecture/OVERVIEW.md`](architecture/OVERVIEW.md) — current shape, components, and responsibilities
- [`architecture/DECISIONS.md`](architecture/DECISIONS.md) — accepted and superseded rationale
- [`STACK.md`](STACK.md) — selected technologies and why they are present
- [`INTEGRATIONS.md`](INTEGRATIONS.md) — external contracts and fallbacks
- [`API.md`](API.md) — Hono HTTP consumer contract
- [`DATA-MODEL.md`](DATA-MODEL.md) — entity, state, and retention semantics
- [`SECURITY.md`](SECURITY.md) — security, privacy, and threat controls
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — deployment and operations runbook
- [`TESTING.md`](TESTING.md) — verification strategy and scenario ownership
- [`TRACEABILITY.md`](TRACEABILITY.md) — complete RF/RNF/HU mapping
- [`DIAGRAM-READINESS.md`](DIAGRAM-READINESS.md) — diagram handoff and review checklist
- [`diagrams/README.md`](diagrams/README.md) — versioned diagram sources; add a file only when that diagram is requested
- [`GLOSSARY.md`](GLOSSARY.md) — vocabulary
- [`design/DESIGN.md`](design/DESIGN.md) — visual design system, tokens, and UI components

## Identifier ranges

- Functional requirements: RF01–RF24
- Non-functional requirements: RNF01–RNF36
- User stories: HU-01–HU-24
