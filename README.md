# Creel Stray-Dog Reporting App

A single React Native/Expo mobile app for anonymous stray-dog reports, a public
map, Asociación de Hoteles de Chihuahua business intelligence, and Administrator moderation in Creel,
Chihuahua. The prototype targets the Asociación de Hoteles de Chihuahua, A.C.

## Status

The mobile client is in the repository root. It includes the camera, the report
form with photo upload and offline draft queue, the public map (server clusters
and approximate pins, reached from **Ver mapa** on the camera screen), staff login
(`GET /me`), the Administrator Command Center (moderation, thresholds, zone sets, duplicates) and
the Asociación de Hoteles de Chihuahua dashboard with CSV export. The backend
`api` Function serves all of these and is deployed to the staging project.

On 2026-10-01 the full server flow was exercised against staging with real
Administrator and Asociación sessions. Production report intake remains blocked
until the Asociación de Hoteles de Chihuahua approves a geofence version.

## Team setup

Need GitHub access. Then:

```bash
git clone https://github.com/CardozoPapaDelAme/dog_report_app.git
cd dog_report_app
npm install
cp .env.example .env
npx expo start --dev-client
```

Fill `.env` with publishable client configuration only (never a service key):

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | `https://dcvihomkxkutkckmjvmp.supabase.co/functions/v1/api` |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://dcvihomkxkutkckmjvmp.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key from Supabase → Project Settings → API Keys |
| `EXPO_PUBLIC_MAP_STYLE_URL` | Optional. MapLibre style URL for the public map; defaults to OpenFreeMap liberty (`https://tiles.openfreemap.org/styles/liberty`, no key). Attribution "© OpenMapTiles © OpenStreetMap contributors" must stay visible. Set a MapTiler style URL to switch providers without code changes |

`GET /health` is live at
`https://dcvihomkxkutkckmjvmp.supabase.co/functions/v1/api/health`.
Client request paths are relative to the base URL (for example `/me`, not
`/api/me`). Use `services/apiClient.js` for HTTP.

Known limitation: the `api` Function implements no CORS handling, so a browser
preflight `OPTIONS` returns 404 and Expo web cannot call the live API. Use a
native client (an Expo development build).

## Run and test the app

1. The public map uses native MapLibre, so the app needs an **Expo development
   build** (`expo-dev-client`); **Expo Go no longer runs the full app**. Build and
   install it once with `npx expo run:ios` (macOS with Xcode), `npx expo run:android`
   (Android SDK), or an EAS development build.
2. Run `npx expo start --dev-client` and open the installed development build. If
   the phone is not on the same network as the computer, use
   `npx expo start --dev-client --tunnel`.
3. Grant camera and **location** permissions. Report submission requires the
   phone's GPS to be inside the active staging geofence.
4. Staff accounts are provisioned manually (public signup is disabled). Ask the
   team for test credentials; never commit them. Each account needs a `profiles`
   row and a matching `app_metadata.app_role` (see
   [`docs/SECURITY.md`](docs/SECURITY.md)).

Staging currently has a **TEST ONLY** geofence covering the INEGI Creel candidate
plus the Chihuahua municipality, so the team can submit reports from Chihuahua
city. It is not approved and never goes to production; see
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md#current-staging-test-geofence).

Suggested walkthrough:

| Actor | Steps | Expected |
|---|---|---|
| Public | Camera → photo (or report without photo) → form → send | Report accepted; photo uploads |
| Public | Camera → **Ver mapa** → pan/zoom, tap a cluster, zoom to 17 or more, tap a pin | Clusters with counts and severity colour, six-type breakdown, then approximate pins with details and a flag notice when flagged; offline shows a message |
| Public | Camera → **Ver mapa** → tap a cluster → **Ver reportes de la zona** → tap a report → **Denunciar** | Area list of approximate reports; flag form with six reasons and optional detail; neutral thanks, "already flagged", "no longer flaggable", rate-limit minutes or offline retry; no counts or moderation state are shown |
| Administrator | Camera → **Acceso de personal** → login → Command Center | Pending reports in the queue |
| Administrator | Approve, hide, restore or delete with a note | State changes |
| Administrator | Thresholds, zone sets, duplicates | Publish a version, see the active zone set, resolve and reverse a group |
| Asociación | Login → dashboard (last 30 days) → export CSV | Accepted reports listed |

Behavior to expect:

- High-trust reports auto-publish (`high_trust_auto_publish`) and skip the
  moderation queue; they appear on the Asociación dashboard directly.
- A report outside the geofence is rejected with `400 invalid_coordinates`.
- On-device photo validation (TFLite) is not wired yet; every photo is accepted
  and real validation will need a development build.
- The zone report list filters the latest 1000 public reports locally by distance from the cluster centre (approximate; edge reports may be missing).
- The public map needs network access and shows a message offline; reporting still works.
- The CSV share sheet requires the development build.

For automated checks see [`docs/TESTING.md`](docs/TESTING.md):
`npm run test:admin-ui` (Playwright, includes `npm run test:public-map-ui`), `npm run test:auth`, and
`deno test --no-lock --config supabase/functions/api/deno.json supabase/functions/api`.

If a ticket needs the shared database, also run:

```bash
npx supabase login
npx supabase link --project-ref dcvihomkxkutkckmjvmp
```

Do not create a project, paste SQL, or run `db push` unless you are adding a
new file under `supabase/migrations/`.

## Database migrations (operators only)

```bash
npx supabase db push --dry-run
npx supabase db push
```

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
