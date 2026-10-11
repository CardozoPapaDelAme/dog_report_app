/**
 * @module services/configurationApi
 * Administrator client for `GET`/`POST /admin/configuration` (FAB-1). Responses are validated with
 * `models/configuration.js`.
 */
import { apiRequest } from './apiClient.js';
import { readConfigurationState } from '../models/configuration.js';

/** Parses the API envelope; throws on non-2xx with `code`, `status`, `details` and `requestId`. */
async function readResponse(response) {
  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const error = new Error(payload?.error?.message ?? 'Configuration request failed');
    error.code = payload?.error?.code ?? 'request_failed';
    error.status = response.status;
    // Preserve FAB-1 field errors instead of replacing them with a generic message.
    error.details = payload?.error?.details;
    error.requestId = payload?.error?.request_id ?? response.headers.get('X-Request-Id');
    throw error;
  }
  return readConfigurationState(payload?.data);
}
/** Builds the Bearer header; throws `authentication_required` (401) for a missing token. */
function authorization(accessToken) {
  if (typeof accessToken !== 'string' || !accessToken.trim()) {
    throw Object.assign(new Error('Administrator session required'), { code: 'authentication_required', status: 401 });
  }
  return { Authorization: `Bearer ${accessToken}` };
}
/**
 * Reads the active configuration.
 * @param {object} options
 * @param {string} options.accessToken - Administrator access token.
 * @param {typeof import('./apiClient.js').apiRequest} [request] - Injectable transport.
 * @returns {Promise<import('../models/configuration.js').ConfigurationState>}
 * @throws {Error} `authentication_required` (status 401) without a token; the API error `code`
 *   (default `request_failed`) on non-2xx; `invalid_response` for a malformed body; transport errors.
 */
export async function getConfiguration({ accessToken }, request = apiRequest) {
  return readResponse(await request('/admin/configuration', { headers: authorization(accessToken) }));
}
/**
 * Publishes a new configuration version.
 * @param {object} options
 * @param {string} options.accessToken - Administrator access token.
 * @param {object} options.input - Payload from `validateConfigurationDraft`.
 * @param {typeof import('./apiClient.js').apiRequest} [request] - Injectable transport.
 * @returns {Promise<import('../models/configuration.js').ConfigurationState>}
 * @throws {Error} Same errors as {@link getConfiguration}; field errors are kept in `details`.
 */
export async function publishConfiguration({ accessToken, input }, request = apiRequest) {
  return readResponse(await request('/admin/configuration', {
    method: 'POST', headers: authorization(accessToken), body: JSON.stringify(input),
  }));
}
