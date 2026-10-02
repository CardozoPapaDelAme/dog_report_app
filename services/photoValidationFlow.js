import { withTimeout } from './withTimeout.js';

export const PHOTO_VALIDATION_TIMEOUT_MS = 8000;

// Orchestrates one validation; never throws. Failures fail open as `model_error`.
export async function runPhotoValidationFlow({
  uri,
  availability,
  getPixels,
  loadModel,
  classify,
  onError = () => {},
  timeoutMs = PHOTO_VALIDATION_TIMEOUT_MS,
}) {
  if (!availability.available) {
    return { status: 'skipped', reason: availability.skipped };
  }
  try {
    return await withTimeout((async () => {
      const [pixels, model] = await Promise.all([getPixels(uri), loadModel()]);
      return classify({ model, pixels });
    })(), timeoutMs);
  } catch (error) {
    onError(error);
    // A slow or hung model must never trap the user on the validating screen.
    return { status: 'skipped', reason: error?.code === 'timeout' ? 'timeout' : 'model_error' };
  }
}
