# Solution Exploration

## Decisions that close earlier alternatives

| Concern | Selected prototype direction | Rejected/deferred direction |
|---|---|---|
| Access | One tenant; multiple individual accounts in two sibling roles | Single shared credentials, per-hotel tenants, role inheritance |
| Client | One role-protected Expo mobile app | Separate web/admin panel |
| Offline | Expo SQLite metadata + app-private photo file | Memory-only queue or image blobs in SQLite |
| API | Minimized PostgREST RPCs/commands | Broad table CRUD |
| Map | MapLibre React Native + MapTiler Cloud vector style/tiles | Unresolved SDK/provider “or” choice; offline tiles in prototype |
| Clustering | Exact UTM server clustering, approximate output | Degree-as-meter DBSCAN or client access to exact public points |
| Vision | Bundled custom TFLite through `react-native-fast-tflite` | ML Kit alternative, cloud classifier, Expo Go |
| Images | Private quarantine + lightweight server sanitization | Trusting extension/MIME or on-device validation |
| Duplicates | Human canonical groups, reversible/audited | Automatic merge/hide or DINOv2 in prototype |
| Configuration | Typed immutable versions and approved zone sets | Free-form key/value settings or placeholder polygon |
| Deployment | Isolated stacks sharing one VPS | Shared database/secrets or HA claim |

## Important trade-offs

- Native MapLibre and TFLite modules require development/release builds, increasing
  build setup but removing unresolved runtime choices.
- An online-only map is honest about connectivity and avoids an unplanned tile
  distribution/licensing system; report creation remains fully offline.
- Stable public approximation sacrifices pin precision to prevent repeated-query
  averaging. Exact coordinates remain available only where purpose-authorized.
- A lightweight image worker adds one component, but Postgres cannot safely decode
  and re-encode untrusted media. This is a necessary security boundary, not server
  ML.
- Separate stacks improve isolation but share a failure domain and compete for
  resources. Staging therefore runs on demand.

## Geofence evidence

INEGI supplies a reproducible Creel urban-locality polygon, but the product needs a
tourist-zone boundary. Treating those as identical would be a product error.
Version the INEGI candidate, review it in GIS, and require Association approval
before Production activation.
