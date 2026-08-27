# CLAUDE.md

Guidance for Claude Code (and compatible agents) in this repository.

This file complements `AGENTS.md` — read that first for project context and
non-negotiable constraints. This file adds Claude-specific working notes.

## Before you start a task

1. Read `AGENTS.md` for constraints and `docs/architecture/OVERVIEW.md` for shape.
2. If the task touches data, read `docs/DATA-MODEL.md` — the schema and the
   `reports.details` JSON contract are authoritative.
3. If the task touches auth, access control, or anti-abuse, read `docs/SECURITY.md`.

## Working style for this repo

- Trace work back to requirement IDs (RF/RNF/HU). When implementing, say which
  requirement a change serves.
- Prefer editing existing files over creating parallel ones.
- When a decision has trade-offs or deviates from the docs, record it in
  `docs/architecture/DECISIONS.md` rather than silently choosing.
- Keep the two-layer validation model: client validation for UX, database
  triggers/RLS as the real enforcement.

## Things that are easy to get wrong here

- **Offline UUIDs**: report IDs are generated on the client, not by the DB. Don't
  switch to serial/auto-increment IDs.
- **Confidence scores** must be computed server-side, never trusted from the client.
- **The public view** (`public_reports`) intentionally omits sensitive columns
  (fingerprint, scores, EXIF). Don't expose them.
- **Dynamic form**: `reports.details` is JSONB but not free-form — it's validated
  per incident type. Update both the trigger and the contract doc together.

## Out of scope for the prototype

Visual dog re-identification (DINOv2/pgvector), multi-city/multi-tenant, and any
server-side heavy ML. See `docs/product/ROADMAP.md` and RNF35.
