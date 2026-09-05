# Creel Geofence Candidate

**Candidate version: `creel-inegi-2025-v0.1`. Status: NOT approved for
Production.** It is a reproducible technical candidate, not an official
Association boundary.

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
4. Have the Association approve the version and record the approver and approval
   timestamp through the zone activation command.
5. Activate the approved version in Staging, test inside/outside boundary cases,
   then promote the same checksum to Production.

## Activation gate

- Production starts fail-closed with no active geofence.
- Only an approved, valid, non-empty version may become active.
- Activation atomically replaces the prior active Production version, so a
  configuration command cannot leave Production with zero active geofences.
- `db/schema.sql` intentionally contains no placeholder polygon or candidate
  coordinates.

Until approval is recorded, report synchronization against Production must remain
disabled or return a clear `geofence_not_configured` error. RNF09 is therefore the
only known external implementation blocker.
