# Repository Guidance for Coding Agents

Read this file before changing the project.

## Source precedence

1. `Etapa 1. Requerimientos.pdf` and
   `docs/product/ETAPA1-REQUERIMIENTOS.md` preserve the original SRS and IDs.
2. `docs/product/APPROVED-CLARIFICATIONS.md` governs approved amendments.
3. `db/schema.sql` is the authoritative target schema and API/data boundary;
   `docs/DATA-MODEL.md` explains it.
4. `docs/architecture/DECISIONS.md` records rationale and constraints.

Never rewrite the SRS body to conceal a later decision. Update clarifications,
schema/data contract, ADRs, traceability, and tests together.

## Non-negotiable architecture

- Use the actor terms **anonymous public reporter**, **Association**, and
  **Administrator**. The authenticated roles are siblings, not a hierarchy.
- Multiple individual accounts are allowed per role. They are manually
  provisioned by a technical operator. Public signup and in-app account
  management stay disabled.
- Association receives accepted canonical business data only. Administrator does
  not inherit BI/export and acts through specific audited commands.
- Clients never write tables directly or set moderation, trust, timestamp, audit,
  retention, or duplicate-resolution fields. Use the RPC contracts in `API.md`.
- RLS and SQL privileges are both mandatory. Never ship `service_role` or other
  server credentials to the mobile app.
- Raw EXIF is transient input and must never be persisted. Public images are
  sanitized; public positions use the stable 50 m approximation.
- Logical deletion is reversible. Hard deletion occurs only in retention jobs.
- Keep local queue states separate from server moderation states.
- Production geofence activation requires explicit Association approval; do not
  add placeholder coordinates.

## Implementation coordination

- Preserve RF/RNF/HU identifiers exactly and update `docs/TRACEABILITY.md` when a
  flow, API, data component, or test mapping changes.
- Update `db/schema.sql` through migrations when implementation starts; do not
  apply the monolithic target blindly to an existing database.
- Native modules mean Expo development builds, not Expo Go.
- Every admin/configuration mutation must remain validated, versioned where
  applicable, and audited.
- Storage schemas are Supabase-owned. Verify the installed version before writing
  Storage migrations or policies; do not invent columns or behavior.

## Navigation

| Concern | Source |
|---|---|
| Product amendments | `docs/product/APPROVED-CLARIFICATIONS.md` |
| Architecture and ADRs | `docs/architecture/` |
| Commands/projections | `docs/API.md` |
| Data/state/retention | `docs/DATA-MODEL.md` |
| Security/auth/privacy | `docs/SECURITY.md` |
| Deployment/operations | `docs/DEPLOYMENT.md` |
| Tests and traceability | `docs/TESTING.md`, `docs/TRACEABILITY.md` |
| Diagram inputs | `docs/DIAGRAM-READINESS.md` |
