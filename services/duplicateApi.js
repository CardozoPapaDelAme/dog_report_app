/**
 * @module services/duplicateApi
 * Administrator client for duplicate candidates and duplicate groups (FAB-3).
 */
import { apiRequest } from './apiClient.js';
import { readCandidateSnapshot, readDuplicateGroup, readDuplicateGroups } from '../models/duplicateCandidate.js';

/** Authenticated GET (or POST when `input` is given); returns `data` or throws the API error. */
async function call(path, {accessToken, input}, request) {
  if (typeof accessToken !== 'string' || !accessToken.trim()) throw Object.assign(new Error('Session required'), {code:'authentication_required',status:401});
  const response = await request(path, {
    headers:{Authorization:`Bearer ${accessToken}`},
    ...(input === undefined ? {} : {method:'POST',body:JSON.stringify(input)}),
  });
  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) throw Object.assign(new Error(payload?.error?.message ?? 'Duplicate request failed'), {
    code:payload?.error?.code ?? 'request_failed', status:response.status, details:payload?.error?.details,
    requestId:payload?.error?.request_id ?? response.headers.get('X-Request-Id'),
  });
  return payload?.data;
}
/**
 * @param {object} options
 * @param {string} options.accessToken - Administrator access token.
 * @param {typeof import('./apiClient.js').apiRequest} [request] - Injectable transport.
 * @returns {Promise<import('../models/duplicateCandidate.js').CandidateSnapshot>}
 * @throws {Error} `authentication_required` (401); the API error `code` (default `request_failed`)
 *   with `status`, `details`, `requestId`; `invalid_response` for a malformed snapshot.
 */
export async function getDuplicateCandidates(options, request = apiRequest) {
  return readCandidateSnapshot(await call('/admin/duplicate-candidates',options,request));
}
/**
 * @param {object} options
 * @param {string} options.accessToken - Administrator access token.
 * @param {typeof import('./apiClient.js').apiRequest} [request] - Injectable transport.
 * @returns {Promise<import('../models/duplicateCandidate.js').DuplicateGroup[]>} Active groups.
 * @throws {Error} Same errors as {@link getDuplicateCandidates}.
 */
export async function getDuplicateGroups(options, request = apiRequest) {
  return readDuplicateGroups(await call('/admin/duplicate-groups',options,request));
}
/**
 * Creates a duplicate group and checks that the server echoed the requested canonical report and members.
 * @param {object} options
 * @param {string} options.accessToken - Administrator access token.
 * @param {{canonical_report_id: string, report_ids: string[], note?: string}} options.input - From `validateResolution`.
 * @param {typeof import('./apiClient.js').apiRequest} [request] - Injectable transport.
 * @returns {Promise<import('../models/duplicateCandidate.js').DuplicateGroup>}
 * @throws {Error} Same errors as {@link getDuplicateCandidates}; `invalid_response` when the group does not match.
 */
export async function resolveDuplicateGroup(options, request = apiRequest) {
  const data = await call('/admin/duplicate-groups',options,request);
  const group = readDuplicateGroup(data?.duplicate_group);
  if (group.canonical_report_id !== options.input.canonical_report_id ||
      [...group.report_ids].sort().join() !== [...options.input.report_ids].sort().join()) {
    throw Object.assign(new Error('Resolution does not match request'), {code:'invalid_response'});
  }
  return group;
}
/**
 * Reverses an active duplicate group.
 * @param {object} options
 * @param {string} options.accessToken - Administrator access token.
 * @param {string} options.groupId - Group to reverse.
 * @param {{note: string}} options.input - Reversal body.
 * @param {typeof import('./apiClient.js').apiRequest} [request] - Injectable transport.
 * @returns {Promise<import('../models/duplicateCandidate.js').DuplicateGroup>} The group with status `reversed`.
 * @throws {Error} Same errors as {@link getDuplicateCandidates}; `invalid_response` for a different group id.
 */
export async function reverseDuplicateGroup(options, request = apiRequest) {
  const data = await call(`/admin/duplicate-groups/${encodeURIComponent(options.groupId)}/reverse`,options,request);
  const group = readDuplicateGroup(data?.duplicate_group, 'reversed');
  if (group.id !== options.groupId) throw Object.assign(new Error('Wrong group'), {code:'invalid_response'});
  return group;
}
