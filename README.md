# Creel Stray-Dog Reporting App

A single React Native/Expo mobile app for anonymous stray-dog reports, a public
map, Asociación de Hoteles de Chihuahua business intelligence, and Administrator moderation in Creel,
Chihuahua. The prototype targets the Asociación de Hoteles de Chihuahua, A.C.

## Status

The mobile client is in the repository root. It includes the camera, the report
form with photo upload and offline draft queue, the public map (server clusters
and approximate pins, reached from **Ver mapa** on the camera screen) with a zone
report list and anonymous report flagging (**Denunciar**), staff login
(`GET /me`), the Administrator Command Center (moderation, thresholds, zone sets, duplicates) and
the Asociación de Hoteles de Chihuahua dashboard with CSV export. The backend
`api` Function serves all of these and is deployed to the staging project.

On 2026-10-01 the full server flow was exercised against staging with real
Administrator and Asociación sessions. Production report intake remains blocked
until the Asociación de Hoteles de Chihuahua approves a geofence version.

## Team setup

### Prerequisites

- Node.js 20+ and git, plus GitHub access to the repository.
- Optional, only for local native builds (option C): Xcode and CocoaPods (macOS,
  iOS) or Android Studio (Android SDK).
- Optional, only for cloud builds (option B): an Expo account (one teammate is
  enough), and for iOS a paid Apple Developer account.

```bash
git clone https://github.com/CardozoPapaDelAme/dog_report_app.git
cd dog_report_app
npm install
cp .env.example .env
```

Fill `.env` with publishable client configuration only (never a service key, never
commit it):

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | `https://dcvihomkxkutkckmjvmp.supabase.co/functions/v1/api` |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://dcvihomkxkutkckmjvmp.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key from Supabase → Project Settings → API Keys |
| `EXPO_PUBLIC_MAP_STYLE_URL` | Optional. MapLibre style URL for the public map; defaults to OpenFreeMap liberty (`https://tiles.openfreemap.org/styles/liberty`, no key). Attribution "© OpenMapTiles © OpenStreetMap contributors" must stay visible. Set a MapTiler style URL to switch providers without code changes |

For EAS cloud builds, `.env` is not uploaded (it is git-ignored): define the same
`EXPO_PUBLIC_*` values as EAS environment variables (`eas env:push` or `eas env:set`, or the
project's Environment variables page on expo.dev) instead of hardcoding them in
`eas.json`.

`GET /health` is live at
`https://dcvihomkxkutkckmjvmp.supabase.co/functions/v1/api/health`.
Client request paths are relative to the base URL (for example `/me`, not
`/api/me`). Use `services/apiClient.js` for HTTP.

Known limitation: the `api` Function implements no CORS handling, so a browser
preflight `OPTIONS` returns 404 and Expo web cannot call the live API. Use a
native client (Expo Go or a development build).

### Just want to review the app?

Non-developers and reviewers should follow [`docs/REVIEWING.md`](docs/REVIEWING.md):
Android installs a preview APK from a link (nothing else to install); iPhone uses
Expo Go with a QR shared by a teammate.

### Choose how to run

| Option | Best for | Map | Needs |
|---|---|---|---|
| A. Expo Go | Quick look, flagging, forms | No: shows a notice and a list of recent public reports (open one to flag it) | Expo Go app only |
| B. EAS development build (recommended) | Whole team, full map | Yes | One teammate with an Expo account builds; others install the link |
| C. Local development build | Each developer testing the full app on their own phone | Yes | Android Studio (any OS) or Xcode (Mac only) + a USB cable |

**A. Expo Go.** No native install. Everything works except the interactive map
(native MapLibre); **Ver mapa** shows the recent public reports instead, and
tapping one opens the report sheet and **Denunciar**. Native-only features
(TFLite validation, CSV share sheet) are also unavailable.

```bash
npx expo start
```

Open the project in Expo Go (scan the QR; add `--tunnel` if the phone is not on the
same network).

**B. EAS development build.** One teammate builds once:

```bash
npm i -g eas-cli        # or prefix every command with: npx eas-cli
eas login
eas init                # first time only; commit the projectId/owner it writes to app.json
eas env:push --environment development   # upload the EXPO_PUBLIC_* values from your local .env (non-secret only)
eas build --profile development --platform android
```

EAS builds do not read your local `.env` (it is git-ignored), hence the `env:push`
step (or `eas env:set --name ... --value ... --environment development --visibility plaintext`
per variable). Share the install link or QR printed by EAS (Android APK, internal distribution).
iOS needs a paid Apple Developer account: register each tester device with
`eas device:create`, then run `eas build --profile development --platform ios`
(or distribute through TestFlight). Everyone else installs the build once and runs:

```bash
npx expo start --dev-client
```

(`--tunnel` when the phone is on another network.) Rebuild only when native
dependencies or `app.json` plugins change; JavaScript changes reload from Metro.
Profiles live in `eas.json`: `development`, `preview` (internal APK) and
`production`. The app identifier is `com.wildogscanner.app` (iOS
`bundleIdentifier`, Android `package`).

**C. Local development build (full app on your own phone).** Compile and install
once; after that, code changes reload live with no reinstall.

*One-time setup*

| | Android | iPhone |
|---|---|---|
| Computer | Windows, macOS or Linux | **macOS only** |
| Install | [Android Studio](https://developer.android.com/studio) (includes the SDK) and JDK 17; set `ANDROID_HOME` | Xcode (App Store) and CocoaPods (`sudo gem install cocoapods` or `brew install cocoapods`) |
| Phone | Settings → About phone → tap *Build number* 7 times; then Developer options → **USB debugging** on. Connect by USB and accept the prompt (`adb devices` must list it) | Connect by USB, tap *Trust*. iOS 16+: Settings → Privacy & Security → **Developer Mode** on. In Xcode → Settings → Accounts add your Apple ID |
| Build and install | `npx expo run:android` | `npx expo run:ios --device` (pick your iPhone) |

The first build takes about 10–20 minutes; it installs the app on the phone.
Make sure `.env` is filled first (see the table above).

*Every day*

```bash
git pull
npm install
npx expo start --dev-client    # add --tunnel if the phone is on another network
```

Open the installed app; it loads the latest code from your computer and reloads
on save. Nothing is reinstalled.

*Rebuild only when native code changes*: run `npx expo run:android` /
`npx expo run:ios --device` again after a pull that adds or updates a native
library or changes `app.json` plugins (for example `package.json` gains an
`expo-*`, `react-native-*` or `@maplibre/*` dependency). PRs that do this should
say "requires rebuild".

*iPhone signing note*: with a free Apple ID the installed app expires after
**7 days**; run `npx expo run:ios --device` again to renew. A paid Apple
Developer account (99 USD/year) lasts one year.

*No Mac for iPhone or no Android Studio?* Use option A (Expo Go) for everything
except the interactive map and photo validation, or ask a teammate for an
option B build link.

Simulator location: in the iOS Simulator use Features → Location → Custom Location.
Mock locations are detected, and such reports go to moderation review instead of
auto-publishing.

### Run and test the app

1. Start the app with option A, B or C above.
2. Grant camera and **location** permissions. Report submission requires the
   phone's GPS to be inside the active staging geofence.
3. Staff accounts are provisioned manually (public signup is disabled). Ask the
   team for test credentials; never commit them. Each account needs a `profiles`
   row and a matching `app_metadata.app_role` (see
   [`docs/SECURITY.md`](docs/SECURITY.md)).

### Setup checklist for coding agents

Follow in order; stop and ask the human when a step needs a value you do not have.

1. `node --version` must be 20 or newer; `git --version` must work.
2. `npm install` in the repository root.
3. `cp .env.example .env` if `.env` is missing. Ask the human for the Supabase
   publishable key (and test credentials); take the URL values from the table above.
   Never invent keys, never use a service key, never commit `.env`.
4. Verify the backend: `curl -s https://dcvihomkxkutkckmjvmp.supabase.co/functions/v1/api/health`.
5. Decide the run mode: the human only wants to check forms/flagging, or has no
   native tooling, then A; the full map is needed and an Expo account exists, then B
   (human runs `eas login`, `eas init`; agents never handle Expo credentials);
   Xcode/Android Studio is already installed, then C.
6. Run the chosen command from the section above (`npx expo start`,
   `eas build --profile development --platform android` then
   `npx expo start --dev-client`, or `npx expo run:ios|android`). Never use
   `--dev-client` before a development build is installed on the device.
7. Verify: `npm run test:admin-ui` (Playwright, all UI suites) and
   `npx -y deno test --no-lock --config supabase/functions/api/deno.json services hooks models`
   must pass; see [`docs/TESTING.md`](docs/TESTING.md).

Staging currently has a **TEST ONLY** geofence covering the INEGI Creel candidate
plus the Chihuahua, Delicias and Meoqui municipalities, so the team can submit
reports from those cities. It is not approved and never goes to production; see
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
- Development and standalone builds validate each photo on-device (bundled
  MobileNetV3-Small via TFLite, offline): a non-dog or blurry photo asks for a
  retake with the reason. Expo Go and web skip validation and accept the photo
  (thresholds are provisional; model load and latency are only verifiable on a
  device). The dog colour is detected automatically from the photo (also in Expo
  Go/web) and shown as "Color detectado" in the form; you can change or clear it.
- The zone report list filters the latest 1000 public reports locally by distance from the cluster centre (approximate; edge reports may be missing).
- The public map needs network access and shows a message offline; reporting still works.
- The CSV share sheet requires the development build.
- In Expo Go the map is replaced by the recent public reports list (up to 100, newest first); flagging works the same.

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
