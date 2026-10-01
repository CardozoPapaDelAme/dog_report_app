import { readAssociationReportPage } from '../models/associationReport.js';
import { apiRequest } from './apiClient.js';

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
