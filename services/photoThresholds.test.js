import { createPhotoThresholds, PHOTO_THRESHOLDS_CACHE_KEY } from './photoThresholds.js';

function assert(value, message = 'Assertion failed') { if (!value) throw new Error(message); }
function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { data, getItem: async (key) => data[key] ?? null, setItem: async (key, value) => { data[key] = value; } };
}
const cached = (dogProbability) => JSON.stringify({ version: 1, dogProbability });

Deno.test('photo thresholds: defaults when nothing is fetched or cached, and offline never rejects', async () => {
  const thresholds = createPhotoThresholds({ storage: memoryStorage(), fetchThresholds: async () => { throw new Error('offline'); } });
  const value = await thresholds.get();
  assert(value.dogProbability === 0.2 && value.blurVariance === 80);
});

Deno.test('photo thresholds: cached values are used offline', async () => {
  const thresholds = createPhotoThresholds({
    storage: memoryStorage({ [PHOTO_THRESHOLDS_CACHE_KEY]: cached(0.4) }),
    fetchThresholds: async () => { throw new Error('offline'); },
  });
  const value = await thresholds.get();
  assert(value.dogProbability === 0.4 && value.blurVariance === 80);
});

Deno.test('photo thresholds: a successful refresh updates memory and the cache and wins over the cached value', async () => {
  const storage = memoryStorage({ [PHOTO_THRESHOLDS_CACHE_KEY]: cached(0.4) });
  const thresholds = createPhotoThresholds({ storage, fetchThresholds: async () => ({ version: 2, dogProbability: 0.6 }) });
  assert(await thresholds.refresh() === true);
  assert((await thresholds.get()).dogProbability === 0.6);
  assert(JSON.parse(storage.data[PHOTO_THRESHOLDS_CACHE_KEY]).dogProbability === 0.6);
});

Deno.test('photo thresholds: get never waits for a hanging network and corrupt cache falls back to defaults', async () => {
  const thresholds = createPhotoThresholds({
    storage: memoryStorage({ [PHOTO_THRESHOLDS_CACHE_KEY]: '{not json' }),
    fetchThresholds: () => new Promise(() => {}),
  });
  assert((await thresholds.get()).dogProbability === 0.2);
});

Deno.test('photo thresholds: refresh is throttled, ignores invalid payloads and survives storage write errors', async () => {
  let calls = 0;
  let time = 0;
  const storage = { getItem: async () => null, setItem: async () => { throw new Error('full'); } };
  const thresholds = createPhotoThresholds({
    storage, now: () => time, refreshMs: 1000,
    fetchThresholds: async () => { calls++; return calls === 1 ? { version: 1, dogProbability: 9 } : { version: 2, dogProbability: 0.3 }; },
  });
  assert(await thresholds.refresh() === false, 'invalid payload');
  assert(await thresholds.refresh() === false && calls === 1, 'throttled');
  time = 2000;
  assert(await thresholds.refresh() === true && calls === 2);
  assert((await thresholds.get()).dogProbability === 0.3, 'kept despite write failure');
});
