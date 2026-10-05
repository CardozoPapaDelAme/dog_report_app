import { predominantDogColor } from '../models/dogColor.js';
import { readPhotoPixels } from './photoPixels.js';

// Pure JS (jpeg-js) so it also runs in Expo Go and web, where TFLite is skipped.
// Fails open: null when the pixels cannot be read.
export async function detectDogColorFromPhoto(uri) {
  try {
    const pixels = await readPhotoPixels(uri, require('expo-image-manipulator'));
    return predominantDogColor(pixels);
  } catch {
    return null;
  }
}
