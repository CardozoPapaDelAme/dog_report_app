/**
 * @module models/photoThresholds
 * Client-side model for the administrator-managed AI dog-detection threshold served by
 * `GET /public/photo-validation`. Only `dogProbability` is configurable; `blurVariance` always keeps
 * the built-in default.
 */
import { DEFAULT_PHOTO_VALIDATION_THRESHOLDS } from './photoValidation.js';

/**
 * Validates the endpoint `data` payload.
 * @param {unknown} data - `{version, photo_dog_probability_min}`.
 * @returns {{version: number, dogProbability: number} | null} `null` when malformed or out of range.
 */
export function readPhotoThresholds(data) {
  if (!data || typeof data !== 'object') return null;
  const { version, photo_dog_probability_min: dogProbability } = data;
  if (!Number.isInteger(version) || version < 1) return null;
  if (typeof dogProbability !== 'number' || !Number.isFinite(dogProbability)
    || dogProbability < 0 || dogProbability > 1) return null;
  return { version, dogProbability };
}

/**
 * Builds the thresholds passed to the classifier: the dog probability from the first valid source
 * (last fetched, then cached) over the built-in defaults.
 * @param {...({dogProbability: number} | null | undefined)} sources - In priority order.
 * @returns {{dogProbability: number, blurVariance: number}}
 */
export function resolvePhotoThresholds(...sources) {
  const source = sources.find((candidate) => readPhotoThresholds({ version: 1, photo_dog_probability_min: candidate?.dogProbability }));
  return {
    ...DEFAULT_PHOTO_VALIDATION_THRESHOLDS,
    ...(source ? { dogProbability: source.dogProbability } : {}),
  };
}
