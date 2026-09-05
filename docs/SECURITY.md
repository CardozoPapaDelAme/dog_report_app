# Security, Privacy, and Authentication

## Authorization model

Application tables are private by default. Mobile access uses minimized
SECURITY DEFINER RPCs that:

- have a fixed empty `search_path` and schema-qualified references, including
  `extensions.*` for PostGIS and pgcrypto;
- are owned by a dedicated NOLOGIN application owner;
- have PUBLIC execution revoked;
- receive only narrow EXECUTE grants;
- verify the caller's active profile role for authenticated operations.

RLS and SQL privileges solve different problems. RLS limits rows if access is
accidentally granted; GRANT/REVOKE limits operations and prevents PostgREST table
CRUD. Neither replaces the other. The mobile app carries only the anon key and
user session tokens—never `service_role`, JWT secrets, or worker credentials.

## Role matrix

| Capability | anonymous public reporter | Association | Administrator |
|---|---:|---:|---:|
| Submit/flag | Yes | Public RPCs only | Public RPCs only |
| Public map | Yes | Yes | Yes |
| Accepted BI/export | No | Yes | No |
| Moderation context/commands | No | No | Yes |
| Zone/threshold commands | No | No | Yes, audited exception |
| Direct table writes | No | No | No |

## Authentication and provisioning

- Disable public email/password signup and every OAuth/anonymous-auth provider in
  the self-hosted Auth configuration. Anonymous reporting uses the anon API key,
  not an anonymous Auth user.
- A technical operator creates each Auth user, inserts the matching `profiles` row
  with `association` or `administrator`, and delivers credentials out of band.
- Navigation and every privileged RPC require both a signed `app_role` claim in
  JWT app metadata and an active matching profile. Neither source alone grants
  authority; the profile remains the immediate deactivation control.
- Use short access tokens (prototype target: about one hour) and supported refresh
  token rotation/session controls. Store refresh material in platform secure
  storage, not Expo SQLite.
- Client logout clears local tokens and asks Auth to end the session. Already
  issued stateless access JWTs may remain usable until expiry unless the deployed
  Auth version provides and is configured for a checked revocation mechanism.
  Never promise instant global JWT invalidation.
- For compromise or staff departure, the operator disables the profile, revokes
  supported Auth sessions/refresh tokens, rotates credentials where needed, and
  records the incident. RPC profile checks block disabled accounts even before an
  old access token expires.

### Provisioning runbook

1. Confirm Production or Staging target and authenticated role request approval.
2. Create the Auth account through the installed Supabase administrative tooling.
3. Set the server-controlled JWT `app_role` metadata and create the matching
   profile role. Never place authorization data in user-editable metadata.
4. Test allowed and denied RPCs with that account; do not test using service role.
5. Deliver temporary credentials securely and require rotation if supported.
6. For deprovisioning, set `profiles.active=false`, revoke sessions using installed
   Auth capabilities, and preserve required audit evidence.

Exact Auth environment variable names and revocation commands must be verified
against the installed self-hosted version before deployment.

## Anonymous integrity and privacy

- The form does not solicit name, email, phone, or identifier from the reporter.
- Device-origin material is hashed server-side, used for rate/diversity signals,
  and cleared after 30 days. It is pseudonymous anti-abuse data, not proof of
  absolute anonymity.
- Reporters receive a warning not to capture people, plates, or private-property
  details. Free text and images can still contain incidental PII; flagging and
  Administrator hiding provide a moderation path.
- Trust uses server-derived photo, transient EXIF coherence, GPS, honeypot, and
  fingerprint signals. Heuristics route to review and never auto-discard.
- Mock-location or imprecise-GPS reports always require human review.

## Image security boundary

The worker validates magic bytes/decoded type, maximum 10 MB size, bounded
dimensions, successful decode, and resource limits. It re-encodes to an approved
format, strips EXIF, computes the sanitized checksum, and promotes only the output.
Raw uploads remain private. Timeouts and failures remove quarantine orphans; object
promotion and database updates use idempotency/compensation rather than pretending
they are one transaction.

The on-device TFLite result is a UX signal, not server authority. RNF32 requires
the lightweight server processor; no heavy server ML is added.

## Location privacy

Public RPCs return the same metric 50 m-grid point for every report/request.
Clustering uses exact coordinates internally but snaps outputs. Fixed zoom bands,
bounded responses, cache/rate limits, and the absence of exact public endpoints
reduce repeated-query triangulation. Association/Administrator receive exact
coordinates only through their distinct authorized projections.

## Audit and database hardening

- Every moderation, duplicate, zone, and threshold command appends an audit row.
- No mobile role receives audit INSERT/UPDATE/DELETE.
- Function owners are not login roles and are not used by the app.
- Migration review must enumerate function ownership, function grants, table
  grants, RLS enablement, and exposed PostgREST schemas.
- Clients read the caller's profile through `get_my_profile`. Direct `SELECT` on
  `profiles` is revoked; the own-row RLS policy remains defense in depth.
- Rate limits at Traefik/Envoy or worker cover report, flag, upload, login, and
  refresh endpoints; fingerprint-only control is insufficient.
