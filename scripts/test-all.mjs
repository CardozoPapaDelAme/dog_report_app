#!/usr/bin/env node
/**
 * Single entry point for the automated test suites.
 *
 * Invoked as `npm test` (all suites) or `npm run test:deno|test:node|test:e2e`
 * (`node scripts/test-all.mjs [docs] [deno] [node] [e2e]`). Discovers `*.test.js`/`*.test.mjs`
 * files under the configured roots, routes files importing `node:test` to Node and the rest
 * to Deno, runs each selected suite, prints a per-suite summary and exits with 0 only when
 * every suite passed (2 for an unknown suite name).
 *
 * @module scripts/test-all
 */
// Single entry point for the whole automated test suite (backlog T2).
//   node scripts/test-all.mjs            -> docs, deno, node and e2e
//   node scripts/test-all.mjs deno node  -> only the named suites
// PostgreSQL suites are not run here: they skip themselves unless their
// *_TEST_DATABASE_URL variable is set (see docs/TESTING.md).
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANSI, lastNumber as last, printSummary, summaryRow } from './lib/summary.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const TEST_ROOTS = ['models', 'services', 'controllers', 'hooks', 'i18n', 'scripts', 'supabase/functions/api'];
const SKIP_DIRS = new Set(['node_modules', '.git', '.expo']);
const NODE_TEST_IMPORT = /from\s+['"]node:test['"]/;

/**
 * Recursively collects test files (`*.test.js`/`*.test.mjs`), skipping `SKIP_DIRS`.
 *
 * @param {string} dir Directory to scan, relative to the repository root.
 * @param {string[]} [found=[]] Accumulator of collected paths.
 * @returns {string[]} The accumulator with every test file path found.
 */
function collectTests(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collectTests(path, found);
    else if (/\.test\.(js|mjs)$/.test(entry.name)) found.push(path);
  }
  return found;
}

// A file that imports node:test cannot run under `deno test` (it may import
// npm packages Deno does not resolve, e.g. xlsx) and would be counted twice.
const allTests = TEST_ROOTS.flatMap((dir) => collectTests(dir)).sort();
const nodeTests = allTests.filter((file) => NODE_TEST_IMPORT.test(readFileSync(file, 'utf8')));
const denoTests = allTests.filter((file) => !nodeTests.includes(file));

/**
 * Suite definitions keyed by CLI name: label, command, arguments and an output parser
 * that returns `{passed, failed, skipped}` counters (`null` when not printed).
 *
 * @type {Record<string, {label: string, cmd: string, args: string[], parse: (out: string) => {passed: number|null, failed: number|null, skipped: number|null}}>}
 */
const suites = {
  docs: {
    label: 'Documentación (rutas)',
    cmd: process.execPath,
    args: ['scripts/check-doc-paths.mjs'],
    parse: (out) => ({
      passed: /, 0 errores\./.test(out) ? 1 : 0,
      failed: last(out, /(\d+) errores/g),
      skipped: 0,
    }),
  },
  deno: {
    label: 'Deno (móvil + backend)',
    cmd: 'deno',
    // --allow-env: jimp-compact reads ENVIRONMENT; there is no TTY to prompt for it.
    args: ['test', '--no-lock', '--allow-env', '--config', 'supabase/functions/api/deno.json', ...denoTests],
    parse: (out) => ({
      passed: last(out, /(\d+) passed/g),
      failed: last(out, /(\d+) failed/g),
      skipped: last(out, /(\d+) ignored/g),
    }),
  },
  node: {
    label: 'node:test',
    cmd: process.execPath,
    // Explicit reporter: Node 22 prints TAP when piped, newer Node prints spec.
    args: ['--test', '--test-reporter=spec', ...nodeTests],
    parse: (out) => ({
      passed: last(out, /^ℹ pass (\d+)/gm),
      failed: last(out, /^ℹ fail (\d+)/gm),
      skipped: last(out, /^ℹ skipped (\d+)/gm),
    }),
  },
  e2e: {
    label: 'Playwright (UI)',
    cmd: 'npx',
    args: ['playwright', 'test'],
    parse: (out) => ({
      passed: last(out, /(\d+) passed/g),
      failed: last(out, /(\d+) failed/g),
      skipped: last(out, /(\d+) skipped/g),
    }),
  },
};

/**
 * Runs one suite, forwarding its stdout/stderr live while capturing the combined output.
 *
 * @param {{cmd: string, args: string[]}} suite Suite definition.
 * @returns {Promise<{code: number, output: string}>} Exit code (1 on spawn error or null code) and output; never rejects.
 */
function run(suite) {
  return new Promise((resolve) => {
    const child = spawn(suite.cmd, suite.args, { stdio: ['inherit', 'pipe', 'pipe'] });
    let output = '';
    const forward = (stream, sink) => stream.on('data', (chunk) => {
      sink.write(chunk);
      output += chunk.toString();
    });
    forward(child.stdout, process.stdout);
    forward(child.stderr, process.stderr);
    child.on('error', (error) => resolve({ code: 1, output: `${output}\n${error.message}` }));
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

const selected = process.argv.slice(2);
const names = selected.length ? selected : Object.keys(suites);
const unknown = names.filter((name) => !suites[name]);
if (unknown.length) {
  console.error(`Unknown suite(s): ${unknown.join(', ')}. Valid: ${Object.keys(suites).join(', ')}`);
  process.exit(2);
}

const results = [];
for (const name of names) {
  const suite = suites[name];
  console.log(`\n=== ${suite.label} ===\n`);
  const { code, output } = await run(suite);
  results.push({ suite, code, totals: suite.parse(output.replace(ANSI, '')) });
}

printSummary(results.map(({ suite, code, totals }) => summaryRow(suite.label, totals, code)));

process.exit(results.every(({ code }) => code === 0) ? 0 : 1);
