import postgres from 'postgres';
import { createConfigurationService } from '../services/configuration-service.js';
import * as repository from '../repositories/configuration-repository.js';

// Opt-in only: a fresh, disposable local database. Never point this suite at Supabase.
const canReadUrl = Deno.permissions.querySync({ name: 'env', variable: 'CONFIGURATION_TEST_DATABASE_URL' }).state === 'granted';
const databaseUrl = canReadUrl ? Deno.env.get('CONFIGURATION_TEST_DATABASE_URL') : undefined;

function assert(condition, message) { if (!condition) throw new Error(message); }
async function rejects(operation, code) {
  try { await operation(); } catch (error) {
    if (code) assert(error.code === code, `Expected ${code}, got ${error.code}`);
    return;
  }
  throw new Error('Expected operation to fail');
}

// Load the actual relevant DDL, constraints, triggers and RLS policies from the
// target schema. Geometry/Storage are outside L1 and need no PostGIS fixture.
function fixtureSchema(source) {
  function match(pattern) {
    const value = source.match(pattern)?.[0];
    if (!value) throw new Error(`Target schema fixture not found: ${pattern}`);
    return value;
  }
  const parts = [
    'CREATE ROLE app_backend LOGIN NOBYPASSRLS NOINHERIT;',
    'CREATE SCHEMA auth; CREATE TABLE auth.users (id UUID PRIMARY KEY); CREATE SCHEMA app_private;',
  ];
  for (const type of ['user_role', 'deployment_environment', 'zone_set_status', 'audit_action']) {
    parts.push(match(new RegExp(`CREATE TYPE public\\.${type} AS ENUM \\([\\s\\S]*?\\);`)));
  }
  for (const table of ['deployment_metadata', 'profiles', 'zone_sets', 'audit_log']) {
    parts.push(match(new RegExp(`CREATE TABLE public\\.${table} \\([\\s\\S]*?\\n\\);`)));
  }
  parts.push(match(/CREATE UNIQUE INDEX uq_zone_sets_one_active_per_environment[\s\S]*?;/));
  const start = source.indexOf('CREATE TABLE public.config_versions (');
  const end = source.indexOf('CREATE TABLE public.reports (', start);
  assert(start >= 0 && end > start, 'Configuration DDL must exist');
  parts.push(source.slice(start, end));
  for (const name of ['actor_role', 'actor_id', 'is_active_actor']) {
    parts.push(match(new RegExp(`CREATE FUNCTION app_private\\.${name}\\([\\s\\S]*?\\$\\$;`)));
  }
  const tables = ['deployment_metadata', 'profiles', 'zone_sets', 'config_versions', 'audit_log'];
  for (const table of tables) parts.push(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
  for (const policy of ['deployment_backend_select', 'profiles_actor_select', 'zones_backend_select',
    'zones_backend_mutate', 'config_backend_select', 'config_backend_mutate', 'audit_backend_select', 'audit_backend_insert']) {
    parts.push(match(new RegExp(`CREATE POLICY ${policy} [\\s\\S]*?;`)));
  }
  parts.push(
    'REVOKE ALL ON SCHEMA app_private FROM PUBLIC;',
    'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;',
    'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;',
    'GRANT USAGE ON SCHEMA public, app_private TO app_backend;',
    `GRANT SELECT ON ${tables.map((name) => `public.${name}`).join(', ')} TO app_backend;`,
    'GRANT INSERT ON public.config_versions, public.audit_log TO app_backend;',
    'GRANT UPDATE (is_active) ON public.config_versions TO app_backend;',
    'GRANT EXECUTE ON FUNCTION app_private.actor_role(), app_private.actor_id(), app_private.is_active_actor(public.user_role) TO app_backend;',
    "INSERT INTO public.deployment_metadata (singleton, environment) VALUES (TRUE, 'staging');",
  );
  return parts.join('\n');
}

Deno.test({
  name: 'FAB-1 SQL: real PostgreSQL versioning, atomicity, concurrency and RLS',
  ignore: !databaseUrl,
  async fn(t) {
    const url = new URL(databaseUrl);
    assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
      url.pathname === '/fab1_configuration_test', 'Use a fresh local fab1_configuration_test database only');
    const sql = postgres(databaseUrl, { max: 10, prepare: false, onnotice: () => {} });
    try {
      const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname IN ('public', 'auth', 'app_private')`;
      assert(tables.length === 0, 'Refusing to alter a nonempty database');
      const source = await Deno.readTextFile(new URL('../../../../db/schema.sql', import.meta.url));
      await sql.unsafe(fixtureSchema(source));
      const userId = '00000000-0000-4000-8000-000000000001';
      await sql`INSERT INTO auth.users (id) VALUES (${userId})`;
      await sql`INSERT INTO public.profiles (id, role) VALUES (${userId}, 'administrator')`;
      const actor = { type: 'authenticated', userId, role: 'administrator',
        profile: { id: userId, active: true, role: 'administrator' } };
      const input = { flag_auto_hide_threshold: 6, duplicate_radius_meters: 150,
        duplicate_time_window_minutes: 120, trust_high_threshold: 0.8,
        trust_medium_threshold: 0.5, gps_accuracy_max_meters: 50,
        report_rate_limit_per_hour: 10, flag_rate_limit_per_hour: 30, change_note: 'Integration test' };
      const backend = { begin: (operation) => sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE app_backend`;
        return operation(tx);
      }) };
      const makeService = (repo = repository) => createConfigurationService({
        getSql: () => backend, getConfig: () => ({ expectedEnvironment: 'staging' }), repository: repo,
      });
      const service = makeService();
      const snapshot = async () => JSON.stringify({
        configs: await sql`SELECT * FROM public.config_versions ORDER BY environment, version`,
        audits: await sql`SELECT * FROM public.audit_log ORDER BY id`,
      });

      await t.step('each publication preserves history, attribution and the production configuration', async () => {
        const old = (await service.read({ actor })).configuration;
        const production = await sql`SELECT * FROM public.config_versions WHERE environment = 'production'`;
        const published = await service.publish({ actor, input });
        const current = (await service.read({ actor })).configuration;
        assert(current.version === 2 && current.id === published.configuration.id, 'GET must return published version');
        assert(current.flag_auto_hide_threshold === 6 && current.created_by === userId, 'Values/actor persisted');
        const [historical] = await sql`SELECT to_jsonb(c) AS row FROM public.config_versions c WHERE id = ${old.id}`;
        assert(historical.row.is_active === false, 'Old version becomes inactive');
        assert(JSON.stringify({ ...historical.row, is_active: true }) === JSON.stringify(old), 'Historical content is unchanged');
        assert(JSON.stringify(production) === JSON.stringify(await sql`SELECT * FROM public.config_versions WHERE environment = 'production'`), 'Production unchanged');
        const [audit] = await sql`SELECT * FROM public.audit_log WHERE entity_id = ${current.id}`;
        assert(audit.action === 'configuration_published' && audit.actor_id === userId &&
          audit.previous_values.id === old.id && audit.new_values.id === current.id, 'Audit stores before/after');
      });

      await t.step('failed insertion, activation and audit roll back every database change', async () => {
        for (const name of ['insertConfigurationVersion', 'activateConfigurationVersion', 'insertConfigurationAudit']) {
          const before = await snapshot();
          const failing = makeService({ ...repository, [name]: async (...args) => {
            await repository[name](...args);
            throw new Error(`Injected failure after ${name}`);
          } });
          await rejects(() => failing.publish({ actor, input }));
          assert(await snapshot() === before, `Rollback incomplete after ${name}`);
        }
      });

      await t.step('concurrent readers see old committed configuration until the complete publication commits', async () => {
        const old = (await service.read({ actor })).configuration;
        let release, ready;
        const gate = new Promise((resolve) => { release = resolve; });
        const entered = new Promise((resolve) => { ready = resolve; });
        const slow = makeService({ ...repository, insertConfigurationAudit: async (...args) => {
          await repository.insertConfigurationAudit(...args);
          ready();
          await gate;
        } });
        const publishing = slow.publish({ actor, input });
        try {
          await Promise.race([entered, publishing.then(() => { throw new Error('Publication did not pause'); })]);
          const observed = (await service.read({ actor })).configuration;
          assert(observed.id === old.id, 'Reader must see the old committed version');
        } finally { release(); await publishing; }
        assert((await service.read({ actor })).configuration.id !== old.id, 'New version visible after commit');
      });

      await t.step('six simultaneous publications serialize into unique consecutive versions', async () => {
        const previous = (await service.read({ actor })).configuration.version;
        const results = await Promise.all(Array.from({ length: 6 }, (_, index) => service.publish({
          actor, input: { ...input, change_note: `Concurrent ${index}` },
        })));
        const versions = results.map((value) => value.configuration.version).sort((a, b) => a - b);
        assert(versions.every((version, index) => version === previous + index + 1), 'Version allocation must be serialized');
        const [counts] = await sql`SELECT count(*)::int AS count FROM public.config_versions WHERE environment = 'staging' AND is_active`;
        assert(counts.count === 1, 'Exactly one staging version must be active');
      });

      await t.step('invalid input, inactive profiles and environment mismatch do not mutate data', async () => {
        const before = await snapshot();
        await rejects(() => service.publish({ actor, input: { ...input, report_rate_limit_per_hour: 0 } }), 'invalid_request');
        await sql`UPDATE public.profiles SET active = FALSE WHERE id = ${userId}`;
        await rejects(() => service.publish({ actor, input }), 'forbidden');
        await sql`UPDATE public.profiles SET active = TRUE WHERE id = ${userId}`;
        await sql`UPDATE public.deployment_metadata SET environment = 'production'`;
        await rejects(() => service.publish({ actor, input }), 'preflight_mismatch');
        await sql`UPDATE public.deployment_metadata SET environment = 'staging'`;
        assert(await snapshot() === before, 'Rejected operations changed configuration/audit');
      });

      await t.step('database denies content rewrites, deletion, audit edits and unauthenticated mutations', async () => {
        const current = (await service.read({ actor })).configuration;
        const withActor = (operation) => backend.begin(async (tx) => {
          await tx`SELECT set_config('app.user_id', ${userId}, true)`;
          await tx`SELECT set_config('app.role', 'administrator', true)`;
          return operation(tx);
        });
        await rejects(() => withActor((tx) => tx`UPDATE public.config_versions SET change_note = 'rewrite' WHERE id = ${current.id}`), '42501');
        await rejects(() => sql`UPDATE public.config_versions SET change_note = 'rewrite' WHERE id = ${current.id}`, '55000');
        await rejects(() => withActor((tx) => tx`DELETE FROM public.config_versions WHERE id = ${current.id}`), '42501');
        await rejects(() => withActor((tx) => tx`UPDATE public.audit_log SET note = 'rewrite'`), '42501');
        await rejects(() => backend.begin((tx) => repository.insertConfigurationVersion(tx, {
          environment: 'staging', actorId: userId, values: input,
        })), '42501');
        const context = await backend.begin((tx) => tx`SELECT current_setting('app.user_id', true) AS actor, current_setting('app.role', true) AS role`);
        assert(!context[0].actor && !context[0].role, 'Actor context must not leak through pool reuse');
      });

      await t.step('GET includes only the active zone metadata for the deployment environment', async () => {
        for (const environment of ['staging', 'production']) {
          await sql`INSERT INTO public.zone_sets (
            environment, version, name, source_uri, source_version, source_sha256,
            source_geojson, status, association_approval_reference, approved_at, activated_at, created_by
          ) VALUES (
            ${environment}, 1, ${'Local fixture ' + environment}, 'urn:test:zone', 'test-v1',
            ${'a'.repeat(64)}, ${sql.json({
              type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]],
            })}, 'active', 'Local test fixture only', now(), now(), ${userId}
          )`;
        }
        const result = await service.read({ actor });
        assert(result.zone_set.environment === 'staging' && result.zone_set.version === 1 &&
          result.zone_set.source_sha256 === 'a'.repeat(64), 'Must return versioned zone metadata for staging');
      });

      await t.step('missing active configuration returns 503 code and can be recovered by publication', async () => {
        await sql`UPDATE public.config_versions SET is_active = FALSE WHERE environment = 'staging'`;
        await rejects(() => service.read({ actor }), 'configuration_unavailable');
        const result = await service.publish({ actor, input });
        assert(result.configuration.is_active === true, 'Publication must establish a new active version');
      });
    } finally { await sql.end(); }
  },
});
