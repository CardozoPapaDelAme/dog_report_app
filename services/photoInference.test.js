import { classifyPhotoPixels } from './photoInference.js';
import { photoValidationAvailability } from './photoValidationAvailability.js';
import { runPhotoValidationFlow } from './photoValidationFlow.js';

function assert(condition, message = 'Assertion failed') {
  if (!condition) throw new Error(message);
}

const LABELS = ['background', ...Array.from({ length: 1000 }, (_, index) => `class ${index}`)];
LABELS[152] = 'Chihuahua';
LABELS[269] = 'Mexican hairless';

function sharpPixels() {
  const rgb = new Uint8Array(224 * 224 * 3);
  for (let y = 0; y < 224; y += 1) {
    for (let x = 0; x < 224; x += 1) rgb.fill(((x + y) % 2) * 255, ((y * 224) + x) * 3, ((y * 224) + x) * 3 + 3);
  }
  return { width: 224, height: 224, rgb };
}

function flatPixels() {
  return { width: 224, height: 224, rgb: new Uint8Array(224 * 224 * 3).fill(128) };
}

function fakeModel({ inputType = 'float32', outputType = 'float32', output, shape = [1, 224, 224, 3] }) {
  const calls = [];
  return {
    calls,
    inputs: [{ name: 'in', dataType: inputType, shape }],
    outputs: [{ name: 'out', dataType: outputType, shape: [1, 1001] }],
    run(buffers) {
      calls.push(buffers);
      return Promise.resolve([output.buffer]);
    },
  };
}

function logits(dogIndex) {
  const out = new Float32Array(1001).fill(-5);
  out[dogIndex] = 8;
  return out;
}

const base = { labels: LABELS, modelVersion: 'test-model' };

Deno.test('PV-1 dog + sharp photo is accepted (float32 logits, input scaled to 0..1)', async () => {
  const model = fakeModel({ output: logits(200) });
  const result = await classifyPhotoPixels({ ...base, model, pixels: sharpPixels() });
  assert(result.status === 'accepted' && result.reasons.length === 0, JSON.stringify(result));
  assert(result.dogProbability > 0.9 && result.blurScore > 120 && result.modelVersion === 'test-model');
  const input = new Float32Array(model.calls[0][0]);
  assert(input.length === 224 * 224 * 3 && input[0] <= 1 && Math.max(...input.slice(0, 30)) === 1);
});

Deno.test('PV-1 non-dog class sums below the threshold and is rejected as no_dog', async () => {
  const model = fakeModel({ output: logits(10) });
  const result = await classifyPhotoPixels({ ...base, model, pixels: sharpPixels() });
  assert(result.status === 'rejected' && result.reasons.join() === 'no_dog', JSON.stringify(result));
});

Deno.test('PV-1 flat (blurry) dog photo is rejected as blurry; both failures report both reasons', async () => {
  const dog = await classifyPhotoPixels({ ...base, model: fakeModel({ output: logits(160) }), pixels: flatPixels() });
  assert(dog.status === 'rejected' && dog.reasons.join() === 'blurry', JSON.stringify(dog));
  const both = await classifyPhotoPixels({ ...base, model: fakeModel({ output: logits(10) }), pixels: flatPixels() });
  assert(both.reasons.join() === 'no_dog,blurry');
});

Deno.test('PV-1 quantized uint8 model uses raw channels and normalized uint8 scores', async () => {
  const output = new Uint8Array(1001);
  output[152] = 200;
  output[5] = 20;
  const model = fakeModel({ inputType: 'uint8', outputType: 'uint8', output });
  const result = await classifyPhotoPixels({ ...base, model, pixels: sharpPixels() });
  const input = new Uint8Array(model.calls[0][0]);
  assert(input.length === 224 * 224 * 3 && Math.max(...input.slice(0, 30)) === 255);
  assert(result.status === 'accepted' && result.dogProbability > 0.8, JSON.stringify(result));
});

Deno.test('PV-1 int8 model input is shifted by -128', async () => {
  const output = new Int8Array(1001).fill(-128);
  output[152] = 127;
  const model = fakeModel({ inputType: 'int8', outputType: 'int8', output });
  await classifyPhotoPixels({ ...base, model, pixels: sharpPixels() });
  const input = new Int8Array(model.calls[0][0]);
  assert(Math.min(...input.slice(0, 30)) === -128 && Math.max(...input.slice(0, 30)) === 127);
});

Deno.test('PV-1 unexpected input shape, dtype or pixel size throws', async () => {
  for (const model of [
    fakeModel({ output: logits(1), shape: [1, 128, 128, 3] }),
    fakeModel({ output: logits(1), inputType: 'float64' }),
  ]) {
    let threw = false;
    try { await classifyPhotoPixels({ ...base, model, pixels: sharpPixels() }); } catch { threw = true; }
    assert(threw);
  }
  let threw = false;
  try {
    await classifyPhotoPixels({ ...base, model: fakeModel({ output: logits(1) }), pixels: { width: 8, height: 8, rgb: new Uint8Array(192) } });
  } catch { threw = true; }
  assert(threw);
});

Deno.test('PV-1 availability: web and Expo Go skip explicitly, dev builds validate', () => {
  assert(photoValidationAvailability({ platform: 'web' }).skipped === 'web');
  assert(photoValidationAvailability({ platform: 'android', executionEnvironment: 'storeClient' }).skipped === 'expo_go');
  const dev = photoValidationAvailability({ platform: 'android', executionEnvironment: 'bare' });
  assert(dev.available && dev.skipped === null);
});

Deno.test('PV-1 flow skips without touching the model when unavailable, and fails open on errors', async () => {
  let touched = false;
  const deps = {
    uri: 'file:///x.jpg',
    getPixels: () => { touched = true; return sharpPixels(); },
    loadModel: () => { touched = true; return {}; },
    classify: () => ({ status: 'accepted' }),
  };
  const skipped = await runPhotoValidationFlow({ ...deps, availability: { available: false, skipped: 'expo_go' } });
  assert(skipped.status === 'skipped' && skipped.reason === 'expo_go' && !touched);

  const errors = [];
  const failed = await runPhotoValidationFlow({
    ...deps,
    availability: { available: true, skipped: null },
    classify: () => { throw new Error('boom'); },
    onError: (error) => errors.push(error.message),
  });
  assert(failed.status === 'skipped' && failed.reason === 'model_error' && errors.join() === 'boom');

  const ok = await runPhotoValidationFlow({ ...deps, availability: { available: true, skipped: null } });
  assert(ok.status === 'accepted');
});

Deno.test('runPhotoValidationFlow fails open with reason timeout when the model hangs', async () => {
  const result = await runPhotoValidationFlow({
    uri: 'file:///photo.jpg',
    availability: { available: true },
    getPixels: async () => ({ width: 224, height: 224, rgb: new Uint8Array(224 * 224 * 3) }),
    loadModel: () => new Promise(() => {}),
    classify: async () => ({ status: 'accepted' }),
    timeoutMs: 20,
  });
  if (result.status !== 'skipped' || result.reason !== 'timeout') throw new Error(JSON.stringify(result));
});
