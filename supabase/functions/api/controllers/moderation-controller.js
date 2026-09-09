import { presentError } from '../presenters/error.js';
import {
  presentModerationCommand,
  presentModerationQueue,
} from '../presenters/moderation.js';
import {
  approve,
  deleteReport as deleteReportCommand,
  listQueue,
} from '../services/moderation-service.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function parseNoteBody(raw, noteRequired) {
  if (!raw) {
    return noteRequired ? { ok: false } : { ok: true, note: null };
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false };
  }
  const keys = Object.keys(body);
  if (keys.some((key) => key !== 'note')) {
    return { ok: false };
  }
  if (body.note === undefined) {
    return noteRequired ? { ok: false } : { ok: true, note: null };
  }
  if (
    typeof body.note !== 'string' ||
    (noteRequired && body.note.trim().length === 0) ||
    body.note.length > 1000
  ) {
    return { ok: false };
  }
  return { ok: true, note: body.note };
}

export function parseApproveBody(raw) {
  return parseNoteBody(raw, false);
}

export function parseDeleteBody(raw) {
  return parseNoteBody(raw, true);
}

export async function approveReport(c) {
  const reportId = c.req.param('report_id');
  if (!UUID_PATTERN.test(reportId)) {
    return presentError(c, 400, 'invalid_request', 'report_id must be a UUID.');
  }

  const body = parseApproveBody(await c.req.text());
  if (!body.ok) {
    return presentError(c, 400, 'invalid_request', 'Body must contain only an optional string note.');
  }

  try {
    const report = await approve({
      actor: c.get('auth'),
      reportId,
      note: body.note,
    });
    return presentModerationCommand(c, report);
  } catch (error) {
    if (error?.code === 'not_found') {
      return presentError(c, 404, 'not_found', 'Report was not found.');
    }
    if (error?.code === 'invalid_approve_transition') {
      return presentError(
        c,
        409,
        'invalid_approve_transition',
        'The report cannot be approved from its current state.',
      );
    }
    throw error;
  }
}

export async function deleteReport(c) {
  const reportId = c.req.param('report_id');
  if (!UUID_PATTERN.test(reportId)) {
    return presentError(c, 400, 'invalid_request', 'report_id must be a UUID.');
  }

  const body = parseDeleteBody(await c.req.text());
  if (!body.ok) {
    return presentError(c, 400, 'invalid_request', 'Body must contain a non-empty string note.');
  }

  try {
    const report = await deleteReportCommand({
      actor: c.get('auth'),
      reportId,
      note: body.note,
    });
    return presentModerationCommand(c, report);
  } catch (error) {
    if (error?.code === 'not_found') {
      return presentError(c, 404, 'not_found', 'Report was not found.');
    }
    if (error?.code === 'invalid_delete_transition') {
      return presentError(
        c,
        409,
        'invalid_delete_transition',
        'The report cannot be deleted from its current state.',
      );
    }
    throw error;
  }
}
