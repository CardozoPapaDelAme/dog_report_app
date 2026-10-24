import {loadFont as loadJakarta} from '@remotion/google-fonts/PlusJakartaSans';
import {loadFont as loadWork} from '@remotion/google-fonts/WorkSans';
import {loadFont as loadFredoka} from '@remotion/google-fonts/Fredoka';

// Tokens mirrored from the app's theme/colors.js ("Sierra Guardian").
export const colors = {
  background: '#f7fbf1',
  surface: '#ffffff',
  surfaceLow: '#f2f5ec',
  ink: '#191d17',
  inkMuted: '#41493e',
  inkSubtle: '#5d6859',
  outline: '#717a6d',
  outlineSoft: '#c0c9bb',
  border: '#e0e0e0',
  primary: '#00450d',
  primaryContainer: '#1b5e20',
  onPrimary: '#ffffff',
  primarySoft: '#d9f2d4',
  signal: '#e9e600',
  forestDeep: '#06300b',
  forestField: '#0a3a12',
  onForest: '#c9e6c4',
  onForestAlert: '#ffb4ab',
  forestLine: 'rgba(201, 230, 196, 0.22)',
  primaryFixed: '#91d78a',
  danger: '#ba1a1a',
  dangerSoft: '#ffdad6',
  warning: '#8a5700',
  warningSoft: '#fff0c2',
  severity: {high: '#b71c1c', medium: '#a64b00', low: '#2e7d32'},
} as const;

const jakarta = loadJakarta('normal', {weights: ['400', '600', '700'], subsets: ['latin']});
const work = loadWork('normal', {weights: ['500', '600', '700'], subsets: ['latin']});
const fredoka = loadFredoka('normal', {weights: ['500', '600'], subsets: ['latin']});

export const fonts = {
  body: jakarta.fontFamily,
  label: work.fontFamily,
  display: fredoka.fontFamily,
  system: '-apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
} as const;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Scene boundaries in seconds. Single source of truth: src/scenes.json (also read by scripts-audio.mjs).
import sceneTimes from './scenes.json';
export const scenes = sceneTimes;

export const sec = (s: number) => Math.round(s * FPS);
