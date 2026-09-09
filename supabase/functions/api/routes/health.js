import { Hono } from 'hono';

import { getHealth } from '../controllers/health-controller.js';

const healthRoutes = new Hono();

healthRoutes.get('/health', getHealth);
healthRoutes.get('/api/health', getHealth);

export { healthRoutes };
