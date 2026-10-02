import { createLazyModelLoader } from './lazyModelLoader.js';
import { runPhotoValidationFlow } from './photoValidationFlow.js';

function assert(value, message = 'Assertion failed') {
  if (!value) throw new Error(message);
}

const availability = { available: true };

function run(loader, extra = {}) {
  return runPhotoValidationFlow({
    uri: 'file:///p.jpg',
    availability,
    getPixels: async () => ({}),
    loadModel: loader.load,
    onModelFailure: loader.reset,
    classify: ({ model }) => ({ status: 'accepted', model }),
    timeoutMs: 10,
    ...extra,
  });
}

Deno.test('model load hung -> timeout -> next photo starts a new load', async () => {
  let loads = 0;
  const loader = createLazyModelLoader(() => {
    loads += 1;
    return loads === 1 ? new Promise(() => {}) : Promise.resolve('model');
  });
  const first = await run(loader);
  assert(first.status === 'skipped' && first.reason === 'timeout', 'first must time out');
  assert(loads === 1);
  const second = await run(loader);
  assert(loads === 2, 'a fresh load must be created');
  assert(second.status === 'accepted' && second.model === 'model');
});

Deno.test('a successful load stays cached', async () => {
  let loads = 0;
  const loader = createLazyModelLoader(async () => { loads += 1; return 'model'; });
  await run(loader);
  await run(loader);
  assert(loads === 1);
});

Deno.test('a rejected load is retried on the next call', async () => {
  let loads = 0;
  const loader = createLazyModelLoader(async () => {
    loads += 1;
    if (loads === 1) throw new Error('boom');
    return 'model';
  });
  const first = await run(loader);
  assert(first.reason === 'model_error');
  assert((await run(loader)).status === 'accepted' && loads === 2);
});

Deno.test('a pixel failure with the model already loaded does not reset the cache', async () => {
  let loads = 0;
  const loader = createLazyModelLoader(async () => { loads += 1; return 'model'; });
  const failed = await run(loader, {
    getPixels: async () => { await new Promise((r) => setTimeout(r, 5)); throw new Error('pixels'); },
  });
  assert(failed.reason === 'model_error');
  await run(loader);
  assert(loads === 1, 'loaded model must stay cached');
});

Deno.test('onModelFailure throwing never breaks the flow', async () => {
  const result = await run({ load: () => new Promise(() => {}) }, {
    onModelFailure: () => { throw new Error('x'); },
  });
  assert(result.reason === 'timeout');
});

Deno.test('a pixel failure while the load is still pending does not reset the cache', async () => {
  let resets = 0;
  const result = await run({ load: () => new Promise(() => {}) }, {
    getPixels: async () => { throw new Error('pixels'); },
    onModelFailure: () => { resets += 1; },
    timeoutMs: 1000,
  });
  assert(result.reason === 'model_error');
  assert(resets === 0, 'a healthy pending load must be kept');
});

Deno.test('a load that fails resets even if pixels failed first', async () => {
  let resets = 0;
  let rejectLoad;
  const result = await run({ load: () => new Promise((_, rej) => { rejectLoad = rej; }) }, {
    getPixels: async () => { throw new Error('pixels'); },
    onModelFailure: () => { resets += 1; },
    timeoutMs: 1000,
  });
  assert(result.reason === 'model_error' && resets === 0);
  const result2 = await run({ load: async () => { throw new Error('boom'); } }, {
    onModelFailure: () => { resets += 1; },
  });
  assert(result2.reason === 'model_error' && resets === 1);
  void rejectLoad;
});
