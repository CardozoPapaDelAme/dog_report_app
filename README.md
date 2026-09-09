# Creel Stray-Dog Reporting App

A single React Native/Expo mobile app for anonymous stray-dog reports, a public
map, Asociación de Hoteles de Chihuahua business intelligence, and Administrator moderation in Creel,
Chihuahua. The prototype targets the Asociación de Hoteles de Chihuahua, A.C.

## Status

The mobile client skeleton (ALAN-0) is in the repository root. Product screens,
Auth, map, and the Hono backend are not started. Production report intake remains
blocked until the Asociación de Hoteles de Chihuahua approves a geofence version.

## Team setup

Need GitHub access. Then:

```bash
git clone https://github.com/jpDLG101/dog_report_app.git
cd dog_report_app
npm install
cp .env.example .env
npx expo start
```

Leave `EXPO_PUBLIC_API_BASE_URL` empty until the Hono API is deployed. Use
`services/apiClient.js` for HTTP. Expo Go is enough for the skeleton.

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
