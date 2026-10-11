/**
 * @module services/zoneSetApi
 * Administrator client for zone set commands (FAB-2): create a draft and activate it. Responses are
 * checked against the expected status, id, checksum and environment.
 */
import { apiRequest } from './apiClient.js';
import { readZoneSet } from '../models/zoneSet.js';

/** POSTs an authenticated zone command and validates the returned zone set against `expected`. */
async function command(path, { accessToken, input }, expected, request) {
  if (typeof accessToken !== 'string' || !accessToken.trim()) {
    throw Object.assign(new Error('Administrator session required'), { code: 'authentication_required', status: 401 });
  }
  const response = await request(path, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(input),
  });
  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    throw Object.assign(new Error(payload?.error?.message ?? 'Zone request failed'), {
      code: payload?.error?.code ?? 'request_failed', status: response.status,
      details: payload?.error?.details, requestId: payload?.error?.request_id ?? response.headers.get('X-Request-Id'),
    });
  }
  return readZoneSet(payload?.data, expected);
}
/**
 * Creates a draft zone set.
 * @param {object} options
 * @param {string} options.accessToken - Administrator access token.
 * @param {object} options.input - Payload from `validateZoneDraft` (includes `source_sha256`).
 * @param {string} [options.environment] - Expected environment of the created zone set.
 * @param {typeof import('./apiClient.js').apiRequest} [request] - Injectable transport.
 * @returns {Promise<import('../models/zoneSet.js').ZoneSet>}
 * @throws {Error} `authentication_required` (401) without a token; the API error `code` (default
 *   `request_failed`) with `status`, `details`, `requestId`; `invalid_response` when the result does not match.
 */
export function createZoneSet(options, request = apiRequest) {
  return command('/admin/zone-sets', options, { status: 'draft', checksum: options.input.source_sha256, environment: options.environment }, request);
}
/**
 * Activates a draft zone set.
 * @param {object} options
 * @param {string} options.accessToken - Administrator access token.
 * @param {string} options.id - Zone set id.
 * @param {string} [options.checksum] - Expected `source_sha256`.
 * @param {string} [options.environment] - Expected environment.
 * @param {{association_approval_reference: string}} options.input - Activation body.
 * @param {typeof import('./apiClient.js').apiRequest} [request] - Injectable transport.
 * @returns {Promise<import('../models/zoneSet.js').ZoneSet>}
 * @throws {Error} Same errors as {@link createZoneSet}.
 */
export function activateZoneSet(options, request = apiRequest) {
  return command(`/admin/zone-sets/${encodeURIComponent(options.id)}/activate`, options,
    { status: 'active', id: options.id, checksum: options.checksum, environment: options.environment }, request);
}
