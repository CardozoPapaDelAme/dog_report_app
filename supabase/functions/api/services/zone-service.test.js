import { canonicalZoneGeometry, sha256Hex } from '../domain/zone-set.js';
import { ZoneSetError } from '../domain/zone-set.js';
import { createZoneService } from './zone-service.js';

const userId = '00000000-0000-4000-8000-000000000001';
const actor = {
  type: 'authenticated', userId, role: 'administrator',
  profile: { id: userId, role: 'administrator', active: true },
};
const geometry = {
  type: 'Polygon',
  coordinates: [[[-107.64, 27.73], [-107.63, 27.73], [-107.63, 27.74], [-107.64, 27.73]]],
};

function assert(condition, message) { if (!condition) throw new Error(message); }
async function rejects(operation, code) {
  try { await operation(); } catch (error) {
    assert(error.code === code, `Expected ${code}, got ${error.code}`);
    return;
  }
  throw new Error(`Expected ${code}`);
}

async function makeCreationInput() {
  return {
    name: 'Creel candidate', source_uri: 'https://example.test/creel.geojson', source_version: 'v1',
    source_sha256: await sha256Hex(canonicalZoneGeometry(geometry)), geometry,
  };
}

async function harness(overrides = {}) {
  const { repository: repositoryOverrides = {}, ...serviceOverrides } = overrides;
  const events = [];
  const source_geojson = JSON.parse(canonicalZoneGeometry(geometry));
  const source_sha256 = await sha256Hex(canonicalZoneGeometry(source_geojson));
  let target = {
    id: 'new', environment: 'staging', version: 2, name: 'Creel candidate',
    source_uri: 'https://example.test/creel.geojson', source_version: 'v1', source_sha256,
    source_geojson, status: 'draft', association_approval_reference: null,
  };
  const active = { id: 'old', environment: 'staging', version: 1, status: 'active' };
  const repository = {
    readZoneActor: () => { events.push('profile'); return actor.profile; },
    readZoneEnvironment: () => { events.push('environment'); return 'staging'; },
    lockZoneEnvironment: () => { events.push('lock'); },
    insertZoneSet: () => { events.push('insert'); return 'new'; },
    readZoneSet: (_tx, { id, forUpdate }) => {
      events.push(forUpdate ? 'target-for-update' : `read:${id}`);
      return id === 'new' ? target : null;
    },
    readActiveZoneSets: () => { events.push('active'); return target.status === 'active' ? [target] : [active]; },
    activateZoneSet: () => {
      events.push('activate');
      target = {
        ...target, status: 'active', association_approval_reference: 'AHC-2026-09-21',
        approved_at: '2026-09-21T00:00:00Z', activated_at: '2026-09-21T00:00:00Z',
      };
    },
    insertZoneAudit: (_tx, values) => {
      events.push(`audit:${values.action}`);
      assert(values.actorId === userId, 'Audit must attribute actor');
    },
    ...repositoryOverrides,
  };
  const tx = (strings, ...values) => {
    events.push(strings.join('').includes('app.user_id') ? `actor:${values[0]}` : `role:${values[0]}`);
  };
  const service = createZoneService({
    getConfig: () => ({ expectedEnvironment: 'staging' }),
    getSql: () => ({ begin: async (operation) => {
      events.push('begin');
      try { const value = await operation(tx); events.push('commit'); return value; }
      catch (error) { events.push('rollback'); throw error; }
    } }),
    ...serviceOverrides,
    repository,
  });
  return { events, service };
}

Deno.test('FAB-2 SERVICE: invalid create input and invalid actors never obtain a connection', async () => {
  const { service, events } = await harness();
  const validInput = await makeCreationInput();
  await rejects(() => service.create({ actor, input: { name: 'bad' } }), 'invalid_request');
  await rejects(() => service.activate({ actor: { type: 'anonymous' }, zoneSetId: 'new', input: {} }), 'authentication_required');
  await rejects(() => service.create({ actor: { ...actor, profile: { ...actor.profile, active: false } }, input: validInput }), 'forbidden');
  assert(events.length === 0, 'Rejected calls must not touch storage');
});

Deno.test('FAB-2 SERVICE: creation writes immutable draft, geometry and audit in one transaction', async () => {
  const { service, events } = await harness();
  const result = await service.create({ actor, input: await makeCreationInput() });
  assert(result.status === 'draft', 'Creation must not activate');
  assert(JSON.stringify(events) === JSON.stringify([
    'begin', `actor:${userId}`, 'role:administrator', 'profile', 'environment',
    'lock', 'insert', 'read:new', 'audit:zone_set_created', 'commit',
  ]), `Unexpected sequence: ${events}`);
});

Deno.test('FAB-2 SERVICE: activation validates stored checksum then atomically replaces the active set', async () => {
  const { service, events } = await harness();
  const result = await service.activate({
    actor, zoneSetId: 'new',
    input: { association_approval_reference: 'AHC-2026-09-21', note: 'Checked by Administrator.' },
  });
  assert(result.status === 'active', 'Target must become active');
  assert(JSON.stringify(events) === JSON.stringify([
    'begin', `actor:${userId}`, 'role:administrator', 'profile', 'environment',
    'lock', 'target-for-update', 'active', 'activate', 'read:new', 'audit:zone_set_activated', 'commit',
  ]), `Unexpected sequence: ${events}`);
});

Deno.test('FAB-2 SERVICE: inactive profile, missing set, checksum mismatch and multiple active sets roll back', async () => {
  const activation = { association_approval_reference: 'AHC-2026-09-21' };
  for (const [overrides, expected] of [
    [{ repository: { readZoneActor: () => null } }, 'forbidden'],
    [{ repository: { readZoneSet: () => null } }, 'not_found'],
    [{ repository: { readZoneSet: async () => ({
      id: 'new', status: 'draft', source_geojson: JSON.parse(canonicalZoneGeometry(geometry)), source_sha256: 'a'.repeat(64),
    }) } }, 'zone_set_conflict'],
    [{ repository: { readActiveZoneSets: () => [{ id: 'a' }, { id: 'b' }] } }, 'zone_set_conflict'],
  ]) {
    const { service, events } = await harness(overrides);
    await rejects(() => service.activate({ actor, zoneSetId: 'new', input: activation }), expected);
    assert(events.at(-1) === 'rollback', 'Failure must roll back');
  }
});

Deno.test('FAB-2 SERVICE: maps expected database failures without exposing unknown errors', async () => {
  const input = await makeCreationInput();
  for (const [sqlCode, code] of [['42501', 'forbidden'], ['23505', 'zone_set_conflict'], ['23514', 'invalid_request'], ['08006', 'dependency_unavailable']]) {
    const { service } = await harness({ repository: { readZoneActor: () => {
      throw Object.assign(new Error('private SQL detail'), { code: sqlCode });
    } } });
    await rejects(() => service.create({ actor, input }), code);
  }
  assert(new ZoneSetError('invalid_request', 'safe').code === 'invalid_request', 'Typed errors stay explicit');
});
