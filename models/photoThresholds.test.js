import { readPhotoThresholds, resolvePhotoThresholds } from './photoThresholds.js';
import { DEFAULT_PHOTO_VALIDATION_THRESHOLDS } from './photoValidation.js';

function assert(value, message = 'Assertion failed') { if (!value) throw new Error(message); }

Deno.test('photo thresholds model accepts a valid payload and rejects malformed ones', () => {
  const ok = readPhotoThresholds({ version: 3, photo_dog_probability_min: 0.35, change_note: 'ignored' });
  assert(JSON.stringify(ok) === JSON.stringify({ version: 3, dogProbability: 0.35 }));
  assert(readPhotoThresholds({ version: 1, photo_dog_probability_min: 0 }).dogProbability === 0);
  for (const bad of [null, 'x', {}, { version: 0, photo_dog_probability_min: 0.2 }, { version: 1.5, photo_dog_probability_min: 0.2 },
    { version: 1, photo_dog_probability_min: '0.2' }, { version: 1, photo_dog_probability_min: 1.1 },
    { version: 1, photo_dog_probability_min: -0.1 }, { version: 1, photo_dog_probability_min: NaN }]) {
    assert(readPhotoThresholds(bad) === null, JSON.stringify(bad));
  }
});

Deno.test('photo thresholds resolve fetched, then cached, then defaults and keep the built-in blur variance', () => {
  assert(resolvePhotoThresholds({ dogProbability: 0.5 }, { dogProbability: 0.3 }).dogProbability === 0.5);
  assert(resolvePhotoThresholds(null, { dogProbability: 0.3 }).dogProbability === 0.3);
  assert(resolvePhotoThresholds({ dogProbability: 9 }, { dogProbability: 0.3 }).dogProbability === 0.3, 'invalid source skipped');
  const defaults = resolvePhotoThresholds(null, undefined);
  assert(JSON.stringify(defaults) === JSON.stringify(DEFAULT_PHOTO_VALIDATION_THRESHOLDS));
  assert(resolvePhotoThresholds({ dogProbability: 0.5 }).blurVariance === DEFAULT_PHOTO_VALIDATION_THRESHOLDS.blurVariance);
});
