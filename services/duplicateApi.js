import { apiRequest } from './apiClient.js';
import { readCandidateSnapshot, readDuplicateGroup, readDuplicateGroups } from '../models/duplicateCandidate.js';

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
export async function getDuplicateCandidates(options, request = apiRequest) {
  return readCandidateSnapshot(await call('/admin/duplicate-candidates',options,request));
}
export async function getDuplicateGroups(options, request = apiRequest) {
  return readDuplicateGroups(await call('/admin/duplicate-groups',options,request));
}
export async function resolveDuplicateGroup(options, request = apiRequest) {
  const data = await call('/admin/duplicate-groups',options,request);
  const group = readDuplicateGroup(data?.duplicate_group);
  if (group.canonical_report_id !== options.input.canonical_report_id ||
      [...group.report_ids].sort().join() !== [...options.input.report_ids].sort().join()) {
    throw Object.assign(new Error('Resolution does not match request'), {code:'invalid_response'});
  }
  return group;
}
export async function reverseDuplicateGroup(options, request = apiRequest) {
  const data = await call(`/admin/duplicate-groups/${encodeURIComponent(options.groupId)}/reverse`,options,request);
  const group = readDuplicateGroup(data?.duplicate_group, 'reversed');
  if (group.id !== options.groupId) throw Object.assign(new Error('Wrong group'), {code:'invalid_response'});
  return group;
}
