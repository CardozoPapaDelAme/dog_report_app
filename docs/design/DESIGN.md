---
name: Sierra Guardian
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
  inverse-surface: '#2d322c'
  inverse-on-surface: '#eff2e9'
  outline: '#717a6d'
  outline-variant: '#c0c9bb'
  surface-tint: '#2a6b2c'
  primary: '#00450d'
  on-primary: '#ffffff'
  primary-container: '#1b5e20'
  on-primary-container: '#90d689'
  inverse-primary: '#91d78a'
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
  warning-amber: '#FFA000'
  mountain-sky: '#E3F2FD'
  surface-dark: '#121212'
  map-cluster-high: '#B71C1C'
  map-cluster-med: '#F57C00'
  map-cluster-low: '#43A047'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
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
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
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
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 32px
  safe-area-bottom: 34px
---

## Brand & Style

The design system is built for the high-altitude, rugged context of Creel, Chihuahua, blending the urgent, camera-first utility of Snapchat with the professional reliability of a safety tool. The brand personality is **vigilant, accessible, and civic-minded**. It must feel like an official utility for the Hotel Association while remaining intuitive for tourists and locals reporting incidents in real-time.

The visual style is **Corporate / Modern with a "Utility-Focused" edge**. It uses high-visibility green to signal safety and environmental harmony (Nature/Security), contrasted with sharp, high-alert signals for danger. The interface prioritizes speed through a flat, layered architecture that keeps the camera and map at the center of the user experience.

- **Fast & Responsive:** Minimalist overlays that don't obscure the camera view.
- **Bilingual Utility:** Clear, legible layouts that accommodate both Spanish and English without breaking the grid.
- **Trustworthy:** Professional finishes that elevate the app from a simple social tool to a serious community safety initiative.

## Colors

The palette is anchored by **Forest Security Green**, a professional tone that represents both the nature of the Sierra Tarahumara and the concept of safety. 

- **Primary Green:** Used for main actions, navigation, and "safe" report types (sightings).
- **Secondary Yellow:** A nod to the Snapchat inspiration, used sparingly for "active" capture states or to highlight high-priority instructional tips.
- **Alert Colors:** A strict semantic system for warnings. `danger-alert` is reserved for attacks or immediate threats, while the `map-cluster` tokens provide dynamic feedback on the severity of reports in a specific geographic area.
- **Neutral Foundation:** We utilize high-contrast blacks and soft greys to ensure the interface remains readable under the intense high-altitude sun of Creel.

## Typography

This design system uses **Plus Jakarta Sans** as the primary typeface for its modern, friendly, and highly legible geometric forms. This choice ensures the app feels "contemporary" like a social tool but remains highly readable for bilingual descriptions.

- **Headlines:** Use Bold weights to create a strong hierarchy, especially on the Camera and Dashboard screens.
- **Labels:** **Work Sans** is used for functional labels and data points in the statistics dashboard for its neutral, "straightforward" character.
- **Data-Heavy Views:** The `data-number` token is optimized for statistical clarity in the hotelier's administrative panel.
- **Language Support:** All scales are tested for English and Spanish; avoid tight letter-spacing on body text to accommodate longer Spanish word strings.

## Layout & Spacing

The layout is a **fluid grid** system designed for a camera-first experience. 

- **Camera Viewport:** The primary screen is a full-bleed camera interface. UI elements (capture button, flash, settings) are anchored to the edges with a 20px safe-margin.
- **Map Interaction:** Uses a "floating" container model where the map is the base layer and information clusters or the "Report" drawer slide up from the bottom (Sheet behavior).
- **Dashboard:** Follows a 2-column or 4-column grid for statistics depending on the device width, ensuring that data density remains manageable for hotel administrators.
- **Spacing Rhythm:** Based on a 4px baseline. Gutters between cards and dashboard elements should consistently be 16px to maintain a "clean" and "professional" look.

## Elevation & Depth

To maintain the Snapchat-inspired modern feel, the design system utilizes **Glassmorphism and Tonal Layers** rather than heavy shadows.

- **The Viewfinder Layer:** The camera is the absolute base. Elements on top of the camera (like the "Report without photo" button) use a backdrop-blur (20px) and a semi-transparent white or dark fill to ensure legibility without feeling disconnected from the camera feed.
- **Map Overlays:** Cluster breakdown modals use a soft, ambient shadow (10% opacity, 16px blur) to appear "lifted" off the map.
- **Surface Tiers:**
    - **Level 0:** Camera/Map (Base)
    - **Level 1:** Cards and interactive containers (Solid surface).
    - **Level 2:** Floating buttons and navigation bars (Blurred backdrop).

## Shapes

The shape language is **Rounded (Level 2)**. This strikes a balance between the soft, friendly nature of a "community" app and the structured look of a security utility.

- **Primary Buttons:** Use a `rounded-lg` (16px) or full pill-shape for the capture button.
- **Cards & Dashboard Modules:** Use a consistent 16px (`rounded-lg`) corner radius.
- **Map Clusters:** Perfect circles that scale in size based on the density of the reports they contain.
- **Input Fields:** 8px (`rounded`) corners to maintain a professional, structured form for administrative data entry.

## Components

- **Capture Button:** A large, dual-ring pill button. Inner circle: White. Outer ring: Primary Green. When reporting a "Danger/Attack," the outer ring pulses in `danger-alert` red.
- **Map Markers:**
    - *Individual:* Teardrop pin with a small dog icon. 
    - *Clusters:* Circular badges with a count number. Color changes dynamically (Green -> Amber -> Red) based on the highest severity incident within the cluster.
- **Dashboard Cards:** White background, subtle 1px border (`#E0E0E0`), and 16px rounded corners. Includes a top-right "Severity Tag" for quick filtering.
- **Report Drawer:** A bottom-sheet component that slides up 40% for quick selection and 90% for full form entry. Uses a "grabber" bar at the top center.
- **Status Chips:** Small, high-contrast labels (e.g., "Avistamiento", "Ataque"). "Ataque" always uses `danger-alert` background with white text.
- **Photo Validator:** A floating "Toast" overlay that appears in the top third of the camera. If the AI detects "No dog found" or "Blurry," it displays a subtle amber warning icon with a `warning-amber` border.