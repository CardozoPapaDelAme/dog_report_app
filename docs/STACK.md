# Technology Stack

## Summary

| Layer | Technology | Rationale (short) |
|---|---|---|
| Mobile | React Native + Expo | Cross-platform iOS/Android from one codebase (RNF05) |
| Maps | react-native-maps or Mapbox | Clustering + geospatial UI (RF10–RF14) |
| Localization | react-i18next | Bilingual ES/EN (RNF06) |
| On-device ML | TF Lite (MobileNet/EfficientNet-Lite) or ML Kit | Dog/no-dog + quality, offline (RF09) |
| Backend | Supabase self-hosted (Docker) | Auth + API + Storage ready-made, self-owned |
| API | PostgREST | Auto-generated REST from schema |
| Auth | GoTrue (JWT) | Two roles, short-lived tokens (RNF21/RNF34) |
| DB | PostgreSQL + PostGIS | Geospatial core (RNF19) |
| Access control | Row Level Security | Row-level separation (RNF20) |
| Storage | Supabase Storage | Report photos |
| PaaS / deploy | Dokploy | One-click Supabase, Traefik, backups |
| Reverse proxy | Traefik (via Dokploy) | TLS auto (Let's Encrypt), routing (RNF22) |
| Host | OVHcloud VPS (Beauharnois) | Closest region to MX; 4 vCPU / 8 GB (RNF15) |
| Compliance ref | LFPDPPP | Mexican data-protection law |

## Why these (pointers to full rationale)

Most choices have a decision record in `architecture/DECISIONS.md`:
- Self-hosted Supabase vs. managed → ADR-003
- Dokploy vs. manual Nginx/Caddy → ADR-004
- PostgreSQL + PostGIS → ADR-005
- On-device standard vision model → ADR-010

## Frontend notes

- **Expo managed workflow** targeting Android 8.0+ / iOS 13+.
- The app uses only the Supabase **anon key**; the service_role key never ships to
  the client (RNF24).
- Offline queue + sync is a first-class concern, not an afterthought (RNF12).

## Backend notes

- The Supabase stack (GoTrue, PostgREST, Storage, Realtime, Studio, Kong) runs in
  Docker via the Dokploy template as a single grouped service.
- Because it's self-hosted, the team owns patching the stack images.
- Studio and internal ports (Postgres, Kong) are not exposed publicly (RNF23).

## Explicitly not in the stack (prototype)

- No pgvector / DINOv2 inference (future phase, RNF35).
- No managed cloud BaaS.
- No multi-region / HA infrastructure.
