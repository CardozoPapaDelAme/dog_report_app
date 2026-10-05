// RNF06: Spanish is the default; English is used when the device language is English.
export const SUPPORTED_LANGUAGES = ['es', 'en'];
export const DEFAULT_LANGUAGE = 'es';

export function pickLanguage(candidates) {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const base = candidate.trim().toLowerCase().split(/[-_.@]/)[0];
    if (SUPPORTED_LANGUAGES.includes(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

// Hermes, JSC and browsers expose the device/browser locale through Intl and navigator.
export function detectDeviceLanguage(env = globalThis) {
  const candidates = [];
  try { candidates.push(...(env.navigator?.languages ?? [])); } catch { /* ignore */ }
  try { candidates.push(env.navigator?.language); } catch { /* ignore */ }
  try { candidates.push(env.Intl?.DateTimeFormat?.().resolvedOptions?.().locale); } catch { /* ignore */ }
  return pickLanguage(candidates);
}
