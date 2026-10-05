import { encode } from 'jpeg-js';

import { base64ToBytes, decodeJpegToRgb, rgbToRgba } from './photoPixels.js';

function assert(condition, message = 'Assertion failed') {
  if (!condition) throw new Error(message);
}

function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function solidJpeg(width, height, [r, g, b]) {
  const data = new Uint8Array(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data.set([r, g, b, 255], index * 4);
  }
  return encode({ data, width, height }, 100).data;
}

Deno.test('PV-1 base64ToBytes matches atob, tolerates data URI prefix and rejects garbage', () => {
  const source = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255, 7]);
  const encoded = toBase64(source);
  assert(base64ToBytes(encoded).join() === source.join());
  assert(base64ToBytes(`data:image/jpeg;base64,${encoded}`).join() === source.join());
  let threw = false;
  try { base64ToBytes('@@@'); } catch { threw = true; }
  assert(threw, 'invalid base64 should throw');
});

Deno.test('PV-1 decodeJpegToRgb returns tightly packed RGB without alpha from base64 and bytes', () => {
  const jpeg = solidJpeg(8, 8, [200, 40, 40]);
  for (const input of [jpeg, toBase64(jpeg)]) {
    const { width, height, rgb } = decodeJpegToRgb(input);
    assert(width === 8 && height === 8);
    assert(rgb.length === 8 * 8 * 3, `expected RGB length, got ${rgb.length}`);
    assert(Math.abs(rgb[0] - 200) < 8 && Math.abs(rgb[1] - 40) < 8 && Math.abs(rgb[2] - 40) < 8);
  }
});

Deno.test('PV-1 rgbToRgba adds an opaque alpha channel', () => {
  const rgba = rgbToRgba(new Uint8Array([1, 2, 3, 4, 5, 6]));
  assert(rgba.join() === '1,2,3,255,4,5,6,255');
});
