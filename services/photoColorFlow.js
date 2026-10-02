import { isDogColor } from '../models/dogColor.js';
import { withTimeout } from './withTimeout.js';

export const DOG_COLOR_TIMEOUT_MS = 3000;

// Adds the automatic colour detection to an accepted photo. Never throws and never
// blocks the report: any failure leaves the photo untouched (colour stays manual).
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
