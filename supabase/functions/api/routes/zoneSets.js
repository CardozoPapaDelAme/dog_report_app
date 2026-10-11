/**
 * @module routes/zoneSets
 * Administrator zone set router (role `administrator`). For both `/admin/zone-sets` and the
 * `/admin/zoneSets` alias it registers `POST` (create) and `POST /:zone_set_id/activate`; other methods
 * get 405 `method_not_allowed` with an `Allow` header.
 */
import { Hono } from "hono";
import { createZoneController } from "../controllers/zoneController.js";
import { requireAuth } from "../middleware/auth.js";
import { presentError } from "../presenters/error.js";

/** Middleware that responds 405 `method_not_allowed` for any method other than POST. */
function onlyPost(c, next) {
  if (c.req.method !== "POST") {
    c.header("Allow", "POST");
    return presentError(c, 405, "method_not_allowed", "Only POST is allowed.");
  }
  return next();
}

/**
 * Creates the zone set router.
 * @param {object} [options]
 * @param {ReturnType<typeof import('../services/zoneService.js').createZoneService>} [options.service]
 *   Zone set Service; the production instance when omitted.
 * @param {import('hono').MiddlewareHandler} [options.authorize] - Authorization middleware;
 *   defaults to `requireAuth('administrator')`.
 * @returns {import('hono').Hono}
 */
export function createZoneRoutes(
  { service, authorize = requireAuth("administrator") } = {},
) {
  const routes = new Hono();
  const controller = createZoneController(service);
  // Keep the documented FAB-2 contract; the camelCase spelling shipped in main
  // remains an alias with the exact same authorization and command semantics.
  for (const path of ["/admin/zone-sets", "/admin/zoneSets"]) {
    routes.use(path, onlyPost);
    routes.use(`${path}/:zone_set_id/activate`, onlyPost);
    routes.post(path, authorize, controller.create);
    routes.post(`${path}/:zone_set_id/activate`, authorize, controller.activate);
  }
  return routes;
}

/** Production zone set router. */
export const zoneRoutes = createZoneRoutes();
