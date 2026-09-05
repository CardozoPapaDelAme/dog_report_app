# Integrations and External Boundaries

## Committed boundaries

| Integration | Use | Release gate |
|---|---|---|
| Self-hosted Supabase `self-hosted/v0.8.0` | Auth, PostgREST, Storage, PostgreSQL | Confirm installed images before Auth/Storage migrations |
| Envoy (`envoyproxy/envoy:v1.39.0`) | Default Supabase API gateway | Kong only if an operator enables the optional override |
| OVHcloud | VPS and network controls | Capacity and backup destination verified |
| Dokploy/Traefik | Deployment, edge routing, TLS | Separate environment domains/secrets |
| Let's Encrypt | TLS certificates | Renewal alert tested |
| MapLibre React Native | Native map renderer | Expo development build smoke test |
| MapTiler Cloud | Online vector styles/tiles | Attribution, key restriction, quota, and cost approval |
| `react-native-fast-tflite` | Bundled custom TFLite inference | Model and device benchmark evidence |
| INEGI | Geofence candidate source | Association approval before Production activation |

## Map strategy

The prototype uses MapLibre React Native with MapTiler Cloud vector styles/tiles.
The basemap is online-only and the UI shows an explicit unavailable state without
connectivity. The MapTiler key is a public client credential and must be restricted
using supported provider controls; it is not a Supabase secret. Domain clusters
come from server RPCs so privacy and severity remain authoritative.

## On-device vision

The MobileNetV3-Small INT8 ImageNet TFLite model is bundled with the app and runs
through `react-native-fast-tflite` on CPU first. The app aggregates documented dog
labels and uses a separate blur/quality metric. There is no ML SaaS, custom model
training, or server classification. A native Expo development build is required.
Server image processing performs security validation/sanitization, not dog
classification.

## Geofence source

The reproducible candidate comes from INEGI Marco Geoestadístico, December 2025.
See `product/GEOFENCE-CANDIDATE.md`. It is not an approved Production boundary.

## Deferred integrations

No direct government data feed, push-notification provider, DINOv2 service, or
vector database is part of the prototype. Association export remains CSV/Excel
from its minimized projection.
