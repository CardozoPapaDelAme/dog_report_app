/**
 * @module controllers/retentionController
 * HTTP adapter for the internal retention run, protected by the internal shared secret.
 */
import { presentError } from '../presenters/error.js';
import { presentRetentionResult } from '../presenters/retention.js';
import { runRetention } from '../services/retentionService.js';

/**
 * Accepts an empty body or an empty JSON object.
 * @param {string} raw - Raw request body.
 * @returns {boolean}
 */
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

/**
 * `POST /internal/retention/run`: responds 200 (or 207 when some photos failed), 400
 * `invalid_request`, or 503 `preflight_mismatch` / `dependency_unavailable`. Other errors are rethrown.
 * @param {import('hono').Context} c - Hono request context.
 * @returns {Promise<Response>}
 */
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
