import { Hono } from "hono";

import { createPublicMapController } from "../controllers/publicMapController.js";
import { presentError } from "../presenters/error.js";

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

export const publicMapRoutes = createPublicMapRoutes();
