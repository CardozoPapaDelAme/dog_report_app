/**
 * @module models/moderation
 * Client-side helpers for the administrator moderation queue: report normalization, page summary and
 * applying command results.
 */
const HIGH_SEVERITY = new Set(['ataque_humano', 'ataque_ganado', 'ataque_mascota']);
const QUEUE_STATUSES = new Set(['pending_review', 'hidden']);

/**
 * Adds display fields to a queue report: `description`, `flagCount`, `duplicateCount`, `isHighSeverity`.
 * @param {object} report - Queue item from the API.
 * @returns {object}
 */
export function normalizeModerationReport(report) {
  return {
    ...report,
    description: report.details?.descripcion ?? report.details?.description ?? '',
    flagCount: Array.isArray(report.flags) ? report.flags.length : 0,
    duplicateCount: Array.isArray(report.pending_duplicate_candidates)
      ? report.pending_duplicate_candidates.length
      : 0,
    isHighSeverity: HIGH_SEVERITY.has(report.incident_type),
  };
}

/**
 * @param {object[]} reports - Normalized reports.
 * @returns {{total: number, flagged: number, urgent: number}}
 */
export function summarizeModerationPage(reports) {
  return reports.reduce(
    (summary, report) => ({
      total: summary.total + 1,
      flagged: summary.flagged + (report.flagCount > 0 ? 1 : 0),
      urgent: summary.urgent + (report.isHighSeverity ? 1 : 0),
    }),
    { total: 0, flagged: 0, urgent: 0 },
  );
}

/**
 * Removes the report when its new status leaves the queue, otherwise merges the result into it.
 * @param {object[]} reports - Normalized reports.
 * @param {string} reportId
 * @param {{status: string}} result - Moderation command result.
 * @returns {object[]}
 */
export function applyModerationResult(reports, reportId, result) {
  if (!QUEUE_STATUSES.has(result.status)) {
    return reports.filter((report) => report.id !== reportId);
  }
  return reports.map((report) =>
    report.id === reportId
      ? normalizeModerationReport({ ...report, ...result, id: reportId })
      : report
  );
}

/**
 * @param {string | number | Date | null | undefined} value
 * @param {string} [locale='es-MX']
 * @returns {string} Short day, month and time, or `''` when missing or invalid.
 */
export function formatObservedAt(value, locale = 'es-MX') {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
