# Security, Privacy, and Authentication

This document owns security, privacy, authentication, and threat-control rationale.
It references flows without redefining the endpoint contract in
[`API.md`](API.md) or persistent states in [`DATA-MODEL.md`](DATA-MODEL.md).

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
CRUD. Neither replaces the other. The mobile app carries only publishable project
configuration and user session tokens—never `service_role`, database passwords,
JWT secrets, or Function credentials.

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

- Disable public email/password signup and unused OAuth/anonymous-auth providers
  in the managed Auth project. Anonymous reporting uses the publishable client
  key, not an anonymous Auth user.
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

1. Confirm the target managed project, its demo/test or approved-live marker, and
   the authenticated role request approval.
2. Create the Auth account through the installed Supabase administrative tooling.
3. Set the server-controlled JWT `app_role` metadata and create the matching
   profile role. Never place authorization data in user-editable metadata.
4. Test allowed and denied RPCs with that account; do not test using service role.
5. Deliver temporary credentials securely and require rotation if supported.
6. For deprovisioning, set `profiles.active=false`, revoke sessions using installed
   Auth capabilities, and preserve required audit evidence.

Exact managed Auth settings and supported revocation controls must be verified in
the target project before deployment.

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

- **Untrusted input:** validate binding, declared/detected type, configured limits,
  dimensions, decode success, and resource use inside the trusted Function.
- **Metadata and payload safety:** process raw bytes/EXIF only transiently, then
  re-encode and persist sanitized output in private Storage.
- **Retry abuse and ambiguity:** bind source hashes to stable processing state;
  conflicting replacement is denied and terminal retention states never authorize
  delivery.
- **Disclosure:** authorize every delivery against current report, role, canonical,
  and retention conditions; never expose listing or permanent public object URLs.

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
- Managed platform controls plus Function/database enforcement cover report, flag,
  image, login, and refresh abuse. Fingerprint-only control is insufficient.
