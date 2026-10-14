/**
 * @module theme/typography
 * Named text styles (DESIGN.md scale). Plus Jakarta Sans for titles/body, Work Sans for labels and numbers
 * (tabular figures). Minimum body size is 13 px for legibility in direct sun.
 */
import { fontFamily } from './fonts.js';
import { colors } from './colors.js';

const tabular = { fontVariant: ['tabular-nums'] };

export const type = {
  display: { fontFamily: fontFamily.bold, fontSize: 40, lineHeight: 48, letterSpacing: -0.8, color: colors.ink },
  headline: { fontFamily: fontFamily.bold, fontSize: 24, lineHeight: 32, color: colors.ink },
  title: { fontFamily: fontFamily.semibold, fontSize: 18, lineHeight: 24, color: colors.ink },
  body: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24, color: colors.ink },
  /** Text inside single-line fields: no `lineHeight`, which on iOS pushes the text below the middle of the field. */
  input: { fontFamily: fontFamily.regular, fontSize: 16, color: colors.ink },
  bodySmall: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  caption: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: colors.inkMuted },
  button: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: fontFamily.label, fontSize: 13, lineHeight: 16, color: colors.inkMuted },
  labelCaps: { fontFamily: fontFamily.label, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.inkMuted },
  number: { fontFamily: fontFamily.number, fontSize: 20, lineHeight: 24, color: colors.ink, ...tabular },
  numberSmall: { fontFamily: fontFamily.labelMedium, fontSize: 14, lineHeight: 20, color: colors.ink, ...tabular },
};
