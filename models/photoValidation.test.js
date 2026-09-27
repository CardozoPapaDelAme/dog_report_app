import {
  DEFAULT_PHOTO_VALIDATION_THRESHOLDS,
  dogProbability,
  laplacianVariance,
  normalizeClassifierOutput,
  resolveDogClassIndices,
  rgbaToGrayscale,
  validatePhotoFrame,
} from './photoValidation.js';

function assert(condition, message = 'Assertion failed') {
  if (!condition) throw new Error(message);
}

Deno.test('L5 photo validation resolves dog labels from downloaded labels when present', () => {
  const labels = [
    'goldfish',
    'n02085620 Chihuahua',
    'n02085782 Japanese spaniel',
    'n02113978 Mexican hairless',
    'n02114367 timber wolf',
    'zebra',
  ];
  const indices = resolveDogClassIndices(labels);
  assert(JSON.stringify(indices) === JSON.stringify([1, 2, 3, 4]));
});

Deno.test('L5 photo validation falls back to the ImageNet dog range', () => {
  const indices = resolveDogClassIndices([]);
  assert(indices[0] === 151, 'fallback should start at Chihuahua zero-based index');
  assert(indices.at(-1) === 268, 'fallback should end at the documented provisional range');
  assert(indices.length === 118, 'fallback should include the full provisional range');
});

Deno.test('L5 photo validation normalizes classifier outputs and sums dog classes', () => {
  const probabilities = normalizeClassifierOutput(new Uint8Array([0, 128, 127]));
  assert(Math.abs(probabilities.reduce((sum, value) => sum + value, 0) - 1) < 0.0001);
  const dogScore = dogProbability([0.1, 0.2, 0.7], [1, 2]);
  assert(Math.abs(dogScore - 0.9) < 0.0001);
});

Deno.test('L5 photo validation computes higher Laplacian variance for sharp edges', () => {
  const flat = new Uint8Array(25).fill(50);
  const edge = new Uint8Array([
    0, 0, 0, 255, 255,
    0, 0, 0, 255, 255,
    0, 0, 0, 255, 255,
    0, 0, 0, 255, 255,
    0, 0, 0, 255, 255,
  ]);
  assert(laplacianVariance(edge, 5, 5) > laplacianVariance(flat, 5, 5));
});

Deno.test('L5 photo validation returns explicit retry reasons', () => {
  const rgba = new Uint8Array(224 * 224 * 4).fill(128);
  const result = validatePhotoFrame({
    classifierOutput: [0.99, 0.01],
    rgba,
    width: 224,
    height: 224,
    labels: ['cat', 'Chihuahua'],
    thresholds: { ...DEFAULT_PHOTO_VALIDATION_THRESHOLDS, dogProbability: 0.8 },
  });
  assert(!result.passed);
  assert(result.reasons.includes('no_dog'));
  assert(result.reasons.includes('blurry'));
});

Deno.test('L5 photo validation converts RGBA to grayscale', () => {
  const grayscale = rgbaToGrayscale(new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]), 2, 1);
  assert(grayscale[0] > 70 && grayscale[0] < 80);
  assert(grayscale[1] > 145 && grayscale[1] < 155);
});
