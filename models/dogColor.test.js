import {
  DOG_COLORS,
  detectedDogColorFromDraft,
  predominantDogColor,
} from './dogColor.js';

function assert(value, message = 'Assertion failed') {
  if (!value) throw new Error(message);
}

const SIZE = 48;
const GREEN = [60, 160, 70];

// Builds an image: `paint(x, y)` returns [r,g,b]; default background is grass green.
function image(paint) {
  const rgb = new Uint8Array(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      rgb.set(paint(x, y), (y * SIZE + x) * 3);
    }
  }
  return { width: SIZE, height: SIZE, rgb };
}

const uniform = (color) => image(() => color);
// Dog-coloured centre on a green background.
const centred = (color) => image((x, y) => {
  const inside = Math.abs(x - SIZE / 2) < SIZE * 0.3 && Math.abs(y - SIZE / 2) < SIZE * 0.3;
  return inside ? color : GREEN;
});

const SAMPLES = {
  negro: [20, 18, 16],
  blanco: [240, 238, 232],
  'café': [105, 66, 35],
  gris: [128, 128, 130],
  dorado: [212, 165, 85],
};

Deno.test('RF22 vocabulary is the fixed Spanish set used by fixtures and docs', () => {
  assert(JSON.stringify(DOG_COLORS) === JSON.stringify(['negro', 'blanco', 'café', 'gris', 'dorado', 'mixto']));
});

for (const [name, color] of Object.entries(SAMPLES)) {
  Deno.test(`RF22 ${name} dog is detected on uniform and on green-background images`, () => {
    for (const img of [uniform(color), centred(color)]) {
      const result = predominantDogColor(img);
      assert(result?.color === name, `expected ${name}, got ${JSON.stringify(result)}`);
      assert(result.confidence > 0.9);
    }
  });
}

Deno.test('RF22 centre weighting ignores a coloured border around the dog', () => {
  const img = image((x, y) => {
    const edge = x < 6 || y < 6 || x >= SIZE - 6 || y >= SIZE - 6;
    return edge ? SAMPLES.blanco : SAMPLES.negro;
  });
  assert(predominantDogColor(img)?.color === 'negro');
});

Deno.test('RF22 two strong colours give mixto', () => {
  const img = image((x) => (x < SIZE / 2 ? SAMPLES.negro : SAMPLES.blanco));
  const result = predominantDogColor(img);
  assert(result?.color === 'mixto', JSON.stringify(result));
});

Deno.test('RF22 background-only (grass) and unusable inputs return null', () => {
  assert(predominantDogColor(uniform(GREEN)) === null);
  assert(predominantDogColor(uniform([40, 90, 220])) === null);
  assert(predominantDogColor(null) === null);
  assert(predominantDogColor({ width: 4, height: 4, rgb: new Uint8Array(10) }) === null);
  assert(predominantDogColor({ width: 2, height: 2, rgb: new Uint8Array(12) }) === null);
});

Deno.test('RF22 diffuse many-colour noise is unclear (null), not a guess', () => {
  const palette = Object.values(SAMPLES);
  const img = image((x, y) => palette[(x * 7 + y * 13) % palette.length]);
  assert(predominantDogColor(img) === null);
});

Deno.test('RF22 detection is deterministic', () => {
  const img = centred(SAMPLES.dorado);
  assert(JSON.stringify(predominantDogColor(img)) === JSON.stringify(predominantDogColor(img)));
});

Deno.test('RF22 detectedDogColorFromDraft only returns vocabulary colours', () => {
  assert(detectedDogColorFromDraft({ photo_validation: { dog_color: { color: 'café' } } }) === 'café');
  assert(detectedDogColorFromDraft({ photo_validation: { dog_color: { color: 'verde' } } }) === '');
  assert(detectedDogColorFromDraft({ photo_validation: null }) === '');
  assert(detectedDogColorFromDraft(null) === '');
});
