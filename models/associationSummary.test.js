import { buildAssociationSummary } from './associationSummary.js';

function assert(value, message = 'Assertion failed') { if (!value) throw new Error(message); }

function acceptedAt(year, month, day) {
  return new Date(year, month - 1, day, 12).toISOString();
}

Deno.test('RIC-5 summary: complete accepted rows form daily buckets, including zero days', () => {
  const rows = [
    { accepted_at: acceptedAt(2026, 9, 2), occurred_at: acceptedAt(2026, 8, 15) },
    { accepted_at: acceptedAt(2026, 9, 2), occurred_at: acceptedAt(2026, 8, 16) },
    { accepted_at: acceptedAt(2026, 9, 3), occurred_at: acceptedAt(2026, 8, 17) },
  ];
  const summary = buildAssociationSummary(rows, '2026-09-01', '2026-09-03');
  assert(summary.total === 3 && summary.grouping === 'day');
  assert(JSON.stringify(summary.buckets) === JSON.stringify([
    { key: '2026-09-01', count: 0 },
    { key: '2026-09-02', count: 2 },
    { key: '2026-09-03', count: 1 },
  ]));
});

Deno.test('RIC-5 summary: 31-day cutoff stays daily; longer ranges group by month', () => {
  const rows = [
    { accepted_at: acceptedAt(2026, 9, 30) },
    { accepted_at: acceptedAt(2026, 10, 1) },
  ];
  const daily = buildAssociationSummary(rows, '2026-09-01', '2026-10-01');
  assert(daily.grouping === 'day' && daily.buckets.length === 31);
  const monthly = buildAssociationSummary(rows, '2026-09-01', '2026-10-02');
  assert(monthly.grouping === 'month');
  assert(JSON.stringify(monthly.buckets) === JSON.stringify([
    { key: '2026-09', count: 1 }, { key: '2026-10', count: 1 },
  ]));
  assert(monthly.buckets.reduce((sum, bucket) => sum + bucket.count, 0) === monthly.total);
});
