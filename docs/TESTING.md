# Testing Strategy

> **Status: preliminary.** A starting framework to expand during Etapa 4 (Testing).
> Maps test focus to the riskiest, most security-relevant behaviors.

## What matters most to test here

This is a security-focused project with an anonymous public surface, so prioritize:

1. **Access control (RLS)** — the highest-value tests.
2. **Server-side validation** that can't be bypassed by the client.
3. **Anti-abuse** behavior.
4. **Offline-first** correctness.

## Test areas

### RLS / access control (critical)
- Anonymous can insert reports and flags, read only `public_reports`, and **cannot**
  read sensitive columns (fingerprint, scores, EXIF) or hidden reports.
- Association can read all reports but cannot perform admin moderation.
- Administrator can hide/delete/restore and read the duplicate queue.
- Anonymous cannot reach admin/association-only tables at all.

### Server-side validation (defense in depth)
- Report with location outside the Creel polygon is rejected (`fn_validate_report_location`).
- `details` JSON missing required keys for its incident type is rejected
  (`fn_validate_report_details`) — one test per incident type.
- Confidence score sent by a client is ignored / recomputed server-side.

### Anti-abuse
- Same fingerprint can't flag the same report twice (unique constraint).
- Flag threshold auto-hides a report (`fn_check_flag_threshold`); threshold is
  configurable via `app_settings`.
- Diversity-weighted flag logic isn't fooled by one source (RNF29).

### Duplicate detection (RF23)
- Two near reports (space+time+attributes) create a `duplicate_candidates` row.
- Detection never auto-merges or auto-hides; admin decision changes status.

### Offline-first (RNF12)
- Report created offline retains its client UUID and syncs once, without duplication,
  on reconnect (idempotent sync).

### On-device photo validation (RF09)
- Non-dog / low-quality photos are rejected with the correct reason and a retry path.
- Works with no connectivity.

### Map (RF10–RF14)
- Clustering returns expected groupings; zoom expands clusters; severity color logic
  is correct.

## Suggested levels

- **DB/integration tests** for triggers, RLS, and constraints (highest ROI here).
- **Unit tests** for client-side form/validation logic and offline queue.
- **E2E** for the core report → map flow and the moderation flow.

## To define

- [ ] Test framework choices (client and DB).
- [ ] Seed/fixtures including a test Creel polygon.
- [ ] CI setup.
