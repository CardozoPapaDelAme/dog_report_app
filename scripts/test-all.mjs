#!/usr/bin/env node
// Single entry point for the whole automated test suite (backlog T2).
//   node scripts/test-all.mjs            -> deno, node and e2e
//   node scripts/test-all.mjs deno node  -> only the named suites
// PostgreSQL suites are not run here: they skip themselves unless their
// *_TEST_DATABASE_URL variable is set (see docs/TESTING.md).
import { spawn } from 'node:child_process';
import { appendFileSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const TEST_ROOTS = ['models', 'services', 'controllers', 'hooks', 'i18n', 'scripts', 'supabase/functions/api'];
const SKIP_DIRS = new Set(['node_modules', '.git', '.expo']);
const NODE_TEST_IMPORT = /from\s+['"]node:test['"]/;
const ANSI = /\x1b\[[0-9;]*m/g;

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

const last = (text, regex) => {
  const matches = [...text.matchAll(regex)];
  return matches.length ? Number(matches[matches.length - 1][1]) : null;
};

const suites = {
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
    args: ['--test', ...nodeTests],
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

// Runners omit a counter when it is zero; show 0 once the suite reported any total.
const show = (value, parsed) => (value !== null ? String(value) : parsed ? '0' : '-');
const rows = results.map(({ suite, code, totals }) => {
  const parsed = Object.values(totals).some((value) => value !== null);
  return [
    suite.label,
    show(totals.passed, parsed),
    show(totals.failed, parsed),
    show(totals.skipped, parsed),
    code === 0 ? 'OK' : 'FALLÓ',
  ];
});
const header = ['Suite', 'Pasaron', 'Fallaron', 'Omitidos', 'Estado'];

const widths = header.map((title, i) => Math.max(title.length, ...rows.map((row) => row[i].length)));
const line = (cells) => cells.map((cell, i) => cell.padEnd(widths[i])).join('  ');
console.log('\n=== Resumen por suite ===\n');
console.log(line(header));
console.log(widths.map((width) => '-'.repeat(width)).join('  '));
rows.forEach((row) => console.log(line(row)));

if (process.env.GITHUB_STEP_SUMMARY) {
  const table = [
    `| ${header.join(' | ')} |`,
    `|${header.map(() => '---').join('|')}|`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Resumen por suite\n\n${table}\n`);
}

process.exit(results.every(({ code }) => code === 0) ? 0 : 1);
