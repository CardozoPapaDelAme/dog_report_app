import test from 'node:test';
import { formatResults, resolveConfig, runSmoke } from './smoke.mjs';

function eq(actual, expected, message = '') {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message} expected ${b}, got ${a}`);
}

const API = 'https://ref.supabase.co/functions/v1/api';
const AUTH = 'https://ref.supabase.co';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Healthy staging: every route answers as documented in docs/API.md. */
function healthyRoutes(url, init = {}) {
  if (url === `${API}/health`) return jsonResponse(200, { data: { ok: true, database: 'up' } });
  if (url.startsWith(`${API}/public/clusters`)) return jsonResponse(200, { data: [] });
  if (url.startsWith(`${API}/public/reports`)) return jsonResponse(200, { data: [] });
  if (url === `${AUTH}/auth/v1/signup` && init.method === 'POST') {
    return jsonResponse(422, { code: 422, error_code: 'signup_disabled', msg: 'Signups not allowed for this instance' });
  }
  return jsonResponse(404, {});
}

function fakeFetch(routes, calls = []) {
  return async (url, init) => {
    calls.push({ url: String(url), init });
    return routes(String(url), init);
  };
}

/** Clock that advances 10 ms on every read, so each call measures 10 ms. */
function steppingClock() {
  let t = 0;
  return () => (t += 10);
}

const config = { apiBaseUrl: API, supabaseUrl: AUTH, publishableKey: 'sb_publishable_test' };

test('runSmoke passes when every check answers as documented', async () => {
  const report = await runSmoke({ ...config, fetch: fakeFetch(healthyRoutes), now: steppingClock() });
  eq(report.ok, true);
  eq(report.results.map((r) => [r.name, r.ok, r.status]), [
    ['GET /health', true, 200],
    ['GET /public/clusters', true, 200],
    ['GET /public/reports', true, 200],
    ['POST /auth/v1/signup', true, 422],
  ]);
  eq(report.results.every((r) => r.latency_ms === 10), true, 'latency in ms');
});

test('runSmoke sends the publishable key only to Auth and never to the API', async () => {
  const calls = [];
  await runSmoke({ ...config, fetch: fakeFetch(healthyRoutes, calls), now: steppingClock() });
  const signup = calls.find((c) => c.url.endsWith('/auth/v1/signup'));
  eq(signup.init.headers.apikey, 'sb_publishable_test');
  eq(calls.filter((c) => c.url.startsWith(API)).every((c) => !c.init?.headers?.apikey), true);
});

test('runSmoke fails when the database is down (503)', async () => {
  const routes = (url, init) =>
    url === `${API}/health`
      ? jsonResponse(503, { error: { code: 'database_unavailable' } })
      : healthyRoutes(url, init);
  const report = await runSmoke({ ...config, fetch: fakeFetch(routes), now: steppingClock() });
  eq(report.ok, false);
  eq(report.results[0].ok, false);
  eq(report.results[0].status, 503);
});

test('runSmoke fails when health is 200 but the database is not up', async () => {
  const routes = (url, init) =>
    url === `${API}/health` ? jsonResponse(200, { data: { ok: true, database: 'down' } }) : healthyRoutes(url, init);
  const report = await runSmoke({ ...config, fetch: fakeFetch(routes), now: steppingClock() });
  eq(report.ok, false);
  eq(report.results[0].detail.includes('database'), true);
});

test('runSmoke fails when public signup is enabled', async () => {
  const routes = (url, init) =>
    url.endsWith('/auth/v1/signup') ? jsonResponse(200, { id: 'new-user' }) : healthyRoutes(url, init);
  const report = await runSmoke({ ...config, fetch: fakeFetch(routes), now: steppingClock() });
  eq(report.ok, false);
  eq(report.results[3].ok, false);
});

test('runSmoke reports a network error as a failed check without throwing', async () => {
  const routes = (url, init) => {
    if (url.startsWith(`${API}/public/reports`)) throw new TypeError('fetch failed');
    return healthyRoutes(url, init);
  };
  const report = await runSmoke({ ...config, fetch: fakeFetch(routes), now: steppingClock() });
  eq(report.ok, false);
  eq(report.results[2].status, null);
  eq(report.results[2].detail.includes('fetch failed'), true);
});

test('runSmoke skips the signup check without a publishable key and still passes', async () => {
  const calls = [];
  const report = await runSmoke({ ...config, publishableKey: '', fetch: fakeFetch(healthyRoutes, calls), now: steppingClock() });
  eq(report.ok, true);
  eq(report.results[3].skipped, true);
  eq(calls.some((c) => c.url.endsWith('/auth/v1/signup')), false);
});

test('resolveConfig reads API_BASE_URL first, then the app variables, and derives the Auth URL', () => {
  eq(resolveConfig({ API_BASE_URL: `${API}/` }), { apiBaseUrl: API, supabaseUrl: AUTH, publishableKey: '' });
  eq(
    resolveConfig({ EXPO_PUBLIC_API_BASE_URL: API, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'k' }),
    { apiBaseUrl: API, supabaseUrl: AUTH, publishableKey: 'k' },
  );
  eq(resolveConfig({}).apiBaseUrl, '');
});

test('formatResults prints one line per check with its latency and a final verdict', () => {
  const text = formatResults({
    ok: false,
    results: [
      { name: 'GET /health', ok: true, status: 200, latency_ms: 120, detail: '' },
      { name: 'POST /auth/v1/signup', ok: false, status: 200, latency_ms: 80, detail: 'expected 422' },
    ],
  });
  eq(text.includes('GET /health') && text.includes('120 ms'), true);
  eq(text.includes('expected 422'), true);
  eq(/FALLÓ/.test(text.split('\n').at(-1)), true);
});
