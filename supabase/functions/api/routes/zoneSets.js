import { Hono } from "hono";
import { createZoneController } from "../controllers/zoneController.js";
import { requireAuth } from "../middleware/auth.js";
import { presentError } from "../presenters/error.js";

function onlyPost(c, next) {
  if (c.req.method !== "POST") {
    c.header("Allow", "POST");
    return presentError(c, 405, "method_not_allowed", "Only POST is allowed.");
  }
  return next();
}

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

export const zoneRoutes = createZoneRoutes();
