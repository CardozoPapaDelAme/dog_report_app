# Problem Context

## The problem

In Creel, Chihuahua — a tourist town in the Barrancas del Cobre (Copper Canyon)
region — there is a persistent presence of stray and feral dogs that can pose a
risk to residents, tourists, pets, and livestock.

Today, information about sightings and incidents is **scattered and not recorded
systematically**. This makes it hard to:

- Identify which zones have the greatest dog presence.
- Recognize risk patterns.
- Understand the frequency and severity of incidents.

Without organized information, residents, hoteliers, associations, and authorities
cannot get a clear picture of the situation or make informed decisions about
high-risk areas.

## The client

**Asociación de Hoteles de Chihuahua, A.C.** — a nonprofit civil association (A.C.)
representing affiliated hotels across Chihuahua state. The app is built for them.

Because the client is a dues-funded nonprofit (not a commercial intermediary), the
product deliberately avoids tiered/commercial access models. A single, simple
access model fits better (see `SOLUTION-EXPLORATION.md`).

## Stakeholders

| Stakeholder | Role in the system |
|---|---|
| Tourists & residents | Anonymous reporters; consumers of the public map |
| Affiliated hoteliers / the Association | Consumers of BI; strategy design |
| Administrator (operated by the Association) | Moderates reports, manages quality |
| Local authorities | Potential downstream consumers of exported data |

## Goal

Centralize reports and generate **geographic and statistical intelligence** that
lets the Association visualize the distribution of sightings and incidents in Creel
and do Business Intelligence on it.

## Geographic scope

Creel's tourist zone specifically. The zone is modeled as a **data attribute** (a
geographic polygon used for geofencing), **not** as a tenant boundary. There is no
multi-city / multi-tenant architecture in scope (see `docs/architecture/DECISIONS.md`).

## Subject scope

**Dogs only.** Sterilization-campaign tracking is noted as a possible future feature
within that scope but is not part of the current prototype.
