/**
 * @module services/photoPixels
 * Pure-JS photo decoding for on-device validation and colour detection: base64 and JPEG decoding,
 * RGB to RGBA expansion, and resizing through `expo-image-manipulator`.
 */
import { decode } from 'jpeg-js';

import { IMAGE_SIZE } from '../models/photoValidation.js';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LOOKUP = new Int16Array(128).fill(-1);
for (let index = 0; index < BASE64_ALPHABET.length; index += 1) {
  BASE64_LOOKUP[BASE64_ALPHABET.charCodeAt(index)] = index;
}

// Pure base64 decoder so the pipeline never depends on atob/Buffer availability.
/**
 * @param {string} input - Base64 text, optionally a `data:` URL; whitespace and padding are ignored.
 * @returns {Uint8Array}
 * @throws {Error} `invalid_base64` for characters outside the base64 alphabet.
 */
export function base64ToBytes(input) {
  const clean = String(input ?? '')
    .replace(/^data:[^,]*,/, '')
    .replace(/[\s=]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let out = 0;
  for (let index = 0; index < clean.length; index += 1) {
    const code = clean.charCodeAt(index);
    const value = code < 128 ? BASE64_LOOKUP[code] : -1;
    if (value < 0) throw new Error('invalid_base64');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[out] = (buffer >> bits) & 0xff;
      out += 1;
      buffer &= (1 << bits) - 1;
    }
  }
  return bytes.subarray(0, out);
}

// Decodes a JPEG (base64 string or bytes) to tightly packed RGB without alpha.
/**
 * @typedef {object} RgbPixels
 * @property {number} width
 * @property {number} height
 * @property {Uint8Array} rgb - Packed RGB bytes, row-major.
 */
/**
 * @param {string | Uint8Array} jpeg - Base64 text or raw JPEG bytes.
 * @returns {RgbPixels}
 * @throws {Error} `invalid_base64` or a `jpeg-js` decoding error.
 */
export function decodeJpegToRgb(jpeg) {
  const bytes = typeof jpeg === 'string' ? base64ToBytes(jpeg) : jpeg;
  const image = decode(bytes, { useTArray: true, formatAsRGBA: false });
  return { width: image.width, height: image.height, rgb: image.data };
}

/**
 * @param {Uint8Array} rgb - Packed RGB bytes.
 * @returns {Uint8Array} Packed RGBA bytes with opaque alpha.
 */
export function rgbToRgba(rgb) {
  const pixels = rgb.length / 3;
  const rgba = new Uint8Array(pixels * 4);
  for (let index = 0; index < pixels; index += 1) {
    rgba[index * 4] = rgb[index * 3];
    rgba[(index * 4) + 1] = rgb[(index * 3) + 1];
    rgba[(index * 4) + 2] = rgb[(index * 3) + 2];
    rgba[(index * 4) + 3] = 255;
  }
  return rgba;
}

// Resizes the captured photo to 224x224 JPEG with expo-image-manipulator and decodes it.
// `imageManipulator` is the expo-image-manipulator module (injected for lazy loading).
/**
 * @param {string} uri - Local photo URI.
 * @param {object} imageManipulator - The `expo-image-manipulator` module.
 * @param {number} [size=224] - Square output size in pixels.
 * @returns {Promise<RgbPixels>}
 * @throws {Error} `photo_resize_failed` when no base64 is produced, or manipulation/decoding errors.
 */
export async function readPhotoPixels(uri, imageManipulator, size = IMAGE_SIZE) {
  const context = imageManipulator.ImageManipulator.manipulate(uri);
  let image = null;
  try {
    context.resize({ width: size, height: size });
    image = await context.renderAsync();
    const saved = await image.saveAsync({
      base64: true,
      compress: 1,
      format: imageManipulator.SaveFormat.JPEG,
    });
    if (!saved?.base64) throw new Error('photo_resize_failed');
    return decodeJpegToRgb(saved.base64);
  } finally {
    image?.release?.();
    context.release?.();
  }
}
