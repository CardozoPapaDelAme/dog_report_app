import { Hono } from 'hono';

import { runRetentionController } from '../controllers/retention-controller.js';
import { requireInternalSecret } from '../middleware/internal-auth.js';

const retentionRoutes = new Hono();

retentionRoutes.post('/internal/retention/run', requireInternalSecret, runRetentionController);
retentionRoutes.post('/api/internal/retention/run', requireInternalSecret, runRetentionController);

export { retentionRoutes };
