# Approved Product Clarifications and Amendments

**Status: approved for prototype implementation.** This document resolves
ambiguities and supersedes conflicting implementation interpretations without
rewriting the immutable Spanish SRS or its transcription.

## Precedence

Use these sources in order:

1. `Etapa 1. Requerimientos.pdf` and its faithful transcription establish the
   original intent and immutable RF/RNF/HU identifiers.
2. This document supplies approved clarifications and amendments.
3. `db/schema.sql` and `docs/DATA-MODEL.md` define the authoritative target data
   and command contracts.
4. ADRs in `docs/architecture/DECISIONS.md` explain technical choices.

When an original statement is ambiguous or conflicts with an approved item
below, implementation follows this document. Requirement IDs remain unchanged.

## Approved decisions

| # | Approved clarification or amendment | Affected IDs |
|---|---|---|
| 1 | The anonymous public reporter is an external actor. There are exactly two authenticated, non-hierarchical roles: `association` and `administrator`. | RF01, RF15, RF18; RNF07, RNF20; HU-01, HU-15, HU-18 |
| 2 | Each role may have multiple individual accounts. A technical operator provisions them manually; public signup and in-app account management are disabled. | RF15, RF18; RNF07, RNF13, RNF33; HU-15, HU-18 |
| 3 | Association access is read-only dashboard/statistics/export over accepted canonical business data only. It excludes pending, hidden, deleted, and non-canonical duplicate reports, plus fingerprints, raw EXIF, flags, trust data, moderation data, and operator identities. | RF16, RF17, RF19; RNF13, RNF20, RNF33; HU-16, HU-17, HU-19 |
| 4 | Administrator does not inherit Association analytics/export. It reads moderation context, cannot alter original report content, and acts only through audited approve/publish, hide, restore, logical-delete, and duplicate-resolution commands. | RF18–RF21, RF23; RNF20, RNF30, RNF33; HU-18–HU-21, HU-23 |
| 5 | As an explicit exception to moderation-only scope, Administrator manages versioned zones and typed flag, duplicate, trust, GPS, and anti-abuse thresholds through validated, audited mobile commands. | RF21, RF23; RNF09, RNF20, RNF26–RNF33; HU-21, HU-23 |
| 6 | “Delete” means reversible logical deletion. There is no user-triggered hard delete. A retention job permanently purges logically deleted reports after one year. | RF20, RF21; RNF33; HU-20, HU-21 |
| 7 | High-trust reports publish without human review. Medium/low trust enters review. Imprecise GPS or suspected mock location always enters review. Heuristics never auto-discard; only deterministic invalid structure or outside-geofence submissions are rejected. | RF09; RNF09, RNF10, RNF27–RNF30, RNF36; HU-09 |
| 8 | A photo is requested in every report flow, remains optional, and is limited to one. The public may see only the sanitized photo for a visible recent report. Raw EXIF is processed transiently into derived signals and never persisted. The UI warns against people, plates, and private-property details; moderation may hide incidental PII. | RF03, RF05, RF09, RF22, RF24; RNF10, RNF13, RNF28, RNF32; HU-03, HU-05, HU-09, HU-22, HU-24 |
| 9 | The product does not solicit reporter identifiers. “Anonymous” is a collection rule, not an impossible promise that visual or optional free-text content can never contain incidental PII. | RF02; RNF13, RNF32; HU-02 |
| 10 | Public locations use one stable, deterministic 50 m metric grid approximation. Authorized authenticated projections may use exact coordinates. The API does not provide jittered or query-dependent locations that could be averaged or triangulated. | RF10; RNF13, RNF20; HU-10 |
| 11 | Duplicate confirmation selects one canonical report, preserves linked evidence, excludes non-canonical members from public and Association outputs and analytics, and remains reversible and audited. Detection itself never hides or merges. | RF13, RF23; RNF30, RNF33; HU-13, HU-23 |
| 12 | Severity is, highest first: human attack, livestock attack, pet attack, injured dog, other, simple sighting. Clusters use the highest severity and include per-type counts. | RF06, RF13; HU-06, HU-13 |
| 13 | Prototype availability is best effort. The SRS 99.9% value is a future service target, not a current SLA. | RNF01 |
| 14 | Report creation and its durable queue work offline. The public map requires connectivity and must show an explicit unavailable state when offline. | RF01, RF10; RNF12; HU-01, HU-10 |
| 15 | One React Native/Expo mobile app serves all actors with role-protected navigation. There is no separate web administration panel. | RF01, RF15, RF18; RNF05–RNF07; HU-01, HU-15, HU-18 |
| 16 | One OVH VPS runs Dokploy with physically shared but logically isolated Production and Staging Supabase stacks. Each has separate data, storage, secrets, domains, and backups. Staging is on demand and stopped after validation; neither environment is highly available. | RNF01, RNF14–RNF25 |
| 17 | No official geofence has been approved. The INEGI-derived candidate is versioned and documented, but Production activation requires explicit Association approval. Placeholder geometry must never be represented as official. | RNF09 |
| 18 | Retention is: public map and approved photo 90 days; de-identified business data 5 years; fingerprint 30 days; audit log 2 years; logical deletion purge after 1 year; raw EXIF never persisted. | RF10, RF16, RF17, RF20; RNF13, RNF14, RNF18, RNF25, RNF26, RNF28, RNF32, RNF33; HU-10, HU-16, HU-17, HU-20 |
| 19 | The prototype self-hosted Supabase API gateway is Envoy, matching the current upstream default. SRS RNF22/RNF23 Kong wording is historical. Kong is used only if an operator explicitly enables the optional override. | RNF22, RNF23 |

## Interpretation rules

- RF/RNF/HU relationships are many-to-many. Parenthetical references in the SRS
  are trace hints, not a one-to-one mapping.
- The standardized actor terms are **anonymous public reporter**,
  **Association**, and **Administrator**.
- Geofence validation is RNF09. RNF08 concerns the on-device vision model.
- “Accepted” means server-approved business data. “Visible” means currently
  publishable, but public display additionally requires the 90-day window and a
  canonical duplicate disposition.

## Approval gaps that remain

Only the Production geofence geometry remains blocked on external approval.
The candidate and activation gate are documented in
[`GEOFENCE-CANDIDATE.md`](GEOFENCE-CANDIDATE.md).
