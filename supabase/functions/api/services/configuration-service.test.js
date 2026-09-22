import { ConfigurationError } from '../domain/configuration.js';
import { createConfigurationService } from './configuration-service.js';

const userId = '00000000-0000-4000-8000-000000000001';
const actor = {
  type: 'authenticated', userId, role: 'administrator',
  profile: { id: userId, role: 'administrator', active: true },
};
const input = {
  flag_auto_hide_threshold: 6, duplicate_radius_meters: 150,
  duplicate_time_window_minutes: 120, trust_high_threshold: 0.8,
  trust_medium_threshold: 0.5, gps_accuracy_max_meters: 50,
  report_rate_limit_per_hour: 10, flag_rate_limit_per_hour: 30, change_note: 'Review',
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function rejects(operation, code) {
  try { await operation(); } catch (error) {
    assert(error.code === code, `Expected ${code}, got ${error.code}`);
    return;
  }
  throw new Error(`Expected ${code}`);
}

function harness(overrides = {}) {
  const events = [];
  let active = { id: 'old', is_active: true, version: 1 };
  const repository = {
    readConfigurationActor: () => { events.push('profile'); return actor.profile; },
    readConfigurationEnvironment: () => { events.push('environment'); return 'staging'; },
    lockConfigurationEnvironment: () => { events.push('lock'); },
    readActiveConfiguration: () => {
      events.push('read');
      return { configuration: active, zone_set: null };
    },
    insertConfigurationVersion: () => { events.push('insert'); return 'new'; },
    activateConfigurationVersion: () => {
      events.push('activate');
      active = { id: 'new', is_active: true, version: 2 };
    },
    insertConfigurationAudit: (_tx, values) => {
      events.push('audit');
      assert(values.previous.id === 'old' && values.current.id === 'new', 'Audit needs both versions');
      assert(values.actorId === userId && values.note === input.change_note, 'Audit must attribute actor/note');
    },
    ...overrides.repository,
  };
  const tx = (strings, ...values) => {
    events.push(strings.join('').includes('app.user_id') ? `actor:${values[0]}` : `role:${values[0]}`);
  };
  const service = createConfigurationService({
    getConfig: () => ({ expectedEnvironment: 'staging' }),
    getSql: () => {
      events.push('connection');
      return { begin: async (operation) => {
        events.push('begin');
        try {
          const value = await operation(tx);
          events.push('commit');
          return value;
        } catch (error) { events.push('rollback'); throw error; }
      } };
    },
    ...overrides,
    repository,
  });
  return { events, service };
}

Deno.test('FAB-1 SERVICE: invalid values and actors never obtain a database connection', async () => {
  const { service, events } = harness();
  await rejects(() => service.publish({ actor, input: { ...input, gps_accuracy_max_meters: 501 } }), 'invalid_request');
  for (const invalidActor of [undefined, { type: 'anonymous' }]) {
    await rejects(() => service.read({ actor: invalidActor }), 'authentication_required');
  }
  for (const invalidActor of [
    { ...actor, role: 'association' }, { ...actor, profile: { ...actor.profile, active: false } },
    { ...actor, profile: { ...actor.profile, id: 'someone-else' } },
  ]) {
    await rejects(() => service.publish({ actor: invalidActor, input }), 'forbidden');
  }
  assert(events.length === 0, 'Rejected requests must not touch storage');
});

Deno.test('FAB-1 SERVICE: publication sets context then locks, inserts, activates and audits before commit', async () => {
  const { service, events } = harness();
  const result = await service.publish({ actor, input });
  assert(result.configuration.version === 2 && result.zone_set === null, 'Return new active state');
  assert(JSON.stringify(events) === JSON.stringify([
    'connection', 'begin', `actor:${userId}`, 'role:administrator', 'profile', 'environment',
    'lock', 'read', 'insert', 'activate', 'read', 'audit', 'commit',
  ]), `Unexpected sequence: ${events}`);
});

Deno.test('FAB-1 SERVICE: failures in insertion, activation or audit abort the transaction', async () => {
  for (const name of ['insertConfigurationVersion', 'activateConfigurationVersion', 'insertConfigurationAudit']) {
    const failure = new Error('simulated database failure');
    const { service, events } = harness({ repository: { [name]: () => { throw failure; } } });
    try { await service.publish({ actor, input }); throw new Error('Expected failure'); }
    catch (error) { assert(error === failure, 'Unknown error must propagate'); }
    assert(events.at(-1) === 'rollback' && !events.includes('commit'), 'Must abort transaction');
  }
});

Deno.test('FAB-1 SERVICE: checks current profile and environment before configuration access', async () => {
  for (const profile of [null, { ...actor.profile, active: false }, { ...actor.profile, role: 'association' }]) {
    const { service, events } = harness({ repository: { readConfigurationActor: () => profile } });
    await rejects(() => service.read({ actor }), 'forbidden');
    assert(!events.includes('read'), 'Inactive actor must not read configuration');
  }
  const { service, events } = harness({ repository: { readConfigurationEnvironment: () => 'production' } });
  await rejects(() => service.publish({ actor, input }), 'preflight_mismatch');
  assert(!events.includes('insert'), 'Mismatch must not publish');
  const missing = harness({ getConfig: () => ({}) });
  await rejects(() => missing.service.read({ actor }), 'preflight_mismatch');
  assert(missing.events.length === 0, 'Missing environment must fail before connection');
});

Deno.test('FAB-1 SERVICE: missing configuration is unavailable, missing geofence is allowed', async () => {
  const empty = harness({ repository: { readActiveConfiguration: () => ({ configuration: null, zone_set: null }) } });
  await rejects(() => empty.service.read({ actor }), 'configuration_unavailable');
  const { service } = harness();
  assert((await service.read({ actor })).zone_set === null, 'L1 does not require activating a zone');
});

Deno.test('FAB-1 SERVICE: maps known persistence failures and keeps unknown ones internal', async () => {
  for (const [sqlCode, code] of [
    ['42501', 'forbidden'], ['23505', 'configuration_conflict'], ['40001', 'configuration_conflict'],
    ['40P01', 'configuration_conflict'], ['23514', 'invalid_request'], ['08006', 'dependency_unavailable'],
    ['CONNECT_TIMEOUT', 'dependency_unavailable'],
  ]) {
    const { service } = harness({ repository: { readConfigurationActor: () => {
      throw Object.assign(new Error('private SQL text'), { code: sqlCode });
    } } });
    await rejects(() => service.read({ actor }), code);
  }
  assert(new ConfigurationError('invalid_request', 'safe').code === 'invalid_request', 'Typed errors are explicit');
});
