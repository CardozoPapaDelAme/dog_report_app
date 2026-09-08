# Security, Privacy, and Authentication

This document owns security, privacy, authentication, and threat-control rationale.
It references flows without redefining the endpoint contract in
[`API.md`](API.md) or persistent states in [`DATA-MODEL.md`](DATA-MODEL.md).

## Authorization model

Application tables are private to mobile roles. One `app_backend` login connects
from the `api` Function through the verified pooler configuration. It is
`LOGIN NOBYPASSRLS NOINHERIT`, owns no application object, cannot change roles,
and receives explicit table/column/sequence/function grants only.

RLS and SQL privileges solve different problems. Privileges constrain operations;
RLS constrains rows from transaction-local `app.user_id` and `app.role`. Each
Service transaction calls `set_config(..., true)` only after authentication and
authorization, before repository access. Unset or malformed context sees no
sensitive rows. The mobile app carries only publishable project configuration and
user session tokens—never `service_role`, `app_backend`, database URLs, JWT
verification secrets, Storage service keys, or internal scheduler secrets.

## Role matrix

| Capability | anonymous public reporter | Asociación de Hoteles de Chihuahua | Administrator |
|---|---:|---:|---:|
| Submit/flag | Yes, through Hono | Public Hono routes only | Public Hono routes only |
| Public map | Yes | Yes | Yes |
| Accepted BI/export | No | Yes | No |
| Moderation context/commands | No | No | Yes |
| Zone/threshold commands | No | No | Yes, audited exception |
| Direct domain-table access | No | No | No |

## Authentication and provisioning

- Disable public email/password signup and unused OAuth/anonymous-auth providers
  in the managed Auth project. Anonymous reporting uses the publishable client
  key, not an anonymous Auth user.
- A technical operator creates each Auth user, inserts the matching `profiles` row
  with `association` or `administrator`, and delivers credentials out of band.
- Navigation and every privileged API route require both a signed `app_role` claim in
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
  records the incident. API profile checks block disabled accounts even before an
  old access token expires.

### Provisioning runbook

1. Confirm the target managed project, its demo/test or approved-live marker, and
   the authenticated role request approval.
2. Create the Auth account through the installed Supabase administrative tooling.
3. Set the server-controlled JWT `app_role` metadata and create the matching
   profile role. Never place authorization data in user-editable metadata.
4. Test allowed and denied Hono routes with that account; do not test using server roles.
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
- Trust uses nullable server-derived photo signals, transient metadata coherence,
  GPS, honeypot, and fingerprint signals. Photo-free reports are assessed
  immediately. Heuristics route to review and never auto-discard.
- Mock-location or imprecise-GPS reports always require human review.

## Image security boundary

- **Client normalization:** HEIC/HEIF is normalized to JPEG on device with correct
  orientation and metadata removal; it is never an accepted backend/storage type.
- **Untrusted input:** accept declared/detected JPEG or PNG only; validate binding,
  configured limits, dimensions, decode success, and resource use inside `api`.
- **Metadata and payload safety:** process raw bytes/EXIF only transiently, then
  re-encode and persist sanitized output in private Storage.
- **Retry abuse and ambiguity:** bind source hashes to stable processing state;
  conflicting replacement is denied and terminal retention states never authorize
  delivery.
- **Disclosure:** authorize every delivery against current report, role, canonical,
  and retention conditions; never expose listing or permanent public object URLs.

The on-device TFLite result is a UX signal, not server authority. RNF32 requires
backend JPEG/PNG sanitization; no heavy server ML is added.

## Location privacy

Public presenters return the same metric 50 m-grid point for every report/request.
Clustering uses exact coordinates internally but snaps outputs. Fixed zoom bands,
bounded responses, cache/rate limits, and the absence of exact public endpoints
reduce repeated-query triangulation. Asociación de Hoteles de Chihuahua and Administrator receive exact
coordinates only through their distinct authorized projections.

## Audit and database hardening

- Every moderation, duplicate, zone, and threshold command appends an audit row.
- Repositories insert audit evidence in the same transaction as the mutation.
  `app_backend` has INSERT but never UPDATE/DELETE on `audit_log`.
- Migration review enumerates role attributes, object ownership, table/column/
  sequence/function grants, RLS enablement/policies, and confirms no mobile domain
  table/function exposure.
- After JWT signature/claim verification, a transaction sets the subject id and
  reads only that active profile. Claim/profile/route-role mismatch denies access.
- Managed platform controls plus API/database enforcement cover report, flag,
  image, login, and refresh abuse. Fingerprint-only control is insufficient.
- Durable hourly buckets use hashed origin, operation, and UTC window; only a new
  non-idempotent attempt consumes quota. Buckets expire through retention.

## Secret and fail-closed inventory

| Secret/configuration | Location | Failure behavior |
|---|---|---|
| Database pooler URL for `app_backend` | Function secret | API startup/readiness fails; never falls back to Data API |
| JWT key mode/JWKS or supported legacy secret | Function secret/config | Token-bearing request returns 401; never anonymous |
| Storage server credential | Function secret | Upload/delivery/retention fails without exposing object path |
| Retention scheduler secret | Function + scheduler secret stores | Internal route returns 401 before mark/list/delete/ack |
| Project ref and environment | deployment metadata/config | Deploy/scheduler preflight aborts on mismatch |
