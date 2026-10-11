/**
 * @module routes/configuration
 * Administrator configuration router. For both `/admin/configuration` and `/api/admin/configuration`
 * it registers `GET` (read) and `POST` (publish), role `administrator`; other methods get 405
 * `method_not_allowed` with an `Allow` header.
 */
import { Hono } from 'hono';
import { createConfigurationController } from '../controllers/configurationController.js';
import { requireAuth } from '../middleware/auth.js';
import { presentError } from '../presenters/error.js';

/**
 * Creates the configuration router.
 * @param {object} [options]
 * @param {ReturnType<typeof import('../services/configurationService.js').createConfigurationService>} [options.service]
 *   Configuration Service; the production instance when omitted.
 * @param {import('hono').MiddlewareHandler} [options.authorize] - Authorization middleware;
 *   defaults to `requireAuth('administrator')`.
 * @returns {import('hono').Hono}
 */
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

/** Production configuration router. */
export const configurationRoutes = createConfigurationRoutes();
