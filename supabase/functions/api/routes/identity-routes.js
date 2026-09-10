import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { getCurrentProfileController } from '../controllers/identity-controller.js';

const identityRoutes = new Hono();

identityRoutes.get('/me', requireAuth(), getCurrentProfileController);

export { identityRoutes };