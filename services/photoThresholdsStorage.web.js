/**
 * @module services/photoThresholdsStorage.web
 * Web variant of the cached photo thresholds storage, over `localStorage` (same export as the native one).
 */
/** @type {{getItem: (key: string) => Promise<string | null>, setItem: (key: string, value: string) => Promise<void>}} */
export const photoThresholdsStorage = Object.freeze({
  async getItem(key) { return globalThis.localStorage?.getItem(key) ?? null; },
  async setItem(key, value) { globalThis.localStorage?.setItem(key, value); },
});
