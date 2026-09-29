import { apiRequest } from './apiClient.js';
import { readZoneSet } from '../models/zoneSet.js';

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
export function createZoneSet(options, request = apiRequest) {
  return command('/admin/zone-sets', options, { status: 'draft', checksum: options.input.source_sha256, environment: options.environment }, request);
}
export function activateZoneSet(options, request = apiRequest) {
  return command(`/admin/zone-sets/${encodeURIComponent(options.id)}/activate`, options,
    { status: 'active', id: options.id, checksum: options.checksum, environment: options.environment }, request);
}
