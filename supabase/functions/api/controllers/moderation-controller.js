import { presentError } from '../presenters/error.js';
import { presentModerationQueue } from '../presenters/moderation.js';
import { listQueue } from '../services/moderation-service.js';

function parseLimit(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return 50;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 500) {
    return null;
  }
  return value;
}

function parseCursor(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  try {
    const normalized = String(raw).replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const decoded = atob(padded);
    const separator = decoded.lastIndexOf('|');
    if (separator <= 0) {
      return undefined;
    }
    const syncedAt = decoded.slice(0, separator);
    const id = decoded.slice(separator + 1);
    if (!syncedAt || !/^[0-9a-f-]{36}$/i.test(id)) {
      return undefined;
    }
    return { syncedAt, id };
  } catch {
    return undefined;
  }
}

export async function getModerationQueue(c) {
  const limit = parseLimit(c.req.query('limit'));
  if (limit === null) {
    return presentError(c, 400, 'invalid_request', 'limit must be an integer from 1 to 500.');
  }
  const cursor = parseCursor(c.req.query('cursor'));
  if (cursor === undefined) {
    return presentError(c, 400, 'invalid_request', 'cursor is malformed.');
  }

  try {
    const rows = await listQueue({
      actor: c.get('auth'),
      limit,
      cursor,
    });
    return presentModerationQueue(c, rows, limit);
  } catch {
    return presentError(c, 503, 'database_unavailable', 'Postgres is not reachable.');
  }
}
