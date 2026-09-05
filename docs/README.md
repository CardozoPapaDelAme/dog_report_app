# Documentation Index and Precedence

## Source-of-truth order

| Priority | Source | Purpose |
|---|---|---|
| 1 | `../Etapa 1. Requerimientos.pdf` and `product/ETAPA1-REQUERIMIENTOS.md` | Immutable original SRS and identifiers |
| 2 | `product/APPROVED-CLARIFICATIONS.md` | Approved amendments where the SRS is ambiguous or superseded |
| 3 | `../db/schema.sql` and `DATA-MODEL.md` | Authoritative target schema, state, projections, and commands |
| 4 | `architecture/DECISIONS.md` | Technical rationale and accepted trade-offs |

No summary document outranks these sources. RF/RNF/HU links are many-to-many;
use `TRACEABILITY.md` rather than inferring one-to-one relationships.

## Recommended reading path

1. [`product/README.md`](product/README.md)
2. [`architecture/OVERVIEW.md`](architecture/OVERVIEW.md)
3. [`API.md`](API.md) and [`DATA-MODEL.md`](DATA-MODEL.md)
4. [`SECURITY.md`](SECURITY.md) and [`DEPLOYMENT.md`](DEPLOYMENT.md)
5. [`TESTING.md`](TESTING.md) and [`TRACEABILITY.md`](TRACEABILITY.md)
6. [`DIAGRAM-READINESS.md`](DIAGRAM-READINESS.md)

## Product

- `product/ETAPA1-REQUERIMIENTOS.md` — faithful Spanish transcription
- `product/APPROVED-CLARIFICATIONS.md` — approved implementation amendments
- `product/GEOFENCE-CANDIDATE.md` — reproducible INEGI candidate and approval gate
- `product/HIGH-LEVEL-REQUIREMENTS.md` — English orientation summary
- `product/PROBLEM-CONTEXT.md`, `VISION.md`, `SOLUTION-EXPLORATION.md`, `ROADMAP.md`

## Architecture and technical contracts

- `architecture/OVERVIEW.md` — components and principal flows
- `architecture/DECISIONS.md` — ADRs
- `API.md` — command/projection boundary
- `DATA-MODEL.md` — data, state machines, duplicates, retention
- `STACK.md`, `INTEGRATIONS.md`, `SECURITY.md`, `DEPLOYMENT.md`
- `TESTING.md`, `TRACEABILITY.md`, `DIAGRAM-READINESS.md`

## Identifier ranges

- Functional requirements: RF01–RF24
- Non-functional requirements: RNF01–RNF36
- User stories: HU-01–HU-24
