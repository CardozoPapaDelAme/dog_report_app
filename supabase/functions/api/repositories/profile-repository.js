import { getSql } from '../infrastructure/db.js';

export async function findProfileById(userId) {
  const sql = getSql();
  return sql.begin(async (tx) => {
    await tx`SELECT set_config('app.user_id', ${userId}, true)`;
    const rows = await tx`
      SELECT id, role, active, display_name
      FROM public.profiles
      WHERE id = ${userId}
    `;
    return rows[0] ?? null;
  });
}
