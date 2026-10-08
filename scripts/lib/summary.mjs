// Per-suite summary table shared by scripts/test-all.mjs and scripts/test-postgres.mjs.
import { appendFileSync } from 'node:fs';

const HEADER = ['Suite', 'Pasaron', 'Fallaron', 'Omitidos', 'Estado'];

export const ANSI = /\x1b\[[0-9;]*m/g;

// Last number captured by `regex` in `text`, or null when the runner did not print it.
export function lastNumber(text, regex) {
  const matches = [...text.matchAll(regex)];
  return matches.length ? Number(matches[matches.length - 1][1]) : null;
}

// Runners omit a counter when it is zero; show 0 once the suite reported any total.
export function summaryRow(label, totals, code) {
  const parsed = Object.values(totals).some((value) => value !== null);
  const show = (value) => (value !== null ? String(value) : parsed ? '0' : '-');
  return [label, show(totals.passed), show(totals.failed), show(totals.skipped), code === 0 ? 'OK' : 'FALLÓ'];
}

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
