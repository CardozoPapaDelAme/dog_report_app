/**
 * @module services/dogColorRuntime
 * Runtime wiring for automatic dog colour detection from a captured photo.
 */
import { predominantDogColor } from '../models/dogColor.js';
import { readPhotoPixels } from './photoPixels.js';

// Pure JS (jpeg-js) so it also runs in Expo Go and web, where TFLite is skipped.
// Fails open: null when the pixels cannot be read.
/**
 * @param {string} uri - Local photo URI.
 * @returns {Promise<import('../models/dogColor.js').DogColorResult | null>}
 */
export async function detectDogColorFromPhoto(uri) {
  try {
    const pixels = await readPhotoPixels(uri, require('expo-image-manipulator'));
    return predominantDogColor(pixels);
  } catch {
    return null;
  }
}
