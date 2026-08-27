# High-Level Requirements

This is a condensed, English-language map of the requirements for orientation. The
**canonical, authoritative source is the SRS** ("Etapa 1. Requerimientos", Spanish).
IDs here match the SRS exactly.

## Functional requirements (RF)

### Public reporting (anonymous, no login)
- **RF01** Anyone can file a report without an account or login.
- **RF02** No personal data is requested or stored from the reporter.
- **RF03** The user can take a photo of the dog when creating a report.
- **RF04** The user indicates solitary dog vs. pack.
- **RF05** Quick, visible button to start a report without a photo.
- **RF06** The user selects an incident type (simple sighting, attack on pet,
  attack on livestock, attack on human, injured dog, other).
- **RF07** The app opens directly on the camera.
- **RF08** The user can flag a report as invalid (fake photo, inappropriate, mockery,
  or **not a stray — e.g. a neighbor's pet**).
- **RF09** On capture, on-device validation checks the photo is valid (a dog is
  present, sufficient quality); otherwise it asks to retake.

### Public map
- **RF10** Map with pins showing report locations.
- **RF11** Nearby reports cluster into circles at high density.
- **RF12** Circle size is proportional to the number of grouped reports.
- **RF13** Circle color reflects the highest-severity incident type in the group;
  tapping shows a per-type breakdown.
- **RF14** Zooming expands clusters progressively into smaller clusters/pins.

### Association (login)
- **RF15** The Association has a single account, provisioned at setup — no public
  sign-up.
- **RF16** Access to a stats dashboard with detailed/raw report data.
- **RF17** Export dashboard data (CSV/Excel) to share with affiliates/authorities.

### Administrator (login) — report management
- **RF18** Admin logs in with own credentials; no public sign-up.
- **RF19** Admin sees all reports, including flagged ones with the flag reason.
- **RF20** Admin can hide or delete a report marked as fake/inappropriate.
- **RF21** A flagged report stays visible by default; on reaching a high flag count
  it auto-hides for review. Others can see that a report has flags (a warning).

### Attributes & duplicates
- **RF22** With a photo, the app auto-extracts the dog's predominant color
  (on-device pixel analysis); size and collar are optional manual inputs.
- **RF23** The system flags **possible** duplicate reports (near in space + time +
  similar attributes) and groups them for admin review — never auto-merges or
  auto-hides.
- **RF24** The report form is **dynamic**: questions shown depend on the selected
  incident type. See the JSON contract in `docs/DATA-MODEL.md`.

## Non-functional requirements (RNF) — grouped

- **Availability/Performance** (RNF01–03): 99.9% availability; map loads < 5s;
  scalable.
- **Usability** (RNF04): report completable in < 5 min, no training.
- **Platform** (RNF05–08): iOS 13+/Android 8.0+ (RN/Expo); bilingual ES/EN;
  single-tenant with two auth roles; on-device lightweight vision model for photo
  validation.
- **Data validation** (RNF09–11): geofencing + mock-location detection; on-device
  dog classifier; on-device color extraction + structured attributes.
- **Offline-first** (RNF12): create offline, sync on reconnect.
- **Privacy** (RNF13): no PII from public; LFPDPPP handling for the two accounts.
- **Server/cloud** (RNF14–18): daily DB backup (RPO 24h/RTO 4h); OVHcloud VPS
  (Beauharnois, ≥4 vCPU/8 GB); OS + network firewall; SSH key-only + Dokploy panel;
  infra snapshots.
- **Software** (RNF19–25): PostgreSQL+PostGIS via self-hosted Supabase; RLS;
  PostgREST + GoTrue/JWT; Dokploy/Traefik reverse proxy with TLS; internal ports not
  exposed; secrets in env vars; basic monitoring.
- **Integrity & anti-abuse** (RNF26–30): device fingerprint rate-limiting; honeypot
  fields; confidence scoring (not binary); diversity-weighted flag counting;
  heuristic (not certain) duplicate detection.
- **App/API security** (RNF31–34): API rate limiting; server-side image validation;
  admin audit log; short-lived JWT with refresh.
- **Future phase** (RNF35): visual re-identification (DINOv2/pgvector) — out of
  prototype scope.
- **Dynamic form validation** (RNF36): `reports.details` structure validated in the
  DB per incident type.

## User stories (HU)

HU-01 … HU-24 map 1:1 to the RFs above (e.g. HU-24 ↔ RF24, dynamic form). See the
SRS for full "as a … I want … so that …" phrasing and acceptance criteria.
