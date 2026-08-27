# Documentation Index

## Product (`product/`)

The "why" and "what" — read in roughly this order:

1. `product/PROBLEM-CONTEXT.md` — the problem being solved and who it's for
2. `product/VISION.md` — where this is headed
3. `product/HIGH-LEVEL-REQUIREMENTS.md` — functional & non-functional requirements
4. `product/SOLUTION-EXPLORATION.md` — options considered and why this approach
5. `product/ROADMAP.md` — prototype scope vs. future phases
6. `product/README.md` — product-area index

## Architecture (`architecture/`)

- `architecture/OVERVIEW.md` — system shape, components, data flow
- `architecture/DECISIONS.md` — decision records (ADRs) with rationale

## Technical references (this folder)

- `DATA-MODEL.md` — database schema, tables, dynamic-form JSON contract
- `API.md` — API surface (preliminary; PostgREST-generated)
- `STACK.md` — technology choices and rationale
- `SECURITY.md` — security model: RLS, anti-abuse, hardening
- `DEPLOYMENT.md` — deployment via Dokploy + Supabase self-hosted
- `INTEGRATIONS.md` — third-party integrations (preliminary)
- `TESTING.md` — testing strategy (preliminary)
- `GLOSSARY.md` — domain and technical terms

## Requirement ID conventions

- **RF** — Functional Requirement (RF01–RF24)
- **RNF** — Non-Functional Requirement (RNF01–RNF36)
- **HU** — User Story / Historia de Usuario (HU-01–HU-24)

The canonical requirements live in the SRS ("Etapa 1. Requerimientos"). Docs here
reference those IDs; keep them consistent if the SRS changes.
