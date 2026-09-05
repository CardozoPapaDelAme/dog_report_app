# Problem Context

## Problem

Information about stray/feral dog sightings and incidents in Creel is scattered,
making it difficult to identify concentration, frequency, trends, and severity.
Residents, tourists, hotels, the Association, and authorities lack a trustworthy
shared evidence base for action.

## Product response

The product centralizes low-friction reports and produces:

- a recent privacy-minimized public map; and
- accepted canonical business data for Association analysis/export.

Trust controls should reduce contamination without pretending heuristic evidence
is certainty. Hard judgments—moderation and duplicate confirmation—remain human.

## Stakeholders

| Stakeholder | Relationship |
|---|---|
| Tourists and residents | anonymous public reporters and public-map users |
| Association | read-only business consumer and geofence-approval authority |
| Administrator | report moderator and audited operational configurator |
| Technical operator | account/infrastructure/migration operator |
| Affiliated hotels and authorities | downstream recipients of Association exports |

## Scope boundaries

- Creel tourist-zone reporting, dogs only, one organizational tenant.
- No per-hotel accounts, public signup, separate web panel, heavy server ML,
  individual dog identification, or HA in the prototype.
- The INEGI urban-locality polygon may seed review but does not define the tourist
  zone until the Association approves it.
