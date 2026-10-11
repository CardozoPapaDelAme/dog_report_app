/**
 * Per-suite result summary helpers for the test runner scripts.
 *
 * Imported by `scripts/test-all.mjs` and `scripts/test-postgres.mjs`; not invoked directly.
 * Reads the `GITHUB_STEP_SUMMARY` environment variable when present.
 *
 * @module scripts/lib/summary
 */
// Per-suite summary table shared by scripts/test-all.mjs and scripts/test-postgres.mjs.
import { appendFileSync } from 'node:fs';

const HEADER = ['Suite', 'Pasaron', 'Fallaron', 'Omitidos', 'Estado'];

/**
 * Matches ANSI color/style escape sequences so runner output can be parsed as plain text.
 *
 * @type {RegExp}
 */
export const ANSI = /\x1b\[[0-9;]*m/g;

// Last number captured by `regex` in `text`, or null when the runner did not print it.
/**
 * @param {string} text Runner output with ANSI sequences already removed.
 * @param {RegExp} regex Global pattern whose first capture group is a number.
 * @returns {number|null} The last captured number, or `null` when there is no match.
 */
export function lastNumber(text, regex) {
  const matches = [...text.matchAll(regex)];
  return matches.length ? Number(matches[matches.length - 1][1]) : null;
}

// Runners omit a counter when it is zero; show 0 once the suite reported any total.
/**
 * Builds one summary table row for a suite.
 *
 * @param {string} label Human-readable suite name.
 * @param {{passed: number|null, failed: number|null, skipped: number|null}} totals Parsed counters.
 * @param {number} code Exit code of the suite process (`0` means success).
 * @returns {string[]} Cells: label, passed, failed, skipped and status (`OK` or `FALLÓ`).
 */
export function summaryRow(label, totals, code) {
  const parsed = Object.values(totals).some((value) => value !== null);
  const show = (value) => (value !== null ? String(value) : parsed ? '0' : '-');
  return [label, show(totals.passed), show(totals.failed), show(totals.skipped), code === 0 ? 'OK' : 'FALLÓ'];
}

/**
 * Prints the summary table to stdout and, when `GITHUB_STEP_SUMMARY` is set,
 * appends it as a Markdown table to that file.
 *
 * @param {string[][]} rows Rows produced by {@link summaryRow}.
 * @param {string} [title='Resumen por suite'] Table heading.
 * @returns {void}
 */
export function printSummary(rows, title = 'Resumen por suite') {
  const widths = HEADER.map((cell, i) => Math.max(cell.length, ...rows.map((row) => row[i].length)));
  const line = (cells) => cells.map((cell, i) => cell.padEnd(widths[i])).join('  ');
  console.log(`\n=== ${title} ===\n`);
  console.log(line(HEADER));
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));
  rows.forEach((row) => console.log(line(row)));

  if (process.env.GITHUB_STEP_SUMMARY) {
    const table = [
      `| ${HEADER.join(' | ')} |`,
      `|${HEADER.map(() => '---').join('|')}|`,
      ...rows.map((row) => `| ${row.join(' | ')} |`),
    ].join('\n');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## ${title}\n\n${table}\n`);
  }
}
