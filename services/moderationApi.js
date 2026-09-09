import { apiRequest } from './apiClient.js';

async function readResponse(response) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const error = new Error(payload.error?.message ?? 'Request failed');
    error.code = payload.error?.code ?? 'request_failed';
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

export async function getModerationQueue({ accessToken, cursor, limit = 20 }, request = apiRequest) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) {
    query.set('cursor', cursor);
  }
  const response = await request(`/admin/moderation-queue?${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return readResponse(response);
}

export async function runModerationCommand(
  { accessToken, reportId, command, note },
  request = apiRequest,
) {
  const response = await request(`/admin/reports/${reportId}/${command}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(note == null ? {} : { note }),
  });
  return readResponse(response);
}
