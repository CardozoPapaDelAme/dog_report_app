import { MAX_ZOOM, MIN_ZOOM, readClusters, readPublicReports, viewportToQuery } from '../models/publicMap.js';
import { apiRequest } from './apiClient.js';

export const CLUSTER_LIMIT_MAX = 5000;
export const REPORT_LIMIT_MAX = 1000;
const RFC3339_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function invalidInput(message) {
  return Object.assign(new RangeError(message), { code: 'invalid_request' });
}

function checkLimit(limit, max) {
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > max)) {
    throw invalidInput(`limit must be between 1 and ${max}`);
  }
}

async function fetchData(path, request) {
  const response = await request(path, { method: 'GET' });
  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    throw Object.assign(new Error(payload?.error?.message ?? 'Public map request failed'), {
      code: payload?.error?.code ?? 'request_failed',
      status: response.status,
      requestId: payload?.error?.request_id ?? response.headers?.get?.('X-Request-Id') ?? null,
    });
  }
  return payload?.data;
}

export async function getPublicClusters({ zoom, viewport, limit } = {}, request = apiRequest) {
  if (!Number.isInteger(zoom) || zoom < MIN_ZOOM || zoom > MAX_ZOOM) {
    throw invalidInput(`zoom must be an integer from ${MIN_ZOOM} to ${MAX_ZOOM}`);
  }
  checkLimit(limit, CLUSTER_LIMIT_MAX);
  const query = new URLSearchParams({ zoom: String(zoom), ...viewportToQuery(viewport) });
  if (limit !== undefined) query.set('limit', String(limit));
  return readClusters(await fetchData(`/public/clusters?${query}`, request));
}

export async function getPublicReports({ since, limit } = {}, request = apiRequest) {
  if (since !== undefined && since !== null && (typeof since !== 'string' || !RFC3339_WITH_ZONE.test(since)
    || Number.isNaN(Date.parse(since)))) {
    throw invalidInput('since must be an RFC 3339 timestamp with a timezone');
  }
  checkLimit(limit, REPORT_LIMIT_MAX);
  const query = new URLSearchParams();
  if (since) query.set('since', since);
  if (limit !== undefined) query.set('limit', String(limit));
  const suffix = query.size ? `?${query}` : '';
  return readPublicReports(await fetchData(`/public/reports${suffix}`, request));
}
