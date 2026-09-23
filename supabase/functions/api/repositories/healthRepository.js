import { getSql } from '../infrastructure/db.js';

export async function pingDatabase() {
  const sql = getSql();
  const rows = await sql`SELECT 1 AS ok`;
  return rows[0]?.ok === 1;
}
