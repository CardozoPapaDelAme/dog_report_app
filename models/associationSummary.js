import { associationDateText, validateAssociationDateRange } from './associationReport.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function dayParts(day) {
  return day.split('-').map(Number);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// GET /association/reports has already filtered these rows by accepted_at.
// Use local calendar dates, matching the date-only filters sent to the API.
export function buildAssociationSummary(rows, fromDay, toDay) {
  if (!validateAssociationDateRange(fromDay, toDay).range) {
    throw new RangeError('Invalid association summary range');
  }
  const [fromYear, fromMonth, fromDate] = dayParts(fromDay);
  const [toYear, toMonth, toDate] = dayParts(toDay);
  const days = 1 + (Date.UTC(toYear, toMonth - 1, toDate) - Date.UTC(fromYear, fromMonth - 1, fromDate)) / DAY_MS;
  const grouping = days <= 31 ? 'day' : 'month';
  const end = new Date(toYear, toMonth - 1, toDate);
  const current = new Date(fromYear, fromMonth - 1, grouping === 'day' ? fromDate : 1);
  const buckets = [];

  while (current <= end) {
    buckets.push({ key: grouping === 'day' ? associationDateText(current) : monthKey(current), count: 0 });
    if (grouping === 'day') current.setDate(current.getDate() + 1);
    else current.setMonth(current.getMonth() + 1);
  }

  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const report of rows) {
    const accepted = new Date(report.accepted_at);
    const key = grouping === 'day' ? associationDateText(accepted) : monthKey(accepted);
    const bucket = byKey.get(key);
    if (bucket) bucket.count += 1;
  }
  return { total: rows.length, grouping, buckets };
}
