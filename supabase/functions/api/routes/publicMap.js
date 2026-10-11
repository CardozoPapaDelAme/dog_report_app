/**
 * @module routes/publicMap
 * Anonymous public map router. Registers `GET /public/reports` and `GET /public/clusters`, each with and
 * without the `/api` prefix; other methods get 405 `method_not_allowed` with an `Allow` header.
 */
import { Hono } from "hono";

import { createPublicMapController } from "../controllers/publicMapController.js";
import { presentError } from "../presenters/error.js";

/**
 * Creates the public map router.
 * @param {object} [options]
 * @param {ReturnType<typeof import('../services/publicMapService.js').createPublicMapService>} [options.service]
 *   Public map Service; the production instance when omitted.
 * @returns {import('hono').Hono}
 */
export function createPublicMapRoutes({ service } = {}) {
  const routes = new Hono();
  const controller = createPublicMapController(service);

  for (
    const [path, handler] of [
      ["/public/reports", controller.reports],
      ["/api/public/reports", controller.reports],
      ["/public/clusters", controller.clusters],
      ["/api/public/clusters", controller.clusters],
    ]
  ) {
    routes.use(path, async (c, next) => {
      if (c.req.method !== "GET") {
        c.header("Allow", "GET");
        return presentError(
          c,
          405,
          "method_not_allowed",
          "Only GET is allowed.",
        );
      }
      await next();
    });
    routes.get(path, handler);
  }

  return routes;
}

/** Production public map router. */
export const publicMapRoutes = createPublicMapRoutes();
