/**
 * @module repositories/healthRepository
 * Database liveness probe used by the health route.
 */
import { getSql } from '../infrastructure/db.js';

/**
 * Runs `SELECT 1` on the shared client.
 * @returns {Promise<boolean>} True when the database answered as expected.
 */
export async function pingDatabase() {
  const sql = getSql();
  const rows = await sql`SELECT 1 AS ok`;
  return rows[0]?.ok === 1;
}
