import { Hono } from 'hono';
import { createConfigurationController } from '../controllers/configuration-controller.js';
import { requireAuth } from '../middleware/auth.js';
import { presentError } from '../presenters/error.js';

export function createConfigurationRoutes({ service, authorize = requireAuth('administrator') } = {}) {
  const routes = new Hono();
  const controller = createConfigurationController(service);
  // Match the existing local and managed Edge Function path conventions.
  for (const path of ['/admin/configuration', '/api/admin/configuration']) {
    routes.use(path, async (c, next) => {
      if (!['GET', 'POST'].includes(c.req.method)) {
        c.header('Allow', 'GET, POST');
        return presentError(c, 405, 'method_not_allowed', 'Only GET and POST are allowed.');
      }
      await next();
    });
    routes.get(path, authorize, controller.read);
    routes.post(path, authorize, controller.publish);
  }
  return routes;
}

export const configurationRoutes = createConfigurationRoutes();
