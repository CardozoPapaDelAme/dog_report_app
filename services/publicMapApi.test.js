import { getPublicClusters, getPublicReports } from './publicMapApi.js';

function assert(value, message = 'Assertion failed') { if (!value) throw new Error(message); }
async function rejects(promise, check) {
  try { await promise; } catch (error) { assert(check(error), `unexpected error ${error.code}`); return; }
  throw new Error('Expected rejection');
}
const counts = { avistamiento_simple: 1, ataque_mascota: 0, ataque_ganado: 0, ataque_humano: 0, perro_lastimado: 0, otro: 0 };
const clusterWire = { cluster_id: 'c1', report_count: 1, approximate_location: { longitude: -107.6, latitude: 27.75 },
  highest_severity: 'avistamiento_simple', type_counts: counts };
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const viewport = { minLongitude: -107.7, minLatitude: 27.7, maxLongitude: -107.5, maxLatitude: 27.8 };

Deno.test('ERI9 API: clusters request is anonymous, builds the query and normalizes the response', async () => {
  const calls = [];
  const request = (path, options) => { calls.push({ path, options }); return json({ data: [clusterWire, { bad: true }] }); };
  const result = await getPublicClusters({ zoom: 12, viewport, limit: 50 }, request);
  const url = new URL(calls[0].path, 'https://x.test');
  assert(url.pathname === '/public/clusters' && url.searchParams.get('zoom') === '12' && url.searchParams.get('limit') === '50');
  assert(url.searchParams.get('min_longitude') === '-107.7' && url.searchParams.get('max_latitude') === '27.8');
  assert(!calls[0].options.headers?.Authorization);
  assert(result.length === 1 && result[0].cluster_id === 'c1');
  await getPublicClusters({ zoom: 0 }, (path) => { assert(path === '/public/clusters?zoom=0'); return json({ data: [] }); });
});

Deno.test('ERI9 API: clusters validate inputs before any request', async () => {
  let count = 0;
  const request = () => { count++; return json({ data: [] }); };
  for (const input of [{}, { zoom: 1.5 }, { zoom: -1 }, { zoom: 23 }, { zoom: '3' }, { zoom: 3, limit: 0 }, { zoom: 3, limit: 5001 },
    { zoom: 3, viewport: { minLongitude: 5, minLatitude: 0, maxLongitude: 1, maxLatitude: 1 } }]) {
    await rejects(getPublicClusters(input, request), (e) => e instanceof RangeError);
  }
  assert(count === 0);
});

Deno.test('ERI9 API: reports request validates since/limit and normalizes the response', async () => {
  const wire = { report_id: 'r1', approximate_location: { longitude: -107.6, latitude: 27.75 }, incident_type: 'otro',
    sighting_type: 'solitario', details: {}, dog: { predominant_color: null, size: null, has_collar: null },
    has_sanitized_photo: false, occurred_at: '2026-09-01T08:00:00Z', has_flags: true };
  const paths = [];
  const request = (path) => { paths.push(path); return json({ data: [wire] }); };
  const result = await getPublicReports({ since: '2026-09-01T00:00:00-06:00', limit: 1000 }, request);
  const url = new URL(paths[0], 'https://x.test');
  assert(url.pathname === '/public/reports' && url.searchParams.get('since') === '2026-09-01T00:00:00-06:00');
  assert(result.length === 1 && result[0].has_flags === true);
  await getPublicReports({}, (path) => { assert(path === '/public/reports'); return json({ data: [] }); });
  for (const input of [{ since: '2026-09-01' }, { since: 5 }, { limit: 0 }, { limit: 1001 }, { limit: 1.5 }]) {
    await rejects(getPublicReports(input, request), (e) => e instanceof RangeError);
  }
  assert(paths.length === 1);
});

Deno.test('ERI9 API: maps server errors with code, status and request id', async () => {
  const request = () => json({ error: { code: 'database_unavailable', message: 'down', request_id: 'req-1' } }, 503);
  await rejects(getPublicClusters({ zoom: 3 }, request), (e) => e.code === 'database_unavailable' && e.status === 503 && e.requestId === 'req-1');
  const noBody = () => new Response('oops', { status: 500, headers: { 'X-Request-Id': 'hdr' } });
  await rejects(getPublicReports({}, noBody), (e) => e.code === 'request_failed' && e.status === 500 && e.requestId === 'hdr');
});

Deno.test('ERI9 API: transport errors pass through unchanged and bad payloads are invalid_response', async () => {
  const offline = Object.assign(new Error('offline'), { code: 'network_unavailable', status: null });
  await rejects(getPublicClusters({ zoom: 3 }, () => { throw offline; }), (e) => e === offline);
  const timeout = Object.assign(new Error('t'), { code: 'request_timeout', status: null });
  await rejects(getPublicReports({}, () => Promise.reject(timeout)), (e) => e === timeout);
  await rejects(getPublicClusters({ zoom: 3 }, () => json({ data: {} })), (e) => e.code === 'invalid_response');
  await rejects(getPublicReports({}, () => new Response('nope', { status: 200 })), (e) => e.code === 'invalid_response');
});
