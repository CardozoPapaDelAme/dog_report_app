const HIGH_SEVERITY = new Set(['ataque_humano', 'ataque_ganado', 'ataque_mascota']);
const QUEUE_STATUSES = new Set(['pending_review', 'hidden']);

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
