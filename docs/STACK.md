# Technology Stack

The prototype target is self-hosted Supabase snapshot `self-hosted/v0.8.0` on
Dokploy/Traefik. Confirm the installed images before applying Auth or Storage
migrations. Do not invent owned columns.

| Layer | Prototype choice | Constraint |
|---|---|---|
| Mobile | React Native + Expo development builds | One app; iOS/Android; not Expo Go |
| Navigation | Role-protected routes in the same app | Association and Administrator are siblings |
| Offline data | Expo SQLite | Durable drafts/queue, not server moderation state |
| Offline images | App-private local files | Maximum one optional photo per report |
| Map SDK/provider | `@maplibre/maplibre-react-native` + MapTiler Cloud | Online vector style/tiles; restricted public key; native build |
| Map data | PostGIS RPC clusters/pins | Exact metric clustering; approximate output |
| Localization | `react-i18next` | Spanish/English across all flows |
| On-device vision | `react-native-fast-tflite` + MobileNetV3-Small INT8 ImageNet TFLite | 224×224, dog-label aggregation, CPU-first, development build |
| Backend | Separate self-hosted Supabase stacks (`self-hosted/v0.8.0`) | Production and Staging isolation |
| API gateway | Envoy `envoyproxy/envoy:v1.39.0` | Current self-hosted default. Kong only if explicitly overridden |
| API | PostgREST `v14.12` RPCs | No client table CRUD |
| Auth | `supabase/gotrue:v2.189.0` | Confirm version before Auth migrations |
| Image boundary | Lightweight decode/re-encode worker | No heavy server ML |
| Database | `supabase/postgres:17.6.1.136` + PostGIS/pgcrypto in `extensions` | Authoritative state; do not assume `public.ST_*` |
| Storage | `supabase/storage-api:v1.60.4` | Private quarantine and approved namespaces; verify schema first |
| Access | RLS plus GRANT/REVOKE | Both required |
| Deployment | Dokploy + Traefik on OVH VPS | Shared resources; no HA |

## Implementation evidence still required

- Pin Expo SDK, React Native, and mobile package versions before native
  configuration.
- Approve MapTiler Cloud pricing/plan, attribution, key restrictions, and usage
  limits. Provider configuration remains environment-specific.
- Record TFLite model provenance/license/checksum, tensor contract, class labels,
  thresholds, preprocessing, and representative-device latency/accuracy.
- Re-read the installed Supabase/Postgres/Storage/Auth versions on the VPS before
  writing Storage or Auth migrations. Do not invent columns.

Future-only: DINOv2, pgvector, individual dog re-identification, HA, and multi-city
tenancy.
