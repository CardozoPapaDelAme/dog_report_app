/**
 * @module services/photoColorFlow
 * Attaches the automatically detected dog colour to an accepted photo, failing open.
 */
import { isDogColor } from '../models/dogColor.js';
import { withTimeout } from './withTimeout.js';

export const DOG_COLOR_TIMEOUT_MS = 3000;

// Adds the automatic colour detection to an accepted photo. Never throws and never
// blocks the report: any failure leaves the photo untouched (colour stays manual).
/**
 * @param {object} photo - Captured photo state with `photoUri` and optional `validation`.
 * @param {(uri: string) => Promise<import('../models/dogColor.js').DogColorResult | null>} detectColor
 * @param {number} [timeoutMs=3000]
 * @returns {Promise<object>} A copy with `validation.dog_color = {color, confidence}`, or `photo` unchanged
 *   on any failure or when no supported colour is detected. Never rejects.
 */
export async function attachDetectedColor(photo, detectColor, timeoutMs = DOG_COLOR_TIMEOUT_MS) {
  if (!photo?.photoUri || typeof detectColor !== 'function') return photo;
  try {
    const detected = await withTimeout(Promise.resolve().then(() => detectColor(photo.photoUri)), timeoutMs);
    if (!detected || !isDogColor(detected.color)) return photo;
    return {
      ...photo,
      validation: {
        ...(photo.validation ?? {}),
        dog_color: { color: detected.color, confidence: detected.confidence ?? null },
      },
    };
  } catch {
    return photo;
  }
}
