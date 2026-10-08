#!/usr/bin/env node
// Runs the opt-in PostgreSQL/PostGIS suites (backlog T2). Needs Docker.
// Each suite gets its own throwaway container: flag and public-map create
// cluster-level roles, and every suite requires a fresh database with a fixed
// name created after startup (see docs/TESTING.md, "Database suites").
//   node scripts/test-postgres.mjs               -> all five suites
//   node scripts/test-postgres.mjs zone flag     -> only the named ones
import { spawn, spawnSync } from 'node:child_process';
import { arch } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANSI, lastNumber, printSummary, summaryRow } from './lib/summary.mjs';

process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..'));

const IMAGE = 'postgis/postgis:17-3.5';
const PASSWORD = 'local-test-only'; // disposable container bound to loopback only
const TESTS = 'supabase/functions/api/tests';

// `read` is the only path each suite may read: the configuration suite loads
// db/schema.sql, the others apply the ordered supabase/migrations.
const suites = {
  configuration: { label: 'PostgreSQL · configuración (FAB-1)', db: 'fab1_configuration_test', env: 'CONFIGURATION_TEST_DATABASE_URL', file: 'configurationPostgres.test.js', port: 55431, read: 'db/schema.sql' },
  zone: { label: 'PostgreSQL · zonas (FAB-2)', db: 'fab2_zone_test', env: 'ZONE_TEST_DATABASE_URL', file: 'zonePostgres.test.js', port: 55432, read: 'supabase/migrations' },
  duplicate: { label: 'PostgreSQL · duplicados (FAB-3)', db: 'fab3_duplicate_test', env: 'DUPLICATE_TEST_DATABASE_URL', file: 'duplicatePostgres.test.js', port: 55433, read: 'supabase/migrations' },
  flag: { label: 'PostgreSQL · reportes (L2)', db: 'fab4_flag_test', env: 'FLAG_TEST_DATABASE_URL', file: 'flag-postgres.test.js', port: 55434, read: 'supabase/migrations' },
  publicMap: { label: 'PostgreSQL · mapa público', db: 'fab_public_map_test', env: 'PUBLIC_MAP_TEST_DATABASE_URL', file: 'publicMapPostgres.test.js', port: 55435, read: 'supabase/migrations' },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const docker = (...args) => spawnSync('docker', args, { encoding: 'utf8' });

function startContainer(name, port) {
  // The image is amd64-only; Apple-silicon hosts run it emulated (slower).
  const platform = arch() === 'arm64' ? ['--platform', 'linux/amd64'] : [];
  const result = docker('run', '--detach', '--rm', '--name', name, ...platform,
    '--tmpfs', '/var/lib/postgresql/data:rw', '--env', `POSTGRES_PASSWORD=${PASSWORD}`,
    '--publish', `127.0.0.1:${port}:5432`, IMAGE);
  if (result.status !== 0) throw new Error(`docker run failed: ${result.stderr}`);
}

// pg_isready over the unix socket succeeds while the image's init server is still
// running, so probe over TCP: that only works once the final server is up.
async function waitForPostgres(name) {
  for (let attempt = 0; attempt < 90; attempt++) {
    const probe = docker('exec', name, 'psql', '-U', 'postgres', '-h', '127.0.0.1', '-d', 'postgres', '-tAc', 'SELECT 1');
    if (probe.status === 0) return;
    await sleep(2000);
  }
  throw new Error(`PostgreSQL did not become ready in container ${name}`);
}

function runDeno(suite) {
  const url = `postgres://postgres:${PASSWORD}@127.0.0.1:${suite.port}/${suite.db}`;
  const args = ['test', '--no-lock', '--allow-env', `--allow-net=127.0.0.1:${suite.port}`,
    `--allow-read=${suite.read}`, '--config', 'supabase/functions/api/deno.json', `${TESTS}/${suite.file}`];
  return new Promise((resolve) => {
    const child = spawn('deno', args, { env: { ...process.env, [suite.env]: url }, stdio: ['inherit', 'pipe', 'pipe'] });
    let output = '';
    for (const [stream, sink] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
      stream.on('data', (chunk) => { sink.write(chunk); output += chunk.toString(); });
    }
    child.on('error', (error) => resolve({ code: 1, output: `${output}\n${error.message}` }));
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

async function runSuite(key) {
  const suite = suites[key];
  const container = `td-pg-${key.toLowerCase()}-${process.pid}`;
  console.log(`\n=== ${suite.label} ===\n`);
  try {
    startContainer(container, suite.port);
    await waitForPostgres(container);
    const created = docker('exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-c', `CREATE DATABASE ${suite.db};`);
    if (created.status !== 0) throw new Error(`CREATE DATABASE failed: ${created.stderr}`);
    const { code, output } = await runDeno(suite);
    const text = output.replace(ANSI, '');
    const totals = {
      passed: lastNumber(text, /(\d+) passed/g),
      failed: lastNumber(text, /(\d+) failed/g),
      skipped: lastNumber(text, /(\d+) ignored/g),
    };
    // A skipped suite means the URL never reached the test: that is not a pass.
    const silentlySkipped = (totals.skipped ?? 0) > 0 || !totals.passed;
    return { suite, code: code === 0 && !silentlySkipped ? 0 : 1, totals };
  } catch (error) {
    console.error(error.message);
    return { suite, code: 1, totals: { passed: null, failed: null, skipped: null } };
  } finally {
    docker('stop', container);
  }
}

if (docker('version', '--format', '{{.Server.Version}}').status !== 0) {
  console.error('Docker is required and its daemon must be running.');
  process.exit(2);
}

const selected = process.argv.slice(2);
const keys = selected.length ? selected : Object.keys(suites);
const unknown = keys.filter((key) => !suites[key]);
if (unknown.length) {
  console.error(`Unknown suite(s): ${unknown.join(', ')}. Valid: ${Object.keys(suites).join(', ')}`);
  process.exit(2);
}

const results = [];
for (const key of keys) results.push(await runSuite(key));

printSummary(results.map(({ suite, code, totals }) => summaryRow(suite.label, totals, code)), 'Resumen PostgreSQL');
process.exit(results.every(({ code }) => code === 0) ? 0 : 1);
