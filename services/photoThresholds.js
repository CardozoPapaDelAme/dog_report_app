/**
 * @module services/photoThresholds
 * Resolves the thresholds used by on-device photo validation. Order: last fetched value in memory, then
 * the cached value, then the built-in defaults. The network refresh runs in the background and never
 * blocks or fails a capture.
 */
import { readPhotoThresholds, resolvePhotoThresholds } from '../models/photoThresholds.js';
import { getPhotoThresholds } from './photoThresholdsApi.js';

export const PHOTO_THRESHOLDS_CACHE_KEY = 'photo_validation_thresholds';
/** Minimum time between background refresh attempts. */
export const PHOTO_THRESHOLDS_REFRESH_MS = 60_000;

/**
 * @param {object} options
 * @param {{getItem: Function, setItem: Function}} options.storage - Async key/value storage.
 * @param {() => Promise<{version: number, dogProbability: number}>} [options.fetchThresholds]
 * @param {() => number} [options.now]
 * @param {number} [options.refreshMs]
 * @returns {{get: () => Promise<{dogProbability: number, blurVariance: number}>, refresh: () => Promise<boolean>}}
 *   `get` never rejects and never waits for the network; `refresh` resolves `true` when new values were stored.
 */
export function createPhotoThresholds({
  storage,
  fetchThresholds = getPhotoThresholds,
  now = Date.now,
  refreshMs = PHOTO_THRESHOLDS_REFRESH_MS,
}) {
  let current = null;
  let cacheLoaded = false;
  let lastAttempt = -Infinity;
  let inFlight = null;

  /** Validates a `{version, dogProbability}` value from the cache or the API client. */
  const valid = (value) => readPhotoThresholds({
    version: value?.version, photo_dog_probability_min: value?.dogProbability,
  });

  async function loadCache() {
    if (cacheLoaded) return;
    cacheLoaded = true;
    try {
      const cached = valid(JSON.parse(await storage.getItem(PHOTO_THRESHOLDS_CACHE_KEY)));
      // A fetch that finished first is newer than the cache.
      if (cached && !current) current = cached;
    } catch {
      cacheLoaded = false; // Retry a failed or damaged read on the next call.
    }
  }

  function refresh() {
    if (inFlight) return inFlight;
    if (now() - lastAttempt < refreshMs) return Promise.resolve(false);
    lastAttempt = now();
    inFlight = (async () => {
      try {
        const fetched = valid(await fetchThresholds());
        if (!fetched) return false;
        current = fetched;
        try {
          await storage.setItem(PHOTO_THRESHOLDS_CACHE_KEY, JSON.stringify(fetched));
        } catch { /* The in-memory value still applies; the cache is best effort. */ }
        return true;
      } catch {
        return false; // Offline or API failure: keep the cached or default values.
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  return {
    async get() {
      refresh();
      await loadCache();
      return resolvePhotoThresholds(current);
    },
    refresh,
  };
}
