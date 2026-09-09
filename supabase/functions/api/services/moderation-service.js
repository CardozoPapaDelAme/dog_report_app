import { getSql } from '../infrastructure/db.js';
import { assertTransition } from '../domain/report-moderation.js';
import {
  approveReport,
  insertModerationAudit,
  listModerationQueue,
  lockReportForModeration,
} from '../repositories/moderation-repository.js';

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
  const sql = getSql();
  return sql.begin(async (tx) => {
    await tx`SELECT set_config('app.user_id', ${actor.userId}, true)`;
    await tx`SELECT set_config('app.role', ${actor.role}, true)`;
    return listModerationQueue(tx, { limit, cursor });
  });
}

export function approve({ actor, reportId, note }) {
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

    assertTransition('approve', current.status);
    const updated = await approveReport(tx, reportId);
    await insertModerationAudit(tx, {
      actorId: actor.userId,
      action: 'report_approved',
      reportId,
      previousValues: moderationValues(current),
      newValues: moderationValues(updated),
      note,
    });
    return updated;
  });
}
