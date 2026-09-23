import { apiRequest } from './apiClient.js';
import { readConfigurationState } from '../models/configuration.js';

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
function authorization(accessToken) {
  if (typeof accessToken !== 'string' || !accessToken.trim()) {
    throw Object.assign(new Error('Administrator session required'), { code: 'authentication_required', status: 401 });
  }
  return { Authorization: `Bearer ${accessToken}` };
}
export async function getConfiguration({ accessToken }, request = apiRequest) {
  return readResponse(await request('/admin/configuration', { headers: authorization(accessToken) }));
}
export async function publishConfiguration({ accessToken, input }, request = apiRequest) {
  return readResponse(await request('/admin/configuration', {
    method: 'POST', headers: authorization(accessToken), body: JSON.stringify(input),
  }));
}
