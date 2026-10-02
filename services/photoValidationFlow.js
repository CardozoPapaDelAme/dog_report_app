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
  // Track the load outcome separately from pixel decoding: only a failed or
  // still-pending load may drop the cached model.
  let loadState = 'pending';
  try {
    return await withTimeout((async () => {
      const modelPromise = Promise.resolve(loadModel()).then((loaded) => {
        loadState = 'loaded';
        return loaded;
      }, (loadError) => {
        loadState = 'failed';
        throw loadError;
      });
      modelPromise.catch(() => {});
      const [pixels, model] = await Promise.all([getPixels(uri), modelPromise]);
      return classify({ model, pixels });
    })(), timeoutMs);
  } catch (error) {
    onError(error);
    if (loadState === 'failed' || (loadState === 'pending' && error?.code === 'timeout')) {
      try { onModelFailure(error); } catch { /* reset must never break the flow */ }
    }
    // A slow or hung model must never trap the user on the validating screen.
    return { status: 'skipped', reason: error?.code === 'timeout' ? 'timeout' : 'model_error' };
  }
}
