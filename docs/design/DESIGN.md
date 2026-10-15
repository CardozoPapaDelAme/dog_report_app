---
name: Sierra Guardian
description: Sistema visual de la app. Los valores de esta cabecera son los que implementa `theme/` (colors.js, fonts.js, typography.js, spacing.js, radius.js, shadows.js, motion.js); si cambian, cambian en los dos lugares.
colors:
  surface: '#f7fbf1'
  surface-dim: '#d8dbd2'
  surface-bright: '#f7fbf1'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f5ec'
  surface-container: '#ecefe6'
  surface-container-high: '#e6e9e0'
  surface-container-highest: '#e0e4db'
  on-surface: '#191d17'
  on-surface-variant: '#41493e'
  ink-subtle: '#5d6859'
  inverse-surface: '#2d322c'
  inverse-on-surface: '#eff2e9'
  outline: '#717a6d'
  outline-variant: '#c0c9bb'
  border: '#e0e0e0'
  surface-tint: '#2a6b2c'
  primary: '#00450d'
  on-primary: '#ffffff'
  primary-container: '#1b5e20'
  primary-soft: '#d9f2d4'
  on-primary-container: '#90d689'
  inverse-primary: '#91d78a'
  forest-deep: '#06300b'
  forest-field: '#0a3a12'
  on-forest: '#c9e6c4'
  on-forest-subtle: '#a9cfa5'
  on-forest-alert: '#ffb4ab'
  forest-line: 'rgba(201, 230, 196, 0.22)'
  forest-shade: 'rgba(0, 0, 0, 0.14)'
  signal: '#e9e600'
  secondary: '#636100'
  on-secondary: '#ffffff'
  secondary-container: '#e9e600'
  on-secondary-container: '#676600'
  tertiary: '#6b1d3d'
  on-tertiary: '#ffffff'
  tertiary-container: '#883454'
  on-tertiary-container: '#ffaec6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#acf4a4'
  primary-fixed-dim: '#91d78a'
  on-primary-fixed: '#002203'
  on-primary-fixed-variant: '#0c5216'
  secondary-fixed: '#ece900'
  secondary-fixed-dim: '#cfcc00'
  on-secondary-fixed: '#1d1d00'
  on-secondary-fixed-variant: '#4a4900'
  tertiary-fixed: '#ffd9e2'
  tertiary-fixed-dim: '#ffb1c8'
  on-tertiary-fixed: '#3e001d'
  on-tertiary-fixed-variant: '#7a2949'
  background: '#f7fbf1'
  on-background: '#191d17'
  surface-variant: '#e0e4db'
  danger-alert: '#D32F2F'
  warning: '#8a5700'
  warning-amber: '#FFA000'
  warning-soft: '#fff0c2'
  info: '#0b4f8a'
  mountain-sky: '#E3F2FD'
  surface-dark: '#121212'
  scrim: 'rgba(17, 25, 15, 0.55)'
  glass: 'rgba(18, 18, 18, 0.56)'
  severity-high: '#b71c1c'
  severity-medium: '#a64b00'
  severity-low: '#2e7d32'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  input:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  caption:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  button:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 22px
  label:
    fontFamily: Work Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
  label-caps:
    fontFamily: Work Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-number:
    fontFamily: Work Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 24px
  display-brand:
    fontFamily: Fredoka
    fontSize: '26px to 76px'
    fontWeight: '600'
rounded:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  pill: 999px
spacing:
  unit: 4px
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  xxl: 24px
  xxxl: 32px
  gutter: 16px
  margin-mobile: 20px
  min-touch: 44px
  safe-area-bottom: 34px
elevation:
  card: 'opacity 5%, blur 4px, y 1px'
  raised: 'opacity 10%, blur 16px, y 4px'
  overlay: 'opacity 18%, blur 24px, y 8px'
motion:
  fast: 150ms
  base: 250ms
  slow: 400ms
---

## Brand & Style

The design system is built for the high-altitude, rugged context of Creel, Chihuahua, blending the urgent, camera-first utility of Snapchat with the professional reliability of a safety tool. The brand personality is **vigilant, accessible, and civic-minded**, with a friendly, dog-themed identity: it must feel like an official utility for the Hotel Association while remaining intuitive for tourists and locals reporting incidents in real-time.

The visual style is **Corporate / Modern with a "Utility-Focused" edge and a recurring paw motif**. It uses high-visibility green to signal safety and environmental harmony (Nature/Security), contrasted with sharp, high-alert signals for danger. The interface prioritizes speed through a flat, layered architecture that keeps the camera and map at the center of the user experience.

- **Fast & Responsive:** Minimalist overlays that don't obscure the camera view.
- **Bilingual Utility:** Clear, legible layouts that accommodate both Spanish and English without breaking the grid.
- **Trustworthy:** Professional finishes that elevate the app from a simple social tool to a serious community safety initiative.
- **Dog-themed, never military or mountaineering:** a single large paw per green header (or a paw trail on empty space), tips pointing up; no topographic lines, no signage typography.

The reasoning behind each approved and rejected choice, and the rules for new screens, are in [`../redesign/TASTE.md`](../redesign/TASTE.md).

## Colors

The palette is anchored by **Forest Security Green** (`primary` `#00450d`), a professional tone that represents both the nature of the Sierra Tarahumara and the concept of safety. Every color used by a screen comes from `theme/colors.js`; screens do not declare hex literals.

- **Primary Green:** Main actions, headers, titles and "safe" report types. Deeper greens (`forest-deep`, `forest-field`) build dark fields and bands on top of the primary; `on-forest*` are the text and line colors used on them.
- **Signal Yellow (`signal` `#e9e600`):** The **one** primary action per screen or bar (Sign in, Save, Send report, Query). Never used for icons or secondary actions. Text on it is `forest-deep` (11:1).
- **Alert Colors:** A strict semantic system. `danger-alert` is reserved for attacks or immediate threats; `error`/`error-container` for failures; `warning-amber` for borders and icons only, never text (`warning` is the text color).
- **Severity colors** (`severity-high/medium/low`) fill map clusters, map pins, queue pins and tags. They deliberately **differ from the original `map-cluster` tokens** (`#B71C1C`, `#F57C00`, `#43A047`): white text on the original medium and low was 2.7:1 and 2.8:1, below AA. The implemented values keep white text at 4.5:1 or more.
- **Neutral Foundation:** Cream-green surfaces (`background`), white cards and hairline borders keep the interface readable under the high-altitude sun. Secondary text never goes below `ink-subtle` (5.6:1 on `background`).
- **Overlays:** `scrim` dims content behind sheets; `glass` is a translucent dark capsule fill used over the camera and map. There is no real blur.

## Typography

Three families with fixed roles, all loaded through `theme/fonts.js` (`@expo-google-fonts/*`):

- **Plus Jakarta Sans** (400, 600, 700): body, titles of lists and rows, buttons and controls. Highly legible geometric forms for bilingual descriptions.
- **Work Sans** (500, 600, 700): functional labels and data (`label`, `label-caps`, `data-number`) with tabular figures for counts, dates and coordinates.
- **Fredoka** (500, 600): the friendly rounded brand voice. Used for screen titles, the one protagonist number of a header, the name of a repeated element (the incident in the moderation queue), section titles and key buttons. Not for running text.

Rules:
- **Language Support:** All scales are tested for English and Spanish; avoid tight letter-spacing on body text to accommodate longer Spanish word strings.
- **Minimum size** is 13 px for text (12 px only for hairline labels with 8:1 contrast).
- **Single-line fields do not declare `lineHeight`** (`type.input`): on iOS a line height larger than the font size pushes the text below the middle of the field. Multiline fields set `lineHeight` 22.
- **Dynamic Type** is left at the platform default; text containers use `minHeight` and wrap instead of capping the multiplier.

## Layout & Spacing

The layout is a **fluid grid** system designed for a camera-first experience, on a 4 px baseline (`spacing` scale) with a 16 px gutter and 20 px mobile margin.

- **Camera Viewport:** The primary screen is a full-bleed camera interface. Controls sit over **gradient scrims** (`Scrim`, top and bottom), not over a flat black percentage, so they read on any image. Pinch zooms.
- **Map Interaction:** The map is the full-screen base layer; controls float over it (a round white back button, a one-line status capsule). Cluster and report information appears as compact cards and bottom sheets. Tapping a cluster moves the camera to the next clustering band of the server and opens a compact card **without dimming** the map.
- **Green headers:** Configuration, Zones, Duplicates, Command Center and Association share one vocabulary: a forest-green header with a large cropped paw, a Fredoka title, and a light body. The paw must be visible in full, not peek out below the header.
- **Administrator screens** use inbox rows (full-width strips with hairlines and a gap between them) instead of stacked cards, a flat action bar per row, and lists paginated by `Pager` where they can be long (3 per page in Duplicates, 5 in Association).
- **Dashboard:** Cards on mobile, a table from 900 px wide, never both.
- **Touch targets** are at least `min-touch` (44 px), with `hitSlop` where the visible control is smaller.

## Elevation & Depth

The system uses **tonal layers and soft shadows**, not heavy shadows and not real blur (the Glassmorphism/backdrop-blur in the original brief was not adopted: it costs performance on Android and was not needed for legibility once scrims were added).

- **The Viewfinder Layer:** The camera is the absolute base. Elements on top of it use translucent dark capsules (`glass`) and gradient scrims.
- **Sheets:** `Sheet` slides up with a dimmed `scrim` backdrop that is also the dismiss target; it uses the `overlay` shadow. Sheets that can open on top of one another share one system window (`SheetHost`), because iOS cannot present a modal over another modal.
- **Surface Tiers:**
    - **Level 0:** Camera/Map (Base)
    - **Level 1:** Rows, strips and containers (solid surface, hairline borders; `card` shadow only when elevation carries meaning)
    - **Level 2:** Floating buttons, capsules and sheets (`raised`/`overlay` shadows)

## Shapes

The shape language is **Rounded (Level 2)**.

- **Buttons:** `AppButton` uses `rounded.lg` (16); the Login and the flat action bars lower it to 12 (`rounded.md`). The capture button is a circle.
- **Cards & Dashboard Modules:** 16 px (`rounded.lg`). Bottom sheets round their top corners to 24 px (`rounded.xl`).
- **Map mode switch and compass:** a slim vertical icon switch flush with the right edge (clusters over heatmap) swaps the cluster markers for a green-to-red density layer built from individual reports weighted by severity. A round white compass appears under it only while the map is rotated, counter-rotates with the map, fades out once north is restored, and returns the map to north on tap.
- **Map Clusters:** Perfect circles that scale with the report count (the scale is a tested contract, see `docs/redesign/CONTRACT.md`).
- **Input Fields:** 8 px (`rounded.sm`).
- **Chips and capsules:** `pill`.

## Components

Shared components live in `components/ui/` and are the only place where buttons, fields, sheets and banners are defined.

- **AppButton:** variants `primary`, `secondary`, `ghost`, `destructive`, `glass`, `signal`; sizes `md`, `lg`; pressed, disabled and loading states; a guard against double taps.
- **AppTextField:** label above the field (never placeholder-as-label), `tone="dark"` for green screens, error and helper text.
- **IconButton, Icon:** semantic names mapped to `lucide` glyphs in one place (`components/ui/Icon.js`); icon-only controls always carry an accessible label.
- **Chip:** status and incident labels. "Ataque" always uses `danger-alert` with white text.
- **Banner, StateView:** inline messages, and the loading/empty/error states of every screen (the moderation queue loads with skeleton rows).
- **Sheet / SheetHost:** bottom sheets in-screen or `modal`, with optional keyboard avoidance and safe-area bottom padding. No grabber bar: the dimmed backdrop is the dismiss affordance.
- **PhotoViewer:** a full-screen view of a report photo over everything else, closed by tapping anywhere.
- **Pager:** previous/next with a "page x of y" label for long lists; renders nothing when everything fits in one page.
- **PawTrail, Scrim:** the paw-trail motif and the gradient overlays.
- **PinGlyph:** the report marker, one teardrop silhouette with a continuous white outline, a same-shape shadow, a paw inside and an amber badge when flagged. Colored by severity; gray when the report is hidden. Used on the map and in the moderation queue.
- **Capture Button:** a single white-outlined circle (78 px). The danger/attack pulse of the original brief was not implemented.
- **Map Markers:**
    - *Individual:* `PinGlyph` (48 × 62 at scale 1), the tip on the report's coordinate.
    - *Clusters:* circular badges with a count and a halo, colored by the highest severity inside; the inner button keeps the diameter contract.
- **Report Details:** a "ficha" sheet: photo (tap to open it full size), severity stripe, title and date, a two-column grid of facts, "Close" as a button and "Report" as a red link with a flag.
- **Moderation Row:** pin, incident name (Fredoka), date, neutral status, only the signals that exist (trust, flags, photo), tabular coordinates, and a flat three-cell action bar of equal size (green approve, ink hide/restore, red delete).
- **Association Report Strip:** the same structure as the moderation row (pin, incident name, date, only the known signals, tabular coordinates) without actions, plus the full report id in small gray text at the foot.
- **Photo Validator / Camera Notices:** one-line dark capsules (icon + text) in the top third of the camera; "photo rejected" clears itself after 5 seconds.

## Implementation map

| Concern | Where |
|---|---|
| Color, type, spacing, radius, shadow, motion tokens | `theme/` |
| Font files and family names | `theme/fonts.js` (loaded in `App.js`; web fixtures register the same names) |
| Shared components | `components/ui/` |
| Rules and history for each screen | [`../redesign/TASTE.md`](../redesign/TASTE.md) |
| Untouchable test contract | [`../redesign/CONTRACT.md`](../redesign/CONTRACT.md) |
| React Native 0.86 note | Use `StyleSheet.absoluteFill`; `absoluteFillObject` no longer exists (guarded by `tests/ui/noRemovedStyleApis.spec.js`) |
