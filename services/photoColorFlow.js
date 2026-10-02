import { isDogColor } from '../models/dogColor.js';

// Adds the automatic colour detection to an accepted photo. Never throws and never
// blocks the report: any failure leaves the photo untouched (colour stays manual).
export async function attachDetectedColor(photo, detectColor) {
  if (!photo?.photoUri || typeof detectColor !== 'function') return photo;
  try {
    const detected = await detectColor(photo.photoUri);
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
