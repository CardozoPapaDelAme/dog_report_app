# Reviewing the App

The simplest way for the team (and non-developers) to try the app against the
staging backend. Developers who change code follow the README "Choose how to run"
section instead.

## Pick your path

| Reviewer | Path | Needs | Full app (map, photo validation) |
|---|---|---|---|
| Android phone | **A. Install the preview APK** (recommended) | Only the install link | Yes |
| iPhone | **B. Expo Go + shared QR** | Expo Go app; a teammate running the dev server | No (map shows a report list; photo validation skipped) |
| iPhone, full app | **C. TestFlight** (later) | Apple Developer account on the team | Yes |

Nobody on paths A or B needs to clone the repository, install Node, Xcode or
Android Studio.

## A. Android: install the preview APK

**Reviewer:** open the install link (or scan its QR) on the phone, allow installing
from this source when Android asks, install, open **Creel Stray-Dog Reporting**. Done.

**One-time setup (one teammate with an Expo account, from the repository root):**

1. `npx eas-cli login` and, the first time only, `npx eas-cli init`. Commit the
   `extra.eas.projectId` it writes to `app.json`.
2. Store the public client values once in the EAS `preview` environment
   (they are publishable client config, not secrets). Easiest, from a filled local
   `.env`: `npx eas-cli env:push --environment preview`. Or one by one:

   ```bash
   npx eas-cli env:set --name EXPO_PUBLIC_API_BASE_URL --value https://dcvihomkxkutkckmjvmp.supabase.co/functions/v1/api --environment preview --visibility plaintext
   npx eas-cli env:set --name EXPO_PUBLIC_SUPABASE_URL --value https://dcvihomkxkutkckmjvmp.supabase.co --environment preview --visibility plaintext
   npx eas-cli env:set --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value <publishable key> --environment preview --visibility plaintext
   ```

   Repeat with `--environment development` for development builds.
3. Build: `npx eas-cli build --profile preview --platform android`.
4. Share the install link/QR that EAS prints (also on expo.dev → Builds).

Rebuild and share a new link whenever you want reviewers to get newer code
(`eas.json` profile `preview` bundles the JavaScript into the APK).

## B. iPhone (or no Expo account yet): Expo Go + shared QR

**Host (one teammate with the repo set up per README, mode A):**
`npx expo start --tunnel` and share the QR code (screenshot is fine). Keep the
computer and the command running while people review.

**Reviewer:** install **Expo Go** from the App Store / Play Store, scan the QR
(iPhone: Camera app; Android: inside Expo Go). The map screen shows a list of
recent reports instead of the interactive map, and photo validation is skipped
in Expo Go; everything else works.

## What to review

- Accounts: ask the team for test credentials (never post passwords in the repo
  or in public channels). Staff login is **Acceso de personal** on the camera
  screen.
- Location: reports are accepted only inside the staging TEST ONLY geofence
  (Creel, Chihuahua, Delicias, Meoqui); see
  [`DEPLOYMENT.md`](DEPLOYMENT.md#current-staging-test-geofence).
- Walkthrough and expected behaviour: README "Run and test the app".
- Report a problem with: screen, what you did, what you expected, and the
  **time** it happened (so the backend logs can be checked).

## Shareable message (Spanish)

> **Revisión de la app (staging)** 🐕
> - **Android:** instala desde este enlace: `<enlace del APK>` y abre la app.
> - **iPhone:** instala Expo Go y escanea este QR: `<QR>` (el mapa interactivo
>   no está en este modo; verás una lista de reportes).
> - Cuentas de prueba: te las paso por privado.
> - Solo acepta reportes dentro de Creel, Chihuahua, Delicias o Meoqui.
> - Si algo falla, dime en qué pantalla, qué hiciste y **a qué hora**.
