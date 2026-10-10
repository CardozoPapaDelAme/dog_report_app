import { getSql } from '../infrastructure/db.js';
import { assertTransition } from '../domain/reportModeration.js';
import {
  approveReport,
  deleteReport as persistDeletedReport,
  hideReportRow,
  insertModerationAudit,
  listModerationQueue,
  lockReportForModeration,
  restoreReportRow,
} from '../repositories/moderationRepository.js';

function authorizationError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

// ADR-019: the Service owns authorization, independently of the route
// middleware. Only an active Administrator whose loaded profile matches the
// token subject and role may read the queue or run a moderation command.
function assertAdministrator(actor) {
  if (actor?.type !== 'authenticated' || !actor.userId) {
    throw authorizationError('authentication_required');
  }
  if (
    actor.role !== 'administrator' || actor.profile?.active !== true ||
    actor.profile.id !== actor.userId || actor.profile.role !== actor.role
  ) {
    throw authorizationError('forbidden');
  }
}

function moderationValues(report) {
  return {
    status: report.status,
    status_reason: report.status_reason,
    previous_status: report.previous_status,
    accepted_at: report.accepted_at,
    published_at: report.published_at,
    public_until: report.public_until,
    hidden_at: report.hidden_at,
    deleted_at: report.deleted_at,
  };
}

export function listQueue({ actor, limit, cursor }) {
  assertAdministrator(actor);
  const sql = getSql();
  return sql.begin(async (tx) => {
    await tx`SELECT set_config('app.user_id', ${actor.userId}, true)`;
    await tx`SELECT set_config('app.role', ${actor.role}, true)`;
    return listModerationQueue(tx, { limit, cursor });
  });
}

export function approve({ actor, reportId, note }) {
  return executeTransition({
    actor,
    reportId,
    note,
    command: 'approve',
    action: 'report_approved',
    persist: approveReport,
  });
}

export function hide({ actor, reportId, note }) {
  return executeTransition({
    actor,
    reportId,
    note,
    command: 'hide',
    action: 'report_hidden',
    persist: hideReportRow,
  });
}

export function restore({ actor, reportId, note }) {
  return executeTransition({
    actor,
    reportId,
    note,
    command: 'restore',
    action: 'report_restored',
    persist: restoreReportRow,
  });
}

export function deleteReport({ actor, reportId, note }) {
  return executeTransition({
    actor,
    reportId,
    note,
    command: 'delete',
    action: 'report_logically_deleted',
    persist: persistDeletedReport,
  });
}

function executeTransition({ actor, reportId, note, command, action, persist }) {
  assertAdministrator(actor);
  const sql = getSql();
  return sql.begin(async (tx) => {
    await tx`SELECT set_config('app.user_id', ${actor.userId}, true)`;
    await tx`SELECT set_config('app.role', ${actor.role}, true)`;

    const current = await lockReportForModeration(tx, reportId);
    if (!current) {
      const error = new Error('report_not_found');
      error.code = 'not_found';
      throw error;
    }

    assertTransition(command, current.status);
    const updated = await persist(tx, reportId);
    await insertModerationAudit(tx, {
      actorId: actor.userId,
      action,
      reportId,
      previousValues: moderationValues(current),
      newValues: moderationValues(updated),
      note,
    });
    return updated;
  });
}
