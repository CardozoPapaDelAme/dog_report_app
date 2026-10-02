import { apiRequest } from './apiClient.js';
import { FLAG_DETAIL_MAX, FLAG_REASONS, flagDetailLength } from '../models/reportFlag.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function readEnvelope(response, fallbackMessage) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.error?.message ?? fallbackMessage);
    error.code = payload?.error?.code ?? 'request_failed';
    error.status = response.status;
    error.details = payload?.error?.details;
    error.requestId = payload?.error?.request_id ?? response.headers.get('X-Request-Id');
    const retryAfter = Number(response.headers.get('Retry-After'));
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      error.retryAfterSeconds = retryAfter;
    }
    throw error;
  }

  return payload?.data;
}

function invalidInput(message) {
  return Object.assign(new RangeError(message), { code: 'invalid_request', status: 400 });
}

// Anonymous command: no Authorization header; the fingerprint travels in the BODY (unlike report submission).
export async function submitReportFlag(
  { reportId, reason, detail, deviceFingerprint } = {},
  request = apiRequest,
) {
  if (typeof reportId !== 'string' || !UUID_PATTERN.test(reportId)) throw invalidInput('reportId must be a lowercase UUID');
  if (!FLAG_REASONS.includes(reason)) throw invalidInput('reason is not supported');
  if (detail !== undefined && detail !== null && typeof detail !== 'string') throw invalidInput('detail must be a string');
  const trimmed = typeof detail === 'string' ? detail.trim() : '';
  if (flagDetailLength(trimmed) > FLAG_DETAIL_MAX) throw invalidInput(`detail must be at most ${FLAG_DETAIL_MAX} characters`);
  if (typeof deviceFingerprint !== 'string' || deviceFingerprint.length < 16) {
    throw Object.assign(new Error('device_fingerprint_required'), { code: 'invalid_device_fingerprint', status: 400 });
  }

  const body = { reason, device_fingerprint: deviceFingerprint };
  if (trimmed) body.detail = trimmed;

  const response = await request(`/reports/${reportId}/flags`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = await readEnvelope(response, 'Flag submission failed');
  if (!data || typeof data.flag_id !== 'string') {
    throw Object.assign(new Error('Flag response is malformed'), { code: 'invalid_response', status: null });
  }
  return { flagId: data.flag_id, reportStatus: data.report_status };
}
