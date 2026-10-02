// Orchestrates one validation; never throws. Failures fail open as `model_error`.
export async function runPhotoValidationFlow({
  uri,
  availability,
  getPixels,
  loadModel,
  classify,
  onError = () => {},
}) {
  if (!availability.available) {
    return { status: 'skipped', reason: availability.skipped };
  }
  try {
    const [pixels, model] = await Promise.all([getPixels(uri), loadModel()]);
    return await classify({ model, pixels });
  } catch (error) {
    onError(error);
    return { status: 'skipped', reason: 'model_error' };
  }
}
