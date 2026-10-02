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
  // Called when a failure happened while the model was not yet loaded, so the
  // caller can drop a cached (possibly hung) load and retry on the next photo.
  onModelFailure = () => {},
  timeoutMs = PHOTO_VALIDATION_TIMEOUT_MS,
}) {
  if (!availability.available) {
    return { status: 'skipped', reason: availability.skipped };
  }
  let modelLoaded = false;
  try {
    return await withTimeout((async () => {
      const modelPromise = Promise.resolve(loadModel()).then((loaded) => {
        modelLoaded = true;
        return loaded;
      });
      const [pixels, model] = await Promise.all([getPixels(uri), modelPromise]);
      return classify({ model, pixels });
    })(), timeoutMs);
  } catch (error) {
    onError(error);
    if (!modelLoaded) {
      try { onModelFailure(error); } catch { /* reset must never break the flow */ }
    }
    // A slow or hung model must never trap the user on the validating screen.
    return { status: 'skipped', reason: error?.code === 'timeout' ? 'timeout' : 'model_error' };
  }
}
