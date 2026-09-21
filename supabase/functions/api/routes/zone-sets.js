import { Hono } from 'hono';
import { createZoneController } from '../controllers/zone-controller.js';
import { requireAuth } from '../middleware/auth.js';
import { presentError } from '../presenters/error.js';

function onlyPost(c, next) {
  if (c.req.method !== 'POST') {
    c.header('Allow', 'POST');
    return presentError(c, 405, 'method_not_allowed', 'Only POST is allowed.');
  }
  return next();
}

export function createZoneRoutes({ service, authorize = requireAuth('administrator') } = {}) {
  const routes = new Hono();
  const controller = createZoneController(service);
  routes.use('/admin/zone-sets', onlyPost);
  routes.use('/admin/zone-sets/:zone_set_id/activate', onlyPost);
  routes.post('/admin/zone-sets', authorize, controller.create);
  routes.post('/admin/zone-sets/:zone_set_id/activate', authorize, controller.activate);
  return routes;
}

export const zoneRoutes = createZoneRoutes();
