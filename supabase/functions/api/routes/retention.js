import { Hono } from 'hono';

import { runRetentionController } from '../controllers/retentionController.js';
import { requireInternalSecret } from '../middleware/internalAuth.js';

const retentionRoutes = new Hono();

retentionRoutes.post('/internal/retention/run', requireInternalSecret, runRetentionController);
retentionRoutes.post('/api/internal/retention/run', requireInternalSecret, runRetentionController);

export { retentionRoutes };
