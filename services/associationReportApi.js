/**
 * @module services/associationReportApi
 * Association client for `GET /association/reports` (RIC-2), one cursor page at a time.
 */
import { readAssociationReportPage } from '../models/associationReport.js';
import { apiRequest } from './apiClient.js';

/**
 * @param {object} options
 * @param {string} options.accessToken - Association access token.
 * @param {string} options.from - Inclusive ISO 8601 start instant.
 * @param {string} options.to - Inclusive ISO 8601 end instant.
 * @param {string | null} [options.cursor=null] - Cursor from the previous page.
 * @param {number} [options.limit=500] - Page size, 1 to 5000.
 * @param {typeof import('./apiClient.js').apiRequest} [request] - Injectable transport.
 * @returns {Promise<import('../models/associationReport.js').AssociationReportPage>}
 * @throws {Error} `authentication_required` (401) without a token; the API error `code` (default
 *   `request_failed`) with `status` and `requestId`; `invalid_response` for a malformed page.
 * @throws {RangeError} When `limit` is out of range.
 */
export async function getAssociationReportsPage({ accessToken, from, to, cursor = null, limit = 500 }, request = apiRequest) {
  if (typeof accessToken !== 'string' || !accessToken.trim()) {
    throw Object.assign(new Error('Association session required'), { code: 'authentication_required', status: 401 });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 5000) throw new RangeError('limit must be between 1 and 5000');
  const query = new URLSearchParams({ from, to, limit: String(limit) });
  if (cursor) query.set('cursor', cursor);
  const response = await request(`/association/reports?${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    throw Object.assign(new Error(payload?.error?.message ?? 'Association reports request failed'), {
      code: payload?.error?.code ?? 'request_failed',
      status: response.status,
      requestId: payload?.error?.request_id ?? response.headers.get('X-Request-Id'),
    });
  }
  return readAssociationReportPage(payload?.data);
}
