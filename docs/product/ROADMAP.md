# Roadmap

## Now — Prototype (current scope)

Goal: a functional prototype, not a public launch.

**Public reporting**
- Anonymous report creation, camera-first (RF01–RF07)
- On-device photo validation: dog/no-dog + quality (RF09, RNF08)
- On-device color extraction; manual size/collar (RF22)
- Dynamic form per incident type (RF24), DB-validated (RNF36)
- Offline creation + sync (RNF12)

**Public map**
- Pins, clustering, size/color semantics, zoom expansion (RF10–RF14)

**Association account**
- Single provisioned login, BI dashboard, CSV/Excel export (RF15–RF17)

**Administrator account**
- Moderation: view all + flagged, hide/delete, auto-hide queue (RF18–RF21)
- Possible-duplicate review queue (RF23)

**Integrity & security baseline**
- Fingerprint rate-limiting, honeypots, confidence scoring (RNF26–RNF29)
- RLS, audit log, image validation, rate limiting, JWT policy (RNF31–RNF34)

## Timeline (from the SRS schedule)

| Stage | Window | Notes |
|---|---|---|
| Etapa 1 — Requirements | done | SRS complete |
| Etapa 2 — Design | short | data model, sequence diagrams |
| Etapa 3 — Development | ~34 days | the build |
| Etapa 4 — Testing | ~7 days | |
| Etapa 5 — Deployment | ~14 days | |

## Next — Deferred to future phases

- **Visual dog re-identification (RNF35)**: DINOv2 embeddings + vector similarity
  (pgvector) to suggest "same dog seen before". Requires GPU/dedicated inference the
  current VPS can't provide, and breaks offline-first for that function. The
  attributes captured in RF22 are the cheap pre-filter that makes this cheaper later.
- **Sterilization campaign tracking**: noted as a relevant future feature within the
  dogs-only scope.

## Explicitly out of scope (not planned)

- Multi-city / multi-tenant architecture.
- Commercial/tiered access or per-hotel accounts.
- Species other than dogs.
- High-availability / server redundancy (single VPS is a known prototype limitation).
