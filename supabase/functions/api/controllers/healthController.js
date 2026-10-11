/**
 * @module controllers/healthController
 * HTTP adapter for the health check.
 */
import { presentError } from '../presenters/error.js';
import { presentHealth } from '../presenters/health.js';
import { checkHealth } from '../services/healthService.js';

/**
 * `GET /health`: responds 200 when the database answers, otherwise 503 `database_unavailable`.
 * @param {import('hono').Context} c - Hono request context.
 * @returns {Promise<Response>}
 */
export async function getHealth(c) {
  try {
    const result = await checkHealth();
    return presentHealth(c, result);
  } catch {
    return presentError(c, 503, 'database_unavailable', 'Postgres is not reachable.');
  }
}
