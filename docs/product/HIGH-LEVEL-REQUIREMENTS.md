# High-Level Requirements Orientation

This non-canonical English map groups requirements into capabilities; it does not
restate them. Read the original text in
[`ETAPA1-REQUERIMIENTOS.md`](ETAPA1-REQUERIMIENTOS.md), then apply
[`APPROVED-CLARIFICATIONS.md`](APPROVED-CLARIFICATIONS.md).

## Functional scope

| IDs | Outcome |
|---|---|
| RF01–RF09 | Accessible public reporting, evidence capture, incident detail, integrity feedback, and camera-first flow |
| RF10–RF14 | Public geographic exploration, clustering, severity communication, and progressive detail |
| RF15–RF17 | Authenticated Association access, analysis, and export |
| RF18–RF21 | Authenticated administration, report review, moderation, and flag handling |
| RF22–RF24 | Structured dog attributes, duplicate review, and context-sensitive reporting |

## Non-functional scope

| IDs | Outcome |
|---|---|
| RNF01–RNF04 | Availability, performance, growth, and usability targets |
| RNF05–RNF08 | Mobile compatibility, localization, actor access, and on-device validation |
| RNF09–RNF13 | Location/data quality, offline operation, and privacy |
| RNF14–RNF25 | Hosting, recovery, data platform, access control, secrets, and operations |
| RNF26–RNF30 | Anti-abuse, trust assessment, flag integrity, and duplicate handling |
| RNF31–RNF34 | Public-edge protection, image safety, auditability, and sessions |
| RNF35–RNF36 | Future visual similarity and structured dynamic-form validation |

Approved amendments change some original implementation interpretations without
changing these ranges. Do not infer current hosting, role cardinality, or lifecycle
rules from this orientation; use the clarification document.

## User stories

HU-01–HU-24 provide user-centered acceptance language and map many-to-many to RF
and RNF identifiers. Use [`../TRACEABILITY.md`](../TRACEABILITY.md) for the complete
mapping and verification ownership.
