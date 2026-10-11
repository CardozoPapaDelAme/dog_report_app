/**
 * @module services/healthService
 * Liveness check of the API and its database.
 */
import { pingDatabase } from '../repositories/healthRepository.js';

/**
 * Pings the database.
 * @returns {Promise<{ok: true, database: 'up'}>}
 * @throws {Error} When the ping fails or returns an unexpected result.
 */
export async function checkHealth() {
  const database = await pingDatabase();
  if (!database) {
    throw new Error('database ping failed');
  }
  return { ok: true, database: 'up' };
}
