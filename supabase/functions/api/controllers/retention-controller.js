import { presentError } from '../presenters/error.js';
import { presentRetentionResult } from '../presenters/retention.js';
import { runRetention } from '../services/retention-service.js';

export function validateRetentionBody(raw) {
  if (!raw) {
    return true;
  }
  try {
    const body = JSON.parse(raw);
    return Boolean(body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 0);
  } catch {
    return false;
  }
}

export async function runRetentionController(c) {
  if (!validateRetentionBody(await c.req.text())) {
    return presentError(c, 400, 'invalid_request', 'Retention accepts no request fields.');
  }

  try {
    return presentRetentionResult(c, await runRetention());
  } catch (error) {
    if (error?.code === 'preflight_mismatch') {
      return presentError(c, 503, 'preflight_mismatch', 'Retention preflight failed.');
    }
    if (error?.code === 'dependency_unavailable') {
      return presentError(c, 503, 'dependency_unavailable', 'A retention dependency is unavailable.');
    }
    throw error;
  }
}
