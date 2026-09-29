export const IMAGE_SIZE = 224;

export const DEFAULT_DOG_CLASS_RANGE = Object.freeze({
  start: 151,
  end: 268,
  basis: 'ImageNet-1k zero-based fallback; verify against bundled labels before release',
});

export const DEFAULT_PHOTO_VALIDATION_THRESHOLDS = Object.freeze({
  dogProbability: 0.3,
  blurVariance: 120,
});

const DOG_START_MARKERS = ['chihuahua'];
const DOG_END_MARKERS = ['mexican hairless', 'mexican_hairless'];

function asArray(values) {
  if (!values) return [];
  if (Array.isArray(values)) return values;
  return Array.from(values);
}

function labelText(label) {
  return String(label ?? '').toLowerCase();
}

export function resolveDogClassIndices(labels, fallback = DEFAULT_DOG_CLASS_RANGE) {
  const normalized = asArray(labels).map(labelText);
  const start = normalized.findIndex((label) =>
    DOG_START_MARKERS.some((marker) => label.includes(marker)),
  );
  let end = -1;
  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    if (DOG_END_MARKERS.some((marker) => normalized[index].includes(marker))) {
      end = index;
      break;
    }
  }

  if (start >= 0 && end >= start && end - start < 150) {
    return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
  }

  return Array.from(
    { length: fallback.end - fallback.start + 1 },
    (_, offset) => fallback.start + offset,
  );
}

export function softmax(values) {
  const numbers = asArray(values).map(Number);
  if (!numbers.length) return [];
  const max = Math.max(...numbers);
  const exp = numbers.map((value) => Math.exp(value - max));
  const total = exp.reduce((sum, value) => sum + value, 0);
  return total > 0 ? exp.map((value) => value / total) : numbers.map(() => 0);
}

export function normalizeClassifierOutput(output) {
  const values = asArray(output).map(Number);
  if (!values.length) return [];

  const total = values.reduce((sum, value) => sum + value, 0);
  const allNonNegative = values.every((value) => value >= 0);
  if (allNonNegative && total > 0.98 && total < 1.02) {
    return values;
  }

  if (output instanceof Uint8Array) {
    const probabilities = values.map((value) => value / 255);
    const probabilityTotal = probabilities.reduce((sum, value) => sum + value, 0);
    return probabilityTotal > 0
      ? probabilities.map((value) => value / probabilityTotal)
      : probabilities;
  }

  if (output instanceof Int8Array) {
    const probabilities = values.map((value) => (value + 128) / 255);
    const probabilityTotal = probabilities.reduce((sum, value) => sum + value, 0);
    return probabilityTotal > 0
      ? probabilities.map((value) => value / probabilityTotal)
      : probabilities;
  }

  return softmax(values);
}

export function dogProbability(classifierOutput, dogClassIndices) {
  const probabilities = normalizeClassifierOutput(classifierOutput);
  return dogClassIndices.reduce((sum, index) => sum + (probabilities[index] ?? 0), 0);
}

export function rgbaToGrayscale(rgba, width, height) {
  const pixels = width * height;
  const grayscale = new Uint8Array(pixels);
  for (let index = 0; index < pixels; index += 1) {
    const source = index * 4;
    grayscale[index] = Math.round(
      (0.299 * rgba[source]) + (0.587 * rgba[source + 1]) + (0.114 * rgba[source + 2]),
    );
  }
  return grayscale;
}

export function laplacianVariance(grayscale, width, height) {
  if (width < 3 || height < 3) return 0;
  const values = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const center = grayscale[(y * width) + x] * 4;
      const laplacian = center
        - grayscale[((y - 1) * width) + x]
        - grayscale[((y + 1) * width) + x]
        - grayscale[(y * width) + x - 1]
        - grayscale[(y * width) + x + 1];
      values.push(laplacian);
    }
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
}

export function rgbaToModelInput(rgba, inputDataType = 'uint8') {
  const pixels = rgba.length / 4;
  if (inputDataType === 'float32') {
    const input = new Float32Array(pixels * 3);
    for (let index = 0; index < pixels; index += 1) {
      input[(index * 3)] = rgba[index * 4] / 255;
      input[(index * 3) + 1] = rgba[(index * 4) + 1] / 255;
      input[(index * 3) + 2] = rgba[(index * 4) + 2] / 255;
    }
    return input;
  }
  if (inputDataType === 'int8') {
    const input = new Int8Array(pixels * 3);
    for (let index = 0; index < pixels; index += 1) {
      input[(index * 3)] = rgba[index * 4] - 128;
      input[(index * 3) + 1] = rgba[(index * 4) + 1] - 128;
      input[(index * 3) + 2] = rgba[(index * 4) + 2] - 128;
    }
    return input;
  }

  const input = new Uint8Array(pixels * 3);
  for (let index = 0; index < pixels; index += 1) {
    input[(index * 3)] = rgba[index * 4];
    input[(index * 3) + 1] = rgba[(index * 4) + 1];
    input[(index * 3) + 2] = rgba[(index * 4) + 2];
  }
  return input;
}

export function validatePhotoFrame({
  classifierOutput,
  rgba,
  width,
  height,
  labels = [],
  thresholds = DEFAULT_PHOTO_VALIDATION_THRESHOLDS,
}) {
  const dogClassIndices = resolveDogClassIndices(labels);
  const detectedDogProbability = dogProbability(classifierOutput, dogClassIndices);
  const blurVariance = laplacianVariance(rgbaToGrayscale(rgba, width, height), width, height);
  const dogPassed = detectedDogProbability >= thresholds.dogProbability;
  const blurPassed = blurVariance >= thresholds.blurVariance;
  const reasons = [];
  if (!dogPassed) reasons.push('no_dog');
  if (!blurPassed) reasons.push('blurry');

  return {
    passed: dogPassed && blurPassed,
    reasons,
    dogProbability: Number(detectedDogProbability.toFixed(4)),
    blurVariance: Number(blurVariance.toFixed(2)),
    thresholds,
    dogClassRange: {
      first: dogClassIndices[0] ?? null,
      last: dogClassIndices[dogClassIndices.length - 1] ?? null,
      count: dogClassIndices.length,
    },
  };
}
