import { Hono } from 'hono';

import {
  approveReport,
  deleteReport,
  getModerationQueue,
  hideReport,
  restoreReport,
} from '../controllers/moderationController.js';
import { requireAuth } from '../middleware/auth.js';

const moderationRoutes = new Hono();
const administratorOnly = requireAuth('administrator');

moderationRoutes.get('/admin/moderation-queue', administratorOnly, getModerationQueue);
moderationRoutes.get('/api/admin/moderation-queue', administratorOnly, getModerationQueue);
moderationRoutes.post('/admin/reports/:report_id/approve', administratorOnly, approveReport);
moderationRoutes.post('/api/admin/reports/:report_id/approve', administratorOnly, approveReport);
moderationRoutes.post('/admin/reports/:report_id/delete', administratorOnly, deleteReport);
moderationRoutes.post('/api/admin/reports/:report_id/delete', administratorOnly, deleteReport);
moderationRoutes.post('/admin/reports/:report_id/hide', administratorOnly, hideReport);
moderationRoutes.post('/api/admin/reports/:report_id/hide', administratorOnly, hideReport);
moderationRoutes.post('/admin/reports/:report_id/restore', administratorOnly, restoreReport);
moderationRoutes.post('/api/admin/reports/:report_id/restore', administratorOnly, restoreReport);

export { moderationRoutes };
