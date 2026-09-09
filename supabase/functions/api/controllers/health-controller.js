import { presentError } from '../presenters/error.js';
import { presentHealth } from '../presenters/health.js';
import { checkHealth } from '../services/health-service.js';

export async function getHealth(c) {
  try {
    const result = await checkHealth();
    return presentHealth(c, result);
  } catch {
    return presentError(c, 503, 'database_unavailable', 'Postgres is not reachable.');
  }
}
