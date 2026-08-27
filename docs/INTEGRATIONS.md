# Integrations

> **Status: preliminary.** No third-party integrations are firmly committed yet
> beyond the core stack. This lists candidates and decisions to make.

## Current / core (not third-party in the usual sense)

- **Supabase (self-hosted)** — Auth, API, Storage, DB. Owned infrastructure, not an
  external SaaS. See `STACK.md`.
- **OVHcloud** — VPS host. See `DEPLOYMENT.md`.
- **Let's Encrypt** — TLS certificates via Traefik/Dokploy.

## Maps (decision pending)

The app needs a map with clustering (RF10–RF14). Two candidates:
- **react-native-maps** (Google/Apple maps under the hood)
- **Mapbox**

Decide based on: clustering support, offline map tiles (given offline-first),
bilingual labels, and cost/licensing. Record the choice in `architecture/DECISIONS.md`
when made.

## On-device ML (library, not a service)

Photo validation runs on-device (RF09) — this is a bundled model, not a network
integration:
- **TensorFlow Lite** (MobileNet/EfficientNet-Lite), or
- **Google ML Kit** image labeling.

## Possible future integrations (out of current scope)

- **DINOv2 inference service** — only if visual re-identification (RNF35) is pursued
  in a future phase; would require external/GPU inference.
- **Government / authority data sharing** — export today is manual (CSV/Excel, RF17);
  a direct integration is not planned.

## To decide

- [ ] Maps provider (react-native-maps vs. Mapbox)
- [ ] Offline map tile strategy
- [ ] Push notifications? (not currently a requirement)
