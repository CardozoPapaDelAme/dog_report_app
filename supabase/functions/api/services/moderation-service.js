import { getSql } from '../infrastructure/db.js';
import { listModerationQueue } from '../repositories/moderation-repository.js';

export async function listQueue({ actor, limit, cursor }) {
  const sql = getSql();
  return sql.begin(async (tx) => {
    await tx`SELECT set_config('app.user_id', ${actor.userId}, true)`;
    await tx`SELECT set_config('app.role', ${actor.role}, true)`;
    return listModerationQueue(tx, { limit, cursor });
  });
}
