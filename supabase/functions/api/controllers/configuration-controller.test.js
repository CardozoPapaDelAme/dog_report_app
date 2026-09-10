import { Hono } from 'hono';
import { createConfigurationRoutes } from '../routes/configuration.js';
import { ConfigurationError } from '../domain/configuration.js';
import { requestId } from '../middleware/request-id.js';
import { app as actualApp } from '../app.js';

const input = {
  flag_auto_hide_threshold: 5, duplicate_radius_meters: 150,
  duplicate_time_window_minutes: 120, trust_high_threshold: 0.8,
  trust_medium_threshold: 0.5, gps_accuracy_max_meters: 50,
  report_rate_limit_per_hour: 10, flag_rate_limit_per_hour: 30, change_note: 'Review',
};
const state = {
  configuration: {
    ...input, id: '00000000-0000-4000-8000-000000000001', environment: 'staging',
    version: 2, is_active: true, created_at: '2026-09-09T12:00:00+00:00', created_by: null,
    fingerprint_retention_days: 30, public_retention_days: 90, business_retention_days: 1826,
    audit_retention_days: 730, deleted_retention_days: 365, private_field: 'must not leak',
  },
  zone_set: null,
};

function assert(condition, message) { if (!condition) throw new Error(message); }
function harness({ realAuth = false, failure = null } = {}) {
  let calls = 0;
  const service = {
    read() { calls++; if (failure) throw failure; return state; },
    publish({ input: values }) {
      calls++;
      if (failure) throw failure;
      assert(JSON.stringify(values) === JSON.stringify(input), 'Must pass complete validated input');
      return state;
    },
  };
  const authorize = async (c, next) => { c.set('auth', { type: 'authenticated' }); await next(); };
  const app = new Hono();
  app.use('*', requestId);
  app.route('/', createConfigurationRoutes({ service, ...(realAuth ? {} : { authorize }) }));
  return { app, calls: () => calls };
}

Deno.test('FAB-1 HTTP: GET and POST return typed active state, UTC timestamps and request id', async () => {
  const { app, calls } = harness();
  for (const prefix of ['', '/api']) {
    const get = await app.request(`${prefix}/admin/configuration`);
    const post = await app.request(`${prefix}/admin/configuration`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    });
    assert(get.status === 200 && post.status === 201, 'Correct success statuses');
    for (const response of [get, post]) {
      const body = await response.json();
      assert(response.headers.has('X-Request-Id'), 'Request id header required');
      assert(body.data.configuration.version === 2 && body.data.zone_set === null, 'Active state');
      assert(body.data.configuration.created_at.endsWith('Z'), 'UTC timestamp');
      assert(!('private_field' in body.data.configuration), 'Presenter must allowlist fields');
      assert(typeof body.data.configuration.trust_high_threshold === 'number', 'Numeric threshold');
    }
  }
  assert(calls() === 4, 'One service invocation per valid request');
});

Deno.test('FAB-1 HTTP-RED-001/002: malformed requests and wrong methods never invoke service', async () => {
  const { app, calls } = harness();
  for (const body of ['', '{', '[]', 'null', '{}', JSON.stringify({ ...input, environment: 'production' }),
    JSON.stringify({ ...input, flag_auto_hide_threshold: 101 })]) {
    const response = await app.request('/admin/configuration', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    });
    assert(response.status === 400 && (await response.json()).error.code === 'invalid_request', 'Invalid input');
  }
  const wrongType = await app.request('/admin/configuration', { method: 'POST', body: JSON.stringify(input) });
  assert(wrongType.status === 400, 'JSON content type required');
  const query = await app.request('/admin/configuration?environment=production');
  assert(query.status === 400, 'Caller cannot choose environment');
  for (const method of ['PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']) {
    const response = await app.request('/admin/configuration', { method });
    assert(response.status === 405 && response.headers.get('Allow') === 'GET, POST', 'Method contract');
  }
  const missing = await app.request('/admin/not-a-route');
  assert(missing.status === 404, 'Unknown route must be absent');
  assert(calls() === 0, 'Service must not receive malformed requests');
});

Deno.test('FAB-1 HTTP: both route aliases are mounted in the real application', async () => {
  for (const path of ['/admin/configuration', '/api/admin/configuration']) {
    const response = await actualApp.request(path);
    assert(response.status === 401, 'Mounted route must require authentication');
    const wrongMethod = await actualApp.request(path, { method: 'PUT' });
    assert(wrongMethod.status === 405, 'Mounted route must reject unsupported methods');
  }
});

Deno.test('FAB-1 HTTP: invalid field response identifies the field and range', async () => {
  const { app } = harness();
  const response = await app.request('/admin/configuration', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, gps_accuracy_max_meters: 501 }),
  });
  const body = await response.json();
  assert(body.error.details.fields.gps_accuracy_max_meters.includes('500'), 'Field-level range error');
  assert(body.error.request_id === response.headers.get('X-Request-Id'), 'Matching request id');
});

Deno.test('FAB-1 HTTP-RED-003: missing and invalid credentials never invoke service', async () => {
  const { app, calls } = harness({ realAuth: true });
  for (const headers of [{}, { Authorization: 'Basic invalid' }, { Authorization: 'Bearer malformed' }]) {
    const response = await app.request('/admin/configuration', { headers });
    assert(response.status === 401, 'Unauthenticated request denied');
  }
  assert(calls() === 0, 'Authentication must precede service');
});

Deno.test('FAB-1 HTTP: known errors retain status, unknown failures do not expose SQL', async () => {
  for (const [code, status] of [
    ['authentication_required', 401], ['forbidden', 403], ['invalid_request', 400],
    ['configuration_conflict', 409], ['configuration_unavailable', 503],
    ['dependency_unavailable', 503], ['preflight_mismatch', 503],
  ]) {
    const { app } = harness({ failure: new ConfigurationError(code, 'Safe message') });
    const response = await app.request('/admin/configuration');
    assert(response.status === status && (await response.json()).error.code === code, 'Typed error mapping');
  }
  const { app } = harness({ failure: Object.assign(new Error('SELECT secret FROM private_table'), { code: 'XX000' }) });
  const response = await app.request('/admin/configuration');
  const body = await response.text();
  assert(response.status === 500 && !body.includes('SELECT') && !body.includes('private_table'), 'No leakage');
});
