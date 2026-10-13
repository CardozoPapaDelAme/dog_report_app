/**
 * @module theme/colors
 * Single source of color tokens ("Sierra Guardian", docs/design/DESIGN.md). Screens and components import
 * these instead of declaring hex literals. Contrast ratios noted are against the listed background (WCAG).
 */
export const colors = {
  background: '#f7fbf1',
  surface: '#ffffff',
  surfaceLow: '#f2f5ec',
  surfaceContainer: '#ecefe6',
  surfaceHigh: '#e6e9e0',
  ink: '#191d17', // on background 16:1
  inkMuted: '#41493e', // on-surface-variant, 8.9:1 on background; use for secondary text
  inkSubtle: '#5d6859', // 5.6:1 on background; minimum for any text
  outline: '#717a6d',
  outlineSoft: '#c0c9bb',
  border: '#e0e0e0',
  primary: '#00450d', // 10.8:1 on background
  primaryContainer: '#1b5e20',
  onPrimary: '#ffffff',
  primarySoft: '#d9f2d4',
  onPrimarySoft: '#00450d',
  danger: '#ba1a1a', // 6.5:1 on white
  dangerAlert: '#d32f2f', // attacks and immediate threats only
  dangerSoft: '#ffdad6',
  onDangerSoft: '#93000a',
  warning: '#8a5700', // 5.4:1 on warningSoft
  warningAmber: '#ffa000', // borders and icons, never text
  warningSoft: '#fff0c2',
  info: '#0b4f8a',
  infoSoft: '#e3f2fd',
  /** Map clusters/pins by severity. White text on every one of these is >= 4.5:1. */
  cluster: { high: '#b71c1c', med: '#a64b00', low: '#2e7d32' },
  scrim: 'rgba(17, 25, 15, 0.55)',
  glass: 'rgba(18, 18, 18, 0.56)',
  onGlass: '#ffffff',
  transparent: 'transparent',
};
