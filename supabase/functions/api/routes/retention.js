/**
 * @module routes/retention
 * Internal retention router. Registers `POST /internal/retention/run` and
 * `POST /api/internal/retention/run`, protected by the internal shared secret (no user role).
 */
import { Hono } from 'hono';

import { runRetentionController } from '../controllers/retentionController.js';
import { requireInternalSecret } from '../middleware/internalAuth.js';

const retentionRoutes = new Hono();

retentionRoutes.post('/internal/retention/run', requireInternalSecret, runRetentionController);
retentionRoutes.post('/api/internal/retention/run', requireInternalSecret, runRetentionController);

export { retentionRoutes };
