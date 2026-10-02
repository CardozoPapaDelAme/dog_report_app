// Report flag ("denunciar") model: reasons, draft validation and neutral UI outcomes.
// Never exposes moderation state: a 201 is always just "submitted".

// Ordered as shown in the UI; values mirror the server (parity asserted in models/reportFlag.test.js).
export const FLAG_REASONS = Object.freeze([
  'foto_falsa', 'contenido_inapropiado', 'burla', 'no_es_callejero', 'incidental_pii', 'otro',
]);
export const FLAG_DETAIL_MAX = 1000;
export const FLAG_DEFAULT_RETRY_MINUTES = 60;

// The server enforces `detail.length` (UTF-16 units), so the client uses the same measure to never send a
// value the server would reject (astral characters such as emoji count as 2).
export function flagDetailLength(detail) {
  return typeof detail === 'string' ? detail.length : 0;
}

export function validateFlagDraft({ reason, detail } = {}) {
  const errors = {};
  if (!FLAG_REASONS.includes(reason)) errors.reason = 'required';
  if (detail !== undefined && detail !== null) {
    if (typeof detail !== 'string') errors.detail = 'invalid';
    else if (flagDetailLength(detail.trim()) > FLAG_DETAIL_MAX) errors.detail = 'too_long';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

// Accepts a thrown error (from submitReportFlag) or a successful result ({ flagId, reportStatus }).
export function flagOutcome(errorOrResult) {
  const value = errorOrResult;
  if (!(value instanceof Error) && !(value && typeof value === 'object' && ('code' in value || 'status' in value))) {
    return { key: 'submitted' };
  }
  const { code, status } = value;
  if (code === 'network_unavailable' || code === 'request_timeout') return { key: 'offline' };
  if (status === 409 && code === 'flag_already_submitted') return { key: 'already_flagged' };
  if (status === 404 && code === 'report_not_flaggable') return { key: 'not_flaggable' };
  if (status === 429) {
    const seconds = Number.isFinite(value.retryAfterSeconds) && value.retryAfterSeconds > 0
      ? value.retryAfterSeconds : FLAG_DEFAULT_RETRY_MINUTES * 60;
    return { key: 'rate_limited', retryAfterMinutes: Math.ceil(seconds / 60) };
  }
  if (status === 400) return { key: 'invalid' };
  return { key: 'unavailable' };
}
