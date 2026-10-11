/**
 * @module i18n/deviceLanguage
 * Resolves the UI language from the device or browser locale.
 */
// RNF06: Spanish is the default; English is used when the device language is English.
/** @type {string[]} */
export const SUPPORTED_LANGUAGES = ['es', 'en'];
/** @type {string} */
export const DEFAULT_LANGUAGE = 'es';

/**
 * Returns the first supported base language among the candidates.
 * @param {Iterable<unknown>} candidates - Locale tags such as `en-US`; non-strings are skipped.
 * @returns {string} A `SUPPORTED_LANGUAGES` entry, or `DEFAULT_LANGUAGE`.
 */
export function pickLanguage(candidates) {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const base = candidate.trim().toLowerCase().split(/[-_.@]/)[0];
    if (SUPPORTED_LANGUAGES.includes(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

// Hermes, JSC and browsers expose the device/browser locale through Intl and navigator.
/**
 * @param {object} [env=globalThis] - Environment exposing `navigator` and `Intl`.
 * @returns {string} The detected supported language, or `DEFAULT_LANGUAGE`. Never throws.
 */
export function detectDeviceLanguage(env = globalThis) {
  const candidates = [];
  try { candidates.push(...(env.navigator?.languages ?? [])); } catch { /* ignore */ }
  try { candidates.push(env.navigator?.language); } catch { /* ignore */ }
  try { candidates.push(env.Intl?.DateTimeFormat?.().resolvedOptions?.().locale); } catch { /* ignore */ }
  return pickLanguage(candidates);
}
