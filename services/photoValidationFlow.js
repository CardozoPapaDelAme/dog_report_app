/**
 * @module services/photoValidationFlow
 * Platform-independent orchestration of one on-device photo validation with timeout and fail-open
 * handling. Runtime dependencies are injected by `photoValidationRuntime.js`.
 */
import { withTimeout } from './withTimeout.js';

export const PHOTO_VALIDATION_TIMEOUT_MS = 8000;
// A slow device may need longer than the validation timeout to load the model;
// only a load pending longer than this is treated as hung and dropped.
export const MODEL_LOAD_HUNG_MS = 60000;

// Orchestrates one validation; never throws. Failures fail open as `model_error`.
/**
 * @typedef {object} SkippedPhotoValidation
 * @property {'skipped'} status
 * @property {string} reason - `web`, `expo_go`, `timeout` or `model_error`.
 */
/**
 * @param {object} options
 * @param {string} options.uri - Local photo URI.
 * @param {import('./photoValidationAvailability.js').PhotoValidationAvailability} options.availability
 * @param {(uri: string) => Promise<*>} options.getPixels - Decodes the photo into model pixels.
 * @param {() => *} options.loadModel - Returns the (possibly cached) model or a promise of it.
 * @param {(input: {model: *, pixels: *}) => *} options.classify - Produces the validation result.
 * @param {(error: unknown) => void} [options.onError] - Reports any failure.
 * @param {(error: unknown) => void} [options.onModelFailure] - Called when the model load failed or is hung.
 * @param {() => number | null} [options.loadPendingMs] - Age of the pending model load.
 * @param {number} [options.hungMs=60000]
 * @param {number} [options.timeoutMs=8000]
 * @returns {Promise<*>} The `classify` result, or a {@link SkippedPhotoValidation}. Never rejects.
 */
export async function runPhotoValidationFlow({
  uri,
  availability,
  getPixels,
  loadModel,
  classify,
  onError = () => {},
  // Called when the model load failed, or has been pending longer than
  // `hungMs`, so the caller can drop the cached load and retry on the next photo.
  onModelFailure = () => {},
  // Milliseconds the current load has been pending (null when unknown/idle).
  loadPendingMs = () => null,
  hungMs = MODEL_LOAD_HUNG_MS,
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
    // A merely slow load is kept so a later photo can reuse it once it resolves.
    if (loadState === 'failed' || (loadState === 'pending' && error?.code === 'timeout' && loadIsHung(loadPendingMs, hungMs))) {
      try { onModelFailure(error); } catch { /* reset must never break the flow */ }
    }
    // A slow or hung model must never trap the user on the validating screen.
    return { status: 'skipped', reason: error?.code === 'timeout' ? 'timeout' : 'model_error' };
  }
}

function loadIsHung(loadPendingMs, hungMs) {
  try {
    const pending = loadPendingMs();
    return Number.isFinite(pending) && pending > hungMs;
  } catch {
    return false;
  }
}
