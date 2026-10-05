// Map style configuration. OpenFreeMap is the interim tile provider (ADR-008 follow-up);
// MapTiler or another provider can be swapped by setting EXPO_PUBLIC_MAP_STYLE_URL.
export const DEFAULT_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
// OpenFreeMap requires this attribution to stay visible.
export const MAP_ATTRIBUTION_TEXT = '© OpenMapTiles © OpenStreetMap contributors';

// Expo inlines EXPO_PUBLIC_* only for literal `process.env.EXPO_PUBLIC_X` reads, so the
// default argument must reference the variable literally.
export function getMapStyleUrl(configured = process.env.EXPO_PUBLIC_MAP_STYLE_URL) {
  if (typeof configured !== 'string') return DEFAULT_MAP_STYLE_URL;
  const trimmed = configured.trim();
  return trimmed || DEFAULT_MAP_STYLE_URL;
}

// Creel, Chihuahua: fallback centre when device location is unavailable.
export const CREEL_CENTER = Object.freeze({ longitude: -107.6355, latitude: 27.7522 });
export const INITIAL_ZOOM = 13;
// Fixed Chihuahua viewport used by the web stub, which has no real map to measure.
export const WEB_STUB_BOUNDS = Object.freeze([-109.5, 26.5, -105.5, 29.0]);
