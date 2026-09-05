# Roadmap

## Prototype implementation

1. **Foundations:** create Expo development-build app, localization, role-protected
   navigation, ordered database migrations, RPC clients, and test harnesses.
2. **Anonymous reporting:** camera-first dynamic form, optional one-photo path,
   bundled MobileNetV3-Small TFLite validation, Expo SQLite/local-file queue,
   idempotent sync.
3. **Trusted ingestion:** quarantine upload, server decode/re-encode/EXIF stripping,
   trust assessment, rate limits, cleanup compensation.
4. **Public map:** MapLibre online UX, stable approximate pins, exact metric server
   clustering, severity breakdown.
5. **Authenticated flows:** Association dashboard/export and Administrator
   moderation/duplicate/configuration screens using separate RPCs.
6. **Operations:** isolated stacks, Auth provisioning, migrations, monitoring,
   retention, backup/restore and Staging lifecycle drills.

## External gate

Production report intake cannot launch until the Association approves a geofence
version. `GEOFENCE-CANDIDATE.md` defines the candidate and approval procedure.

## Deferred

- 99.9% SLA and high availability/multi-node recovery.
- Visual dog re-identification, DINOv2, pgvector, and server ML.
- Multi-city/multi-tenant or per-hotel accounts.
- Sterilization-campaign tracking, push notifications, and direct authority APIs.

## Definition of implementation start

Start coding only from migrations derived from `db/schema.sql`; pin native/backend
versions and create tests for each `TRACEABILITY.md` row. Do not treat the target
schema as a safe one-shot migration for a populated environment.
