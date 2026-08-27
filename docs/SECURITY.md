# Security Model

Security is a first-class concern (this is a security-focused course project). The
model has layers: access control, anti-abuse, input validation, infrastructure
hardening, and accountability.

## Access control (RLS + public view)

- **Row Level Security** on all tables separates anonymous, Association, and
  Administrator access (RNF20). See `DATA-MODEL.md` for the policies.
- The **`public_reports` view** restricts *columns* for anonymous users — RLS filters
  rows, the view hides sensitive columns (device fingerprint, confidence scores,
  EXIF). Anonymous users get a boolean `has_flags`, never flag details (RF21).
- The mobile client uses **only the anon key**. The `service_role` key and JWT secret
  live in environment variables and never ship to the client (RNF24).
- JWTs are **short-lived** (~1h) with refresh tokens; invalidated on logout/inactivity
  (RNF34).

## Defense in depth

Client-side validation exists for UX, but the **database independently re-validates**
because any client check can be bypassed by calling the API directly (ADR-008):
- Location inside Creel — `fn_validate_report_location` (RNF08).
- Dynamic-form structure — `fn_validate_report_details` (RNF36).

## Anti-abuse (anonymous reporting integrity)

Because there's no login, integrity relies on layered signals rather than identity:
- **Device fingerprint** rate-limiting, preferred over IP because hotel guests share
  WiFi (RNF26). Never identifies the person.
- **Honeypot fields** — invisible to real users; filled = flagged suspicious (RNF27).
- **Confidence score** — not binary; combines photo validity, EXIF coherence, GPS
  precision, and fingerprint reputation to decide publish / review / discard (RNF28).
  Must be computed server-side.
- **Geofencing + mock-location detection** — only reports inside Creel with acceptable
  GPS accuracy (RNF08).
- **Flag counting with diversity weighting** — flags weighted by distinct
  fingerprints so a single/coordinated source can't auto-hide a legitimate report
  (RNF29). `UNIQUE(report_id, device_fingerprint)` enforces one flag per source.

## Input / file validation

- Uploaded images validated server-side before storage: allowed MIME (JPEG/PNG/HEIC),
  max size (~10 MB), and sanitization/re-encoding to strip malicious embedded
  metadata or payloads (RNF32).
- API rate limiting at the proxy/API layer on public endpoints (report creation,
  flagging) to mitigate automated abuse and DoS (RNF31).

## Infrastructure hardening

- **SSH key-only** access; password auth and direct root login disabled (RNF17). The
  Dokploy web panel manages deploys but **does not replace** SSH hardening.
- **OS firewall + OVHcloud network firewall**; only needed ports exposed (443 public;
  22 restricted) (RNF16). Internal Supabase ports not internet-exposed (RNF23).
- TLS/HTTPS forced via Traefik + Let's Encrypt, HTTP→HTTPS redirect (RNF22).
- Infra snapshots + daily DB backups (RPO 24h / RTO 4h) (RNF14, RNF18).
- Basic resource/log monitoring (RNF25).

## Accountability

- **Audit log** of every admin action (hide/delete/restore) with account, timestamp,
  action (RNF33). Immutable by design — no UPDATE/DELETE policy.

## Privacy (LFPDPPP)

- No PII from public reporters (RNF13) — fingerprint only, which does not identify a
  person.
- For the two accounts, operator personal data (name, email, credentials) is handled
  under LFPDPPP: restricted access, encrypted credential storage, defined retention.

## Risk → mitigation traceability

From the SRS risk matrix:

| Risk | Mitigation |
|---|---|
| Fake/malicious reports contaminate data | RNF26–RNF28 (fingerprint, honeypot, confidence) |
| Deliberate location manipulation | RNF08 (geofence + mock-location) |
| Legit reports hidden by false/coordinated flags | RNF29 (diversity-weighted flags) |
| Imprecise GPS | RNF08 (accuracy threshold) |
| Duplicate reports of one sighting | RF23 + RF22 (heuristic + attributes) |
| Low-quality photos passing validation | RF09, RNF28, RNF36 |
