import { Hono } from 'hono';

import { getModerationQueue } from '../controllers/moderation-controller.js';
import { requireAuth } from '../middleware/auth.js';

const moderationRoutes = new Hono();
const administratorOnly = requireAuth('administrator');

moderationRoutes.get('/admin/moderation-queue', administratorOnly, getModerationQueue);
moderationRoutes.get('/api/admin/moderation-queue', administratorOnly, getModerationQueue);

export { moderationRoutes };
