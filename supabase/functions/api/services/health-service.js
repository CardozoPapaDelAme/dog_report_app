import { pingDatabase } from '../repositories/health-repository.js';

export async function checkHealth() {
  const database = await pingDatabase();
  if (!database) {
    throw new Error('database ping failed');
  }
  return { ok: true, database: 'up' };
}
