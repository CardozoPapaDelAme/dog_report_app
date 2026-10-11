/**
 * @module controllers/moderationController
 * HTTP adapter for administrator moderation: the moderation queue and the approve, hide, restore, and
 * delete commands. The moderation Service owns authorization (ADR-019); this Controller maps its
 * errors to HTTP statuses.
 */
import { presentError } from '../presenters/error.js';
import {
  presentModerationCommand,
  presentModerationQueue,
} from '../presenters/moderation.js';
import {
  approve,
  deleteReport as deleteReportCommand,
  hide,
  listQueue,
  restore,
} from '../services/moderationService.js';

/** Maps `authentication_required` to 401 and `forbidden` to 403; returns null for other errors. */
function presentAuthorizationError(c, error) {
  if (error?.code === 'authentication_required') {
    return presentError(c, 401, 'authentication_required', 'A valid Administrator session is required.');
  }
  if (error?.code === 'forbidden') {
    return presentError(c, 403, 'forbidden', 'An active matching Administrator profile is required.');
  }
  return null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parses `limit` (default 50, 1 to 500); returns null when invalid. */
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

/** Decodes a base64url `<synced_at>|<uuid>` cursor; null when absent, undefined when malformed. */
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

/**
 * `GET /admin/moderation-queue`: responds 200 with a queue page, 400 `invalid_request`, 401, 403, or
 * 503 `database_unavailable` for any other failure.
 * @param {import('hono').Context} c - Hono request context.
 * @returns {Promise<Response>}
 */
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
  } catch (error) {
    const denied = presentAuthorizationError(c, error);
    if (denied) {
      return denied;
    }
    return presentError(c, 503, 'database_unavailable', 'Postgres is not reachable.');
  }
}

/**
 * Parses a body that may contain only `note` (string, at most 1000 characters; non-blank when required).
 * An empty body is accepted when the note is optional.
 * @returns {{ok: true, note: string | null} | {ok: false}}
 */
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

/**
 * Parses an approve body; the note is optional.
 * @param {string} raw - Raw request body.
 * @returns {{ok: true, note: string | null} | {ok: false}}
 */
export function parseApproveBody(raw) {
  return parseNoteBody(raw, false);
}

/**
 * Parses a delete body; a non-blank note is required.
 * @param {string} raw - Raw request body.
 * @returns {{ok: true, note: string} | {ok: false}}
 */
export function parseDeleteBody(raw) {
  return parseNoteBody(raw, true);
}

/**
 * Parses a hide body; a non-blank note is required.
 * @param {string} raw - Raw request body.
 * @returns {{ok: true, note: string} | {ok: false}}
 */
export function parseHideBody(raw) {
  return parseNoteBody(raw, true);
}

/**
 * Parses a restore body; a non-blank note is required.
 * @param {string} raw - Raw request body.
 * @returns {{ok: true, note: string} | {ok: false}}
 */
export function parseRestoreBody(raw) {
  return parseNoteBody(raw, true);
}

/**
 * `POST /admin/reports/:report_id/approve`: responds 200 with the updated report, 400
 * `invalid_request`, 401, 403, 404 `not_found`, or 409 `invalid_approve_transition`. Other errors are
 * rethrown.
 * @param {import('hono').Context} c - Hono request context.
 * @returns {Promise<Response>}
 */
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
    const denied = presentAuthorizationError(c, error);
    if (denied) {
      return denied;
    }
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

/**
 * `POST /admin/reports/:report_id/hide`: responds 200 with the updated report, 400 `invalid_request`,
 * 401, 403, 404 `not_found`, or 409 `invalid_hide_transition`. Other errors are rethrown.
 * @param {import('hono').Context} c - Hono request context.
 * @returns {Promise<Response>}
 */
export async function hideReport(c) {
  const reportId = c.req.param('report_id');
  if (!UUID_PATTERN.test(reportId)) {
    return presentError(c, 400, 'invalid_request', 'report_id must be a UUID.');
  }

  const body = parseHideBody(await c.req.text());
  if (!body.ok) {
    return presentError(c, 400, 'invalid_request', 'Body must contain a non-empty string note.');
  }

  try {
    const report = await hide({
      actor: c.get('auth'),
      reportId,
      note: body.note,
    });
    return presentModerationCommand(c, report);
  } catch (error) {
    const denied = presentAuthorizationError(c, error);
    if (denied) {
      return denied;
    }
    if (error?.code === 'not_found') {
      return presentError(c, 404, 'not_found', 'Report was not found.');
    }
    if (error?.code === 'invalid_hide_transition') {
      return presentError(
        c,
        409,
        'invalid_hide_transition',
        'The report cannot be hidden from its current state.',
      );
    }
    throw error;
  }
}

/**
 * `POST /admin/reports/:report_id/restore`: responds 200 with the updated report, 400
 * `invalid_request`, 401, 403, 404 `not_found`, or 409 `invalid_restore_transition`. Other errors are
 * rethrown.
 * @param {import('hono').Context} c - Hono request context.
 * @returns {Promise<Response>}
 */
export async function restoreReport(c) {
  const reportId = c.req.param('report_id');
  if (!UUID_PATTERN.test(reportId)) {
    return presentError(c, 400, 'invalid_request', 'report_id must be a UUID.');
  }

  const body = parseRestoreBody(await c.req.text());
  if (!body.ok) {
    return presentError(c, 400, 'invalid_request', 'Body must contain a non-empty string note.');
  }

  try {
    const report = await restore({
      actor: c.get('auth'),
      reportId,
      note: body.note,
    });
    return presentModerationCommand(c, report);
  } catch (error) {
    const denied = presentAuthorizationError(c, error);
    if (denied) {
      return denied;
    }
    if (error?.code === 'not_found') {
      return presentError(c, 404, 'not_found', 'Report was not found.');
    }
    if (error?.code === 'invalid_restore_transition') {
      return presentError(
        c,
        409,
        'invalid_restore_transition',
        'The report cannot be restored from its current state.',
      );
    }
    throw error;
  }
}

/**
 * `POST /admin/reports/:report_id/delete`: logically deletes a report. Responds 200 with the updated
 * report, 400 `invalid_request`, 401, 403, 404 `not_found`, or 409 `invalid_delete_transition`. Other
 * errors are rethrown.
 * @param {import('hono').Context} c - Hono request context.
 * @returns {Promise<Response>}
 */
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
    const denied = presentAuthorizationError(c, error);
    if (denied) {
      return denied;
    }
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
