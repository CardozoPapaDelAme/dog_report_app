import { Hono } from 'hono';
import { getCurrentProfileController } from '../controllers/identity-controller.js';
import { requestId } from '../middleware/request-id.js';
import { createConfigurationRoutes } from '../routes/configuration.js';
import { createConfigurationService } from '../services/configuration-service.js';

const values = {
  flag_auto_hide_threshold: 5, duplicate_radius_meters: 150,
  duplicate_time_window_minutes: 120, trust_high_threshold: 0.8,
  trust_medium_threshold: 0.5, gps_accuracy_max_meters: 50,
  report_rate_limit_per_hour: 10, flag_rate_limit_per_hour: 30, change_note: 'Initial test configuration',
};
function assert(condition, message) { if (!condition) throw new Error(message); }

function scenario(role = 'administrator') {
  const userId = '00000000-0000-4000-8000-000000000001';
  const profile = { id: userId, role, active: true, display_name: 'FAB-1 test user' };
  let storedProfile = { ...profile };
  let rows = [{
    ...values, id: '00000000-0000-4000-8000-000000000002', environment: 'staging',
    version: 1, is_active: true, created_by: userId, created_at: '2026-09-19T12:00:00Z',
    fingerprint_retention_days: 30, public_retention_days: 90, business_retention_days: 1826,
    audit_retention_days: 730, deleted_retention_days: 365,
  }];
  let audits = [];
  const repository = {
    readConfigurationActor: () => storedProfile,
    readConfigurationEnvironment: () => 'staging',
    lockConfigurationEnvironment() {},
    readActiveConfiguration: () => ({
      configuration: structuredClone(rows.find((row) => row.is_active)), zone_set: null,
    }),
    insertConfigurationVersion(_tx, { environment, actorId, values: input }) {
      const row = { ...rows[0], ...input, environment, created_by: actorId,
        id: crypto.randomUUID(), version: rows.length + 1, is_active: false };
      rows.push(row);
      return row.id;
    },
    activateConfigurationVersion(_tx, { id }) {
      for (const row of rows) row.is_active = row.id === id;
    },
    insertConfigurationAudit(_tx, audit) { audits.push(structuredClone(audit)); },
  };
  const service = createConfigurationService({
    repository,
    getConfig: () => ({ expectedEnvironment: 'staging' }),
    getSql: () => ({ begin: async (operation) => {
      const before = structuredClone({ rows, audits });
      try { return await operation(() => {}); }
      catch (error) { rows = before.rows; audits = before.audits; throw error; }
    } }),
  });
  // This test-only middleware supplies the shape normally produced by requireAuth.
  // JWT verification and PostgreSQL are deliberately outside this in-memory test.
  const verifiedSession = async (c, next) => {
    c.set('auth', { type: 'authenticated', userId, role, profile });
    await next();
  };
  const app = new Hono().basePath('/api');
  app.use('*', requestId);
  app.get('/me', verifiedSession, getCurrentProfileController);
  app.route('/', createConfigurationRoutes({ service, authorize: verifiedSession }));
  return {
    app, userId, rows: () => rows, audits: () => audits,
    disableProfile: () => { storedProfile = { ...storedProfile, active: false }; },
  };
}

function publish(app, input) {
  return app.request('/api/admin/configuration', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
}

Deno.test('FAB-1 simulated session: identity, read, publish and reread use the same Administrator', async () => {
  const test = scenario();
  const me = await test.app.request('/api/me');
  const identity = (await me.json()).data;
  assert(me.status === 200 && identity.user_id === test.userId && identity.role === 'administrator', 'Identity contract');
  const before = await test.app.request('/api/admin/configuration');
  assert(before.status === 200 && (await before.json()).data.configuration.version === 1, 'Initial version');
  const posted = await publish(test.app, { ...values, flag_auto_hide_threshold: 6, change_note: 'Administrator review' });
  const created = (await posted.json()).data.configuration;
  assert(posted.status === 201 && created.created_by === identity.user_id, 'Publication attributed to /me identity');
  const after = (await (await test.app.request('/api/admin/configuration')).json()).data.configuration;
  assert(after.id === created.id && after.version === 2 && after.flag_auto_hide_threshold === 6, 'New active state returned');
  assert(test.rows()[0].flag_auto_hide_threshold === 5 && !test.rows()[0].is_active, 'Historical values preserved');
  assert(test.audits().length === 1 && test.audits()[0].actorId === identity.user_id, 'Audit belongs to same actor');
});

Deno.test('FAB-1 simulated session: an association identity cannot read or publish Administrator configuration', async () => {
  const test = scenario('association');
  const me = await test.app.request('/api/me');
  assert(me.status === 200 && (await me.json()).data.role === 'association', 'Other authenticated role may read identity');
  for (const response of [await test.app.request('/api/admin/configuration'), await publish(test.app, values)]) {
    assert(response.status === 403 && (await response.json()).error.code === 'forbidden', 'Configuration Service must deny sibling role');
  }
  assert(test.rows().length === 1 && test.audits().length === 0, 'Denied role cannot mutate');
});

Deno.test('FAB-1 simulated session: invalid values and a revoked profile cannot publish after GET /me', async () => {
  const test = scenario();
  assert((await test.app.request('/api/me')).status === 200, 'Session starts with valid identity');
  const invalid = await publish(test.app, { ...values, gps_accuracy_max_meters: 501 });
  assert(invalid.status === 400 && (await invalid.json()).error.details.fields.gps_accuracy_max_meters, 'Field error reaches HTTP client');
  test.disableProfile();
  const revoked = await publish(test.app, values);
  assert(revoked.status === 403, 'Service rechecks stored profile rather than trusting earlier /me');
  assert(test.rows().length === 1 && test.audits().length === 0, 'No rejected publication is stored');
});
