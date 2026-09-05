# Creel Stray-Dog Reporting App

A single React Native/Expo mobile app for anonymous stray-dog reports, a public
map, Association business intelligence, and Administrator moderation in Creel,
Chihuahua. The prototype targets the Asociación de Hoteles de Chihuahua, A.C.

## Status

**Implementation-ready target contracts; implementation has not started.** The
documentation and authoritative SQL schema are aligned. Production report intake
remains blocked until the Association approves a geofence version.

## Read first

1. [`docs/product/APPROVED-CLARIFICATIONS.md`](docs/product/APPROVED-CLARIFICATIONS.md)
2. [`docs/architecture/OVERVIEW.md`](docs/architecture/OVERVIEW.md)
3. [`docs/API.md`](docs/API.md) and [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md)
4. [`db/schema.sql`](db/schema.sql)
5. [`docs/TRACEABILITY.md`](docs/TRACEABILITY.md)

The immutable Spanish SRS remains the origin of RF01–RF24, RNF01–RNF36, and
HU-01–HU-24. Approved clarifications govern implementation where that source is
ambiguous or superseded. See [`docs/README.md`](docs/README.md) for full
precedence and navigation.

## Architecture at a glance

- **Actors:** anonymous public reporter, Association, Administrator.
- **Accounts:** multiple manually provisioned accounts per authenticated role;
  public signup and in-app account administration are disabled.
- **Client:** one Expo app with role-protected navigation, an Expo SQLite durable
  queue, local photo files, MapLibre React Native with MapTiler Cloud, and a
  bundled MobileNetV3-Small INT8 TFLite model.
- **Backend:** separate Production and Staging self-hosted Supabase stacks
  (`self-hosted/v0.8.0`, Envoy gateway) on one Dokploy-managed OVH VPS.
- **Data access:** minimized RPCs and audited commands; no broad client table CRUD.
- **Images:** private quarantine, server validation/re-encoding, then approved
  storage. Raw EXIF is never persisted.
- **Privacy:** stable 50 m approximate public locations; exact coordinates only in
  authorized projections.
- **Availability:** best effort for the single-VPS prototype; 99.9% is future work.

## Constraints

- Reporting and its queue work offline; the map requires connectivity and must
  show an explicit unavailable state.
- Photos are requested, optional, and limited to one.
- Heuristics route work; they never auto-discard or auto-resolve duplicates.
- No heavy server ML or visual dog re-identification in the prototype.
- No commit, bundle, or mobile runtime may contain server secrets.
