# Creel Stray-Dog Reporting App

A single React Native/Expo mobile app for anonymous stray-dog reports, a public
map, Asociación de Hoteles de Chihuahua business intelligence, and Administrator moderation in Creel,
Chihuahua. The prototype targets the Asociación de Hoteles de Chihuahua, A.C.

## Status

**Implementation-ready target contracts; implementation has not started.** The
documentation and authoritative SQL schema are aligned. Production report intake
remains blocked until the Asociación de Hoteles de Chihuahua approves a geofence version.

## Start here

1. [`docs/README.md`](docs/README.md) — source precedence and documentation map
2. [`docs/product/README.md`](docs/product/README.md) — product-document path
3. [`docs/architecture/OVERVIEW.md`](docs/architecture/OVERVIEW.md) — current
   architectural shape

The immutable Spanish SRS remains the origin of RF01–RF24, RNF01–RNF36, and
HU-01–HU-24. Approved clarifications govern implementation where that source is
ambiguous or superseded. The documentation index identifies the authoritative
owner for every topic.

## Current blocker

Production report intake remains fail-closed until the Asociación de Hoteles de Chihuahua approves a
specific geofence version. See
[`docs/product/GEOFENCE-CANDIDATE.md`](docs/product/GEOFENCE-CANDIDATE.md).
