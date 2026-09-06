# Solution Exploration

This document records useful alternatives that shaped the selected product. It is
an index of trade-offs, not the current architecture contract; accepted technical
rationale belongs to the
[`architecture decision records`](../architecture/DECISIONS.md).

## Product alternatives considered

| Concern | Alternatives considered | Resolution owner |
|---|---|---|
| Account model | Shared credentials, individual accounts, per-hotel tenancy, or inherited roles | [Approved clarifications 1–5](APPROVED-CLARIFICATIONS.md) |
| Product surfaces | One role-aware mobile app or separate public/admin clients | [Approved clarification 15](APPROVED-CLARIFICATIONS.md) |
| Connectivity | Offline report capture with online exploration, or offline map distribution | [Approved clarification 14](APPROVED-CLARIFICATIONS.md) |
| Duplicate decisions | Human review, automatic merge, or mandatory visual inference | [Approved clarifications 11 and 21](APPROVED-CLARIFICATIONS.md) |
| Live geofence | Treat locality data as authoritative or require Association approval | [`GEOFENCE-CANDIDATE.md`](GEOFENCE-CANDIDATE.md) |

## Technical alternatives index

| Question | Alternatives retained in history | Accepted rationale |
|---|---|---|
| Client data boundary | Broad table CRUD, custom API, or narrow generated RPC transport | [ADR-002](../architecture/DECISIONS.md#adr-002--rpc-only-client-data-boundary) |
| Offline persistence | Memory-only state, database blobs, or durable metadata plus local file | [ADR-006](../architecture/DECISIONS.md#adr-006--durable-offline-queue-with-expo-sqlite) |
| Image boundary | Raw quarantine Storage or transient Function processing | [ADR-007](../architecture/DECISIONS.md#adr-007--direct-image-function-plus-private-sanitized-storage) |
| Map and location privacy | Alternative renderers, degree clustering, or stable metric approximation | [ADR-008](../architecture/DECISIONS.md#adr-008--maplibre-react-native-with-hosted-vector-tiles) and [ADR-010](../architecture/DECISIONS.md#adr-010--metric-server-clustering-and-stable-public-approximation) |
| On-device vision | ML Kit, cloud inference, or bundled TFLite | [ADR-009](../architecture/DECISIONS.md#adr-009--custom-bundled-tflite-via-react-native-fast-tflite) |
| Hosting | Self-hosted VPS stacks or managed Supabase | [ADRs 013, 015, and 016](../architecture/DECISIONS.md#adr-013--separate-stacks-on-one-vps) |
| Future visual similarity | Baseline dependency or optional later enhancement | [ADR-017](../architecture/DECISIONS.md#adr-017--optional-phase-2-visual-duplicate-suggestions) |
