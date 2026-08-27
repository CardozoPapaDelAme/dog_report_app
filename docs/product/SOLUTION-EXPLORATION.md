# Solution Exploration

How the current approach was reached — the alternatives considered and why they
were accepted or rejected. Decision records with more formal framing live in
`docs/architecture/DECISIONS.md`; this file is the narrative.

## Reference point: FeralScan (Australia)

FeralScan / WildDogScan was used as a **conceptual reference** for the category
(community wildlife/pest reporting), not as a model to copy. Research spanned other
solutions too (HSIApps India, Taiwan's dog tracking map, Ushahidi, municipal Mexican
apps, academic WebGIS). Gaps no existing solution covered well for this context:
the tourism/hotel sector as the data consumer, a bilingual tourist-first UX, and
the specific nonprofit-association ownership model.

## Access model: tiered/commercial → single simple tier

An early idea was a tiered access model (view-only vs. export) with commercial
monetization. Once the client was correctly understood as a **dues-funded nonprofit
civil association**, that framing was dropped. The final model is a single
Association account + a single Administrator account, both provisioned manually.
No feature tiers, no per-hotel accounts, no separate payment.

## Architecture: multi-tenant → single-tenant

An earlier assumption was multi-tenant, multi-city scaling. This was **explicitly
corrected**: the system is single-tenant. City/zone is a data attribute, not a
tenant boundary. This should not be reintroduced.

## Backend: managed BaaS → self-hosted Supabase

Considered: Firebase or Supabase Cloud (managed) vs. self-hosting. Chosen:
**Supabase self-hosted via Docker** on an OVHcloud VPS, to reduce operational
dependency on a managed provider while keeping Supabase's Auth, RLS, PostgREST,
Storage, and Studio. Trade-off accepted: the team is responsible for patching the
stack. (See DECISIONS.)

## Deployment: manual reverse proxy → Dokploy

Initially the plan specified Nginx/Caddy configured by hand. The project moved to
**Dokploy** (an open-source self-hosted PaaS), which provides a one-click Supabase
template, an integrated Traefik reverse proxy with automatic SSL, and built-in DB
backups. This replaced the manual Nginx/Caddy step. SSH hardening is still required
separately — the Dokploy panel does not replace it.

## Dog differentiation: the hard question

The team wanted the photo to carry real weight, not just be a text report with an
image. This raised: can we tell dogs apart?

- **Visual re-identification** ("is this the same dog?") via DINOv2 embeddings is
  powerful but needs server-side compute (GPU or dedicated inference) the 8 GB/4-core
  VPS can't provide, and it breaks offline-first for that function. → **Deferred to a
  future phase (RNF35).**
- **Simple attributes** (color, size, collar) are cheap. Color can be extracted
  on-device by pixel analysis; size and collar are optional manual inputs. These feed
  the confidence score and the duplicate heuristic without claiming individual
  identification. → **In scope (RF22).**

### Key clarification that unblocked this

"On-device" ≠ "on our VPS". The dog/no-dog + quality classifier (RF09) runs on the
**user's phone** using a standard lightweight model (MobileNet/EfficientNet-Lite via
TF Lite, or ML Kit). The VPS never processes the photo for classification. So the
photo pillar is fully viable; only heavy server-side ML is deferred.

## Duplicate detection: heuristic now, visual later

RF23 groups possible duplicates using cheap signals the VPS can handle: spatial
proximity (PostGIS) + temporal proximity + shared attributes. It never merges or
hides automatically — it queues candidates for the admin. Visual similarity
(embeddings) would be the future-phase upgrade (RNF35).

## Dynamic form: JSONB with validated structure

The report form is conditional per incident type. Rather than many mostly-null
columns (rigid) or a free-form blob (unsafe), the design uses a **JSONB `details`
column with a documented, DB-validated contract per incident type** — flexible but
structured. See `docs/DATA-MODEL.md`.
