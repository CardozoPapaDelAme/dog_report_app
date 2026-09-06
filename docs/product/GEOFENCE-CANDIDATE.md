# Creel Geofence Candidate

This document owns candidate provenance and the external approval procedure. It
does not declare the candidate suitable for live use.

**Candidate version: `creel-inegi-2025-v0.1`. Status: NOT approved for live use.**
It is a reproducible technical candidate, not an official
Association boundary. In a demo managed project it may be loaded only as a
clearly labeled candidate/test fixture.

## Source record

| Field | Value |
|---|---|
| Publisher | INEGI |
| Dataset | Marco Geoestadístico, December 2025 |
| Endpoint | `https://gaia.inegi.org.mx/wscatgeo/v2/geo/localidades/pol/buscar/Creel` |
| Retrieved | 2026-09-03 |
| Locality | Creel (`cvegeo=080090034`, Chihuahua `08`, Bocoyna `009`, locality `0034`) |
| Geometry | One `MultiPolygon`, 743 returned vertices |
| Returned bounds | longitude `-107.645678471` to `-107.627023700`; latitude `27.731557511` to `27.768202781` |
| Response SHA-256 | `b07c4075f8ab30abea4fbea2b9c8ab7672d93d58a9e31477d30fe7e48b048ef3` |

INEGI labels the feature as the urban locality polygon. That does not prove it
matches the Association's intended “tourist zone.” The endpoint also emits CRS
metadata that must be reviewed during GIS import; do not assume coordinate
metadata from the payload is sufficient without validation.

## Import and review procedure

1. Retrieve the exact endpoint and retain the raw response, retrieval timestamp,
   and checksum in deployment evidence (not in the mobile bundle).
2. Open the feature in QGIS, validate/repair geometry if necessary, and explicitly
   transform it to EPSG:4326 before database import.
3. Visually compare roads, known tourist areas, and the candidate edge. Record any
   proposed edits as a new version; never alter an activated version in place.
4. Have the Association approve the exact version/checksum outside the application
   and retain evidence containing the approver identity and approval time. The zone
   activation command stores only an external approval reference and a server
   timestamp; it does not structurally store or verify the Association approver.
5. Test inside/outside boundary cases in a demo/test managed project with the
   geometry labeled as a candidate fixture. Activate the same checksum in a live
   project only after approval.

## Activation gate

- A live/Production project starts fail-closed with no active geofence.
- Only an approved, valid, non-empty version may become active.
- Activation atomically replaces the prior active live version, so a
  configuration command cannot leave that environment with zero active geofences.
- [`../../db/schema.sql`](../../db/schema.sql) intentionally contains no placeholder
  polygon or candidate coordinates.

Until approval is recorded, report synchronization against a live project must
remain disabled or return a clear `geofence_not_configured` error. RNF09 is
therefore the only known external implementation blocker.
