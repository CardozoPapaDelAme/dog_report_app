# Repository Guidance for Coding Agents

Read this file before changing the project.

## Source precedence

1. `Etapa 1. Requerimientos.pdf` and
   `docs/product/ETAPA1-REQUERIMIENTOS.md` preserve the original SRS and IDs.
2. `docs/product/APPROVED-CLARIFICATIONS.md` governs approved amendments.
3. `db/schema.sql` is the authoritative exact target schema and API/data boundary.
4. `docs/API.md` and `docs/DATA-MODEL.md` explain that contract for consumers and
   readers; they do not override the schema.
5. `docs/architecture/DECISIONS.md` records rationale and constraints.

Never rewrite the SRS body to conceal a later decision. Update clarifications,
schema/data contract, ADRs, traceability, and tests together.

## Non-negotiable architecture

- Use the actor terms **anonymous public reporter**,
  **Asociación de Hoteles de Chihuahua**, and **Administrator**. The
  authenticated roles are siblings, not a hierarchy. The SQL role remains
  `association`.
- Multiple individual accounts are allowed per role. They are manually
  provisioned by a technical operator. Public signup and in-app account
  management stay disabled.
- The Asociación de Hoteles de Chihuahua receives accepted canonical business data only. Administrator does
  not inherit BI/export and acts through specific audited commands.
- Clients never write tables directly or set moderation, trust, server-controlled
  lifecycle/audit timestamps, retention, or duplicate-resolution fields. The
  validated `p_client_created_at` parameter is the client's observation timestamp,
  not a server lifecycle timestamp. Use the RPC contracts in `docs/API.md`.
- Phase 1 targets Supabase managed Free. Model the provider as one managed
  boundary, logically decomposed into Auth, Data API/PostgREST, Edge Functions,
  Storage, and PostgreSQL/PostGIS; never claim physical provider internals.
- Do not add a redundant custom Controller-Service-Repository API. PostgREST is
  the generated HTTP adapter, SQL RPCs own transactional use cases, PostgreSQL
  owns persistence/RLS/PostGIS, and Edge Functions are reserved for
  non-relational image work or external integrations.
- RLS and SQL privileges are both mandatory. Never ship `service_role` or other
  server credentials to the mobile app.
- Raw EXIF is transient input and must never be persisted. Public images are
  sanitized, private, and delivered only after authorization; public positions
  use the stable 50 m approximation.
- Logical deletion is reversible. Hard deletion occurs only in retention jobs.
- Keep local queue states separate from server moderation states.
- Production geofence activation requires explicit approval by the Asociación de Hoteles de Chihuahua; do not
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
- The local Supabase Docker stack is optional. The selected remote deployment
  workflow uses a version-checked Supabase CLI; deploy Edge Functions explicitly
  with `supabase functions deploy <function-name> --use-api`. Keep SQL migrations
  and Functions versioned even when developing against the managed project.
- Do not put access tokens, database passwords, service keys, or Function secrets
  in Git. The mobile app receives only publishable client configuration.

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
