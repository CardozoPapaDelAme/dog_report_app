import { createPublicMapLoader } from './publicMapLoader.js';

function assert(value, message = 'Assertion failed') { if (!value) throw new Error(message); }
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const counts = { avistamiento_simple: 1, ataque_mascota: 0, ataque_ganado: 0, ataque_humano: 0, perro_lastimado: 0, otro: 0 };
const cluster = (id) => ({ cluster_id: id, report_count: 1, approximate_location: { longitude: -107.6, latitude: 27.75 },
  highest_severity: 'avistamiento_simple', type_counts: counts });
const pin = (id, longitude = -107.6) => ({ report_id: id, approximate_location: { longitude, latitude: 27.75 }, incident_type: 'otro',
  sighting_type: 'solitario', details: {}, dog: { predominant_color: null, size: null, has_collar: null },
  has_sanitized_photo: false, occurred_at: '2026-09-01T08:00:00Z', has_flags: false });
const bounds = [-107.7, 27.7, -107.5, 27.8];

function harness(overrides = {}) {
  const timers = [];
  const calls = { clusters: [], reports: [] };
  const fake = {
    schedule: (fn) => { const t = { fn, cancelled: false }; timers.push(t); return t; },
    cancel: (t) => { t.cancelled = true; },
  };
  const loader = createPublicMapLoader({
    ...fake,
    getClusters: (args) => { calls.clusters.push(args); return Promise.resolve([cluster('c1')]); },
    getReports: (args) => { calls.reports.push(args); return Promise.resolve([pin('r1'), pin('far', 10)]); },
    ...overrides,
  });
  const fire = async () => { const t = timers.filter((x) => !x.cancelled).pop(); t.cancelled = true; t.fn(); await tick(); };
  return { loader, timers, calls, fire };
}

Deno.test('ERI9 loader: debounces region changes into a single clusters load', async () => {
  const { loader, timers, calls, fire } = harness();
  loader.setRegion({ zoom: 10, bounds });
  loader.setRegion({ zoom: 11.7, bounds });
  assert(loader.getState().phase === 'loading' && calls.clusters.length === 0);
  assert(timers.length === 2 && timers[0].cancelled);
  await fire();
  assert(calls.clusters.length === 1 && calls.clusters[0].zoom === 11 && calls.clusters[0].viewport.minLongitude === -107.7);
  const state = loader.getState();
  assert(state.phase === 'ready' && state.mode === 'clusters' && state.clusters.length === 1);
});

Deno.test('ERI9 loader: ignores invalid regions and reports empty results', async () => {
  const { loader, timers, fire } = harness({ getClusters: () => Promise.resolve([]) });
  assert(loader.setRegion({ zoom: NaN, bounds }) === false && loader.setRegion({ zoom: 5, bounds: [1, 1, 0, 0] }) === false);
  assert(timers.length === 0 && loader.getState().phase === 'idle' && loader.retry() === false);
  loader.setRegion({ zoom: 5, bounds });
  await fire();
  assert(loader.getState().phase === 'empty');
});

Deno.test('ERI9 loader: late responses from an older region are ignored', async () => {
  const pending = [];
  const { loader, fire } = harness({ getClusters: () => new Promise((resolve) => pending.push(resolve)) });
  loader.setRegion({ zoom: 8, bounds });
  await fire();
  loader.setRegion({ zoom: 9, bounds });
  await fire();
  pending[1]([cluster('new')]);
  await tick();
  pending[0]([cluster('old')]);
  await tick();
  const state = loader.getState();
  assert(state.phase === 'ready' && state.clusters[0].cluster_id === 'new');
});

Deno.test('ERI9 loader: a response arriving during the debounce window is discarded', async () => {
  const pending = [];
  const { loader, fire } = harness({ getClusters: () => new Promise((resolve) => pending.push(resolve)) });
  loader.setRegion({ zoom: 8, bounds });
  await fire();
  loader.setRegion({ zoom: 9, bounds });
  pending[0]([cluster('stale')]);
  await tick();
  assert(loader.getState().phase === 'loading' && loader.getState().clusters.length === 0);
});

Deno.test('ERI9 loader: switches to pins at zoom 17, loads once and filters by viewport', async () => {
  const { loader, calls, fire } = harness();
  loader.setRegion({ zoom: 16, bounds });
  await fire();
  loader.setRegion({ zoom: 17, bounds });
  assert(loader.getState().mode === 'pins' && loader.getState().clusters.length === 0);
  await fire();
  assert(calls.reports.length === 1 && calls.clusters.length === 1);
  assert(loader.getState().phase === 'ready' && loader.getState().reports.length === 2);
  loader.setRegion({ zoom: 18, bounds: [9, 27.7, 11, 27.8] });
  assert(calls.reports.length === 1 && loader.getState().phase === 'ready');
  loader.setRegion({ zoom: 18, bounds: [50, 27.7, 51, 27.8] });
  assert(loader.getState().phase === 'empty');
  loader.setRegion({ zoom: 10, bounds });
  assert(loader.getState().mode === 'clusters' && loader.getState().reports.length === 0);
  await fire();
  assert(calls.clusters.length === 2 && loader.getState().phase === 'ready');
});

Deno.test('ERI9 loader: network_unavailable becomes offline, other errors become error, retry recovers', async () => {
  let failure = Object.assign(new Error('offline'), { code: 'network_unavailable', status: null });
  const { loader, calls, fire } = harness({
    getClusters: () => failure ? Promise.reject(failure) : Promise.resolve([cluster('c1')]),
  });
  loader.setRegion({ zoom: 6, bounds });
  await fire();
  assert(loader.getState().phase === 'offline' && loader.getState().error.code === 'network_unavailable');
  failure = Object.assign(new Error('boom'), { code: 'database_unavailable', status: 503 });
  loader.retry();
  await tick();
  assert(loader.getState().phase === 'error' && loader.getState().error.status === 503);
  failure = null;
  assert(loader.retry() === true && loader.getState().phase === 'loading');
  await tick();
  assert(loader.getState().phase === 'ready' && loader.getState().error === null);
});

Deno.test('ERI9 loader: pins errors retry the reports request; dispose stops everything', async () => {
  let fail = true;
  const changes = [];
  const { loader, calls, fire, timers } = harness({
    getReports: () => fail ? Promise.reject(Object.assign(new Error('x'), { code: 'request_timeout' })) : Promise.resolve([pin('r1')]),
    onChange: (state) => changes.push(state.phase),
  });
  loader.setRegion({ zoom: 19, bounds });
  await fire();
  assert(loader.getState().phase === 'error');
  fail = false;
  loader.retry();
  await tick();
  assert(loader.getState().phase === 'ready');
  loader.setRegion({ zoom: 19, bounds });
  const count = changes.length;
  loader.dispose();
  assert(timers[timers.length - 1].cancelled);
  await tick();
  assert(changes.length === count && calls.clusters.length === 0);
});
