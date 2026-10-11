/**
 * @module services/moderationApi
 * Administrator client for the moderation queue and report moderation commands.
 */
import { apiRequest } from './apiClient.js';

/** Returns `payload.data`; throws an Error with the API `code` (default `request_failed`) and `status` on non-2xx. */
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

/**
 * @param {object} options
 * @param {string} options.accessToken - Administrator access token.
 * @param {string} [options.cursor] - Cursor from the previous page.
 * @param {number} [options.limit=20] - Page size.
 * @param {typeof import('./apiClient.js').apiRequest} [request] - Injectable transport.
 * @returns {Promise<*>} The unvalidated queue page (`data` of the envelope).
 * @throws {Error} The API error `code` (default `request_failed`) with `status`; transport errors.
 */
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

/**
 * Runs `POST /admin/reports/{reportId}/{command}`.
 * @param {object} options
 * @param {string} options.accessToken - Administrator access token.
 * @param {string} options.reportId - Report id.
 * @param {string} options.command - Command path segment: `approve`, `hide`, `restore` or `delete`.
 * @param {string | null} [options.note] - Optional moderator note.
 * @param {typeof import('./apiClient.js').apiRequest} [request] - Injectable transport.
 * @returns {Promise<*>} The command result (`data` of the envelope).
 * @throws {Error} The API error `code` (default `request_failed`) with `status`; transport errors.
 */
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
