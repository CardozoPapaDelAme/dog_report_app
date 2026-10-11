/**
 * @module models/associationSummary
 * Aggregates association report rows into per-day or per-month counts for the dashboard summary.
 */
import { associationDateText, validateAssociationDateRange } from './associationReport.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Splits `YYYY-MM-DD` into numeric `[year, month, day]`. */
function dayParts(day) {
  return day.split('-').map(Number);
}

/** Formats a local date as `YYYY-MM`. */
function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// GET /association/reports has already filtered these rows by accepted_at.
// Use local calendar dates, matching the date-only filters sent to the API.
/**
 * Counts rows by local `accepted_at` date; ranges of up to 31 days group by day, longer ones by month.
 * Empty buckets are included.
 * @param {Array<{accepted_at: string}>} rows
 * @param {string} fromDay - `YYYY-MM-DD`.
 * @param {string} toDay - `YYYY-MM-DD`.
 * @returns {{total: number, grouping: 'day' | 'month', buckets: Array<{key: string, count: number}>}}
 * @throws {RangeError} When the date range is invalid.
 */
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
