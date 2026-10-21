import { getPhotoThresholds } from './photoThresholdsApi.js';

function assert(value, message = 'Assertion failed') { if (!value) throw new Error(message); }
async function rejects(promise, code) {
  try { await promise; } catch (error) { assert(error.code === code, `unexpected ${error.code}`); return; }
  throw new Error('Expected rejection');
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

Deno.test('photo thresholds API: anonymous GET returns the parsed thresholds', async () => {
  const calls = [];
  const result = await getPhotoThresholds((path, options) => {
    calls.push({ path, options });
    return json({ data: { version: 2, photo_dog_probability_min: 0.25 } });
  });
  assert(calls[0].path === '/public/photo-validation' && calls[0].options.method === 'GET');
  assert(!calls[0].options.headers?.Authorization);
  assert(result.version === 2 && result.dogProbability === 0.25);
});

Deno.test('photo thresholds API: failures surface a code and never return partial data', async () => {
  await rejects(getPhotoThresholds(() => json({ error: { code: 'configuration_unavailable', message: 'x' } }, 503)), 'configuration_unavailable');
  await rejects(getPhotoThresholds(() => json({}, 500)), 'request_failed');
  await rejects(getPhotoThresholds(() => json({ data: { version: 1, photo_dog_probability_min: 7 } })), 'invalid_response');
  await rejects(getPhotoThresholds(() => new Response('not json')), 'invalid_response');
  await rejects(getPhotoThresholds(() => { throw Object.assign(new Error('offline'), { code: 'network_unavailable' }); }), 'network_unavailable');
});
