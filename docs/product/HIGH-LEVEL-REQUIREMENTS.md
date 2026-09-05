# High-Level Requirements Orientation

This English summary is non-canonical. The original IDs and Spanish text remain in
`ETAPA1-REQUERIMIENTOS.md`; `APPROVED-CLARIFICATIONS.md` governs amendments.

## Functional scope

| IDs | Outcome |
|---|---|
| RF01–RF09 | Anonymous camera-first reporting; photo requested but optional and limited to one; dynamic data and on-device photo UX validation |
| RF10–RF14 | MapLibre/MapTiler online map with approximate pins and progressive metric clusters using highest severity plus per-type counts |
| RF15–RF17 | Multiple provisioned Association accounts share a read-only accepted canonical dashboard/export capability |
| RF18–RF21 | Multiple provisioned Administrator accounts use moderation context and specific audited state commands; deletion is logical |
| RF22–RF24 | Structured dog attributes, human-resolved duplicate candidates, and DB-validated conditional details |

## Non-functional scope

| IDs | Outcome |
|---|---|
| RNF01–RNF04 | Best-effort prototype availability, map performance target, growth testing, and sub-five-minute reporting |
| RNF05–RNF08 | One bilingual Expo app, two sibling roles, Expo development builds, bundled MobileNetV3-Small INT8 TFLite vision |
| RNF09–RNF13 | Geofence/GPS review, offline validation and queue, structured attributes, privacy minimization |
| RNF14–RNF25 | Daily backup and restore targets, hardened OVH/Dokploy/Supabase topology, RLS plus privileges, secrets and monitoring |
| RNF26–RNF30 | Temporary fingerprint signals, honeypot, server trust routing, diverse flags, human duplicate decisions |
| RNF31–RNF34 | Edge rate limits, quarantine/sanitization, append-only audit, honest short-token/refresh/session handling |
| RNF35–RNF36 | Visual re-identification deferred; dynamic JSON remains DB-validated |

RNF09 is geofence/GPS validation. RNF08 is on-device vision. The 99.9% value in
RNF01 is a future target, not a prototype SLA.

## User stories

HU-01–HU-24 provide user-centered acceptance language. They do not map one-to-one
to RF identifiers: for example HU-08 spans RF08/RF21 and anti-abuse RNFs, while
location privacy and offline behavior add cross-cutting acceptance criteria. Use
`../TRACEABILITY.md` for the complete mapping.
