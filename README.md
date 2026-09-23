# Creel Stray-Dog Reporting App

A single React Native/Expo mobile app for anonymous stray-dog reports, a public
map, Asociación de Hoteles de Chihuahua business intelligence, and Administrator moderation in Creel,
Chihuahua. The prototype targets the Asociación de Hoteles de Chihuahua, A.C.

## Status

The mobile client is in the repository root and includes moderation and threshold
configuration screens. The backend includes identity (`GET /me`), configuration,
zones, duplicate resolution and report intake. Implementation does not imply
deployment or validation with a real Administrator session. Production report
intake remains blocked until the Asociación de Hoteles de Chihuahua approves a
geofence version.

### Threshold configuration (FAB-4)

With an Administrator session supplied through `App.accessToken`, open
**Configurar umbrales** from moderation. The screen loads the eight numeric FAB-1
thresholds, requires a new change reason and displays validation beside each
field. `index.js` does not yet supply a login/session; the screen uses the team's
existing token integration point. It never embeds a test token or real credential.
See [`docs/TESTING.md`](docs/TESTING.md#fab-4--l4-configuration-form) for isolated
UI tests and the remaining managed-session check.

## Team setup

Need GitHub access. Then:

```bash
git clone https://github.com/jpDLG101/dog_report_app.git
cd dog_report_app
npm install
cp .env.example .env
npx expo start
```

`GET /health` is live at
`https://dcvihomkxkutkckmjvmp.supabase.co/functions/v1/api/health`.
Set `EXPO_PUBLIC_API_BASE_URL` to
`https://dcvihomkxkutkckmjvmp.supabase.co/functions/v1/api`.
Use `services/apiClient.js` for HTTP. Expo Go is enough for the skeleton;
MapLibre and TFLite later need a development build.

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
