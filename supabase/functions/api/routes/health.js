import { Hono } from 'hono';

import { getHealth } from '../controllers/healthController.js';

const healthRoutes = new Hono();

healthRoutes.get('/health', getHealth);
healthRoutes.get('/api/health', getHealth);

export { healthRoutes };
