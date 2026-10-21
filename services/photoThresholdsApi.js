/**
 * @module services/photoThresholdsApi
 * Anonymous client for `GET /public/photo-validation`. The payload is validated with
 * `models/photoThresholds.js`.
 */
import { readPhotoThresholds } from '../models/photoThresholds.js';
import { apiRequest } from './apiClient.js';

/**
 * @param {typeof import('./apiClient.js').apiRequest} [request] - Injectable transport.
 * @returns {Promise<{version: number, dogProbability: number}>}
 * @throws {Error} The API error (default `request_failed`), `invalid_response`, or a transport error.
 */
export async function getPhotoThresholds(request = apiRequest) {
  const response = await request('/public/photo-validation', { method: 'GET' });
  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    throw Object.assign(new Error(payload?.error?.message ?? 'Photo validation request failed'), {
      code: payload?.error?.code ?? 'request_failed',
      status: response.status,
    });
  }
  const thresholds = readPhotoThresholds(payload?.data);
  if (!thresholds) {
    throw Object.assign(new Error('Invalid photo validation response'), { code: 'invalid_response' });
  }
  return thresholds;
}
