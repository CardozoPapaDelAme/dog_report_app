/**
 * @module routes/identityRoutes
 * Identity router. Registers `GET /me` (any authenticated role with an active profile).
 */
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { getCurrentProfileController } from '../controllers/identityController.js';

const identityRoutes = new Hono();

identityRoutes.get('/me', requireAuth(), getCurrentProfileController);

export { identityRoutes };