// Predominant dog colour from decoded RGB pixels (RF22, HU-22, RNF11).
//
// Pure and deterministic: no network, no randomness. The result is a *signal* for
// the report and the duplicate heuristic (server compares `lower(color)` for
// equality), never an identification, so the vocabulary is small and fixed.

// Stored values are canonical lowercase Spanish (docs/API.md uses "café";
// fixtures use negro/blanco/café). They are sent verbatim as `predominant_color`.
export const DOG_COLORS = Object.freeze([
  'negro',
  'blanco',
  'café',
  'gris',
  'dorado',
  'mixto',
]);

// Tunables. Provisional: validated on synthetic images only, not on real photos.
export const DOG_COLOR_THRESHOLDS = Object.freeze({
  minPixels: 16,
  // Share of the weighted sample that must fall in a vocabulary colour; the rest
  // is treated as background (green grass, blue sky, ...) and ignored.
  minClassifiedShare: 0.2,
  // A single colour needs this share of the classified pixels.
  singleShare: 0.55,
  // Two colours each above `mixedMinShare` and together above `mixedPairShare` => mixto.
  mixedMinShare: 0.25,
  mixedPairShare: 0.7,
});

export function isDogColor(value) {
  return DOG_COLORS.includes(value);
}

function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = ((b - r) / delta) + 2;
    else hue = ((r - g) / delta) + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { h: hue, s: max === 0 ? 0 : delta / max, v: max / 255 };
}

// Maps one pixel to a base colour or null (background / not a dog coat colour).
export function classifyPixel(r, g, b) {
  const { h, s, v } = rgbToHsv(r, g, b);
  if (v < 0.2) return 'negro';
  if (s < 0.15) return v > 0.8 ? 'blanco' : 'gris';
  const warm = h < 55 || h >= 345;
  if (!warm) {
    // Saturated cool hues (grass, sky, foliage) are background; faint ones read grey.
    return s < 0.25 ? 'gris' : null;
  }
  return v < 0.55 ? 'café' : 'dorado';
}

// Centre-weighted ellipse covering most of the frame; the dog is usually centred.
// Outside the ellipse weight is 0 so edges/background do not vote.
function centreWeight(x, y, width, height) {
  const dx = ((x + 0.5) / width - 0.5) / 0.4;
  const dy = ((y + 0.5) / height - 0.5) / 0.4;
  const r2 = (dx * dx) + (dy * dy);
  return r2 >= 1 ? 0 : 1 - (0.5 * r2);
}

// Returns { color, confidence } or null when the image is unusable or unclear.
export function predominantDogColor(image, thresholds = DOG_COLOR_THRESHOLDS) {
  const { width, height, rgb } = image ?? {};
  if (
    !Number.isInteger(width) || !Number.isInteger(height)
    || width <= 0 || height <= 0
    || !rgb || rgb.length !== width * height * 3
    || width * height < thresholds.minPixels
  ) {
    return null;
  }

  const votes = Object.fromEntries(DOG_COLORS.filter((c) => c !== 'mixto').map((c) => [c, 0]));
  let total = 0;
  let classified = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const weight = centreWeight(x, y, width, height);
      if (weight === 0) continue;
      total += weight;
      const offset = (y * width + x) * 3;
      const color = classifyPixel(rgb[offset], rgb[offset + 1], rgb[offset + 2]);
      if (color) {
        votes[color] += weight;
        classified += weight;
      }
    }
  }

  if (total === 0 || classified / total < thresholds.minClassifiedShare) return null;

  const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const topShare = ranked[0][1] / classified;
  const secondShare = ranked[1][1] / classified;

  if (topShare >= thresholds.singleShare) {
    return { color: ranked[0][0], confidence: topShare };
  }
  if (
    topShare >= thresholds.mixedMinShare
    && secondShare >= thresholds.mixedMinShare
    && topShare + secondShare >= thresholds.mixedPairShare
  ) {
    return { color: 'mixto', confidence: topShare + secondShare };
  }
  return null;
}

// Draft integration: the detection lives inside `photo_validation.dog_color`
// (JSON column already persisted by the draft DAO; no schema change).
export function detectedDogColorFromDraft(draft) {
  const color = draft?.photo_validation?.dog_color?.color;
  return isDogColor(color) ? color : '';
}
