# Claude Repository Notes

`AGENTS.md` is mandatory and authoritative for agent behavior in this repository.

## Before implementation

1. Read the approved clarifications and the relevant ADRs.
2. For data/API work, read `docs/API.md`, `docs/DATA-MODEL.md`, and
   `db/schema.sql` together.
3. For auth, images, access, or abuse controls, read `docs/SECURITY.md`.
4. Trace the change through `docs/TRACEABILITY.md` and add negative authorization
   tests where a boundary changes.

## Common failure modes

- Do not expose table CRUD as a shortcut. Public and mobile-authenticated writes
  cross narrow RPC/command boundaries.
- Do not allow Administrator to call Association analytics/export or allow
  Association to see moderation context.
- Do not trust client-supplied status, scores, timestamps, EXIF, or audit values.
- Do not publish mock-location or imprecise-GPS reports automatically.
- Do not cluster degree-based geometry as if degrees were meters.
- Do not expose exact public coordinates or query-dependent location jitter.
- Do not call logical deletion permanent; only retention workers hard-purge.
- Do not use Expo Go for MapLibre or custom TFLite native modules.
- Do not claim logout instantly invalidates every issued JWT. Explain access-token
  expiry and supported session revocation honestly.
- Do not claim the INEGI geofence candidate is Association-approved.

## Change discipline

Preserve the immutable SRS transcription. Record new product decisions in
`docs/product/APPROVED-CLARIFICATIONS.md`, technical decisions in ADRs, and keep
the schema, prose contracts, traceability, and tests synchronized.
