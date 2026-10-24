/**
 * @module routes/photoValidation
 * Anonymous router for `GET /public/photo-validation`, with and without the `/api` prefix; other
 * methods get 405 `method_not_allowed` with an `Allow` header.
 */
import { Hono } from "hono";

import { createPhotoValidationController } from "../controllers/photoValidationController.js";
import { presentError } from "../presenters/error.js";

/**
 * Creates the photo validation router.
 * @param {object} [options]
 * @param {ReturnType<typeof import('../services/photoValidationService.js').createPhotoValidationService>} [options.service]
 * @returns {import('hono').Hono}
 */
export function createPhotoValidationRoutes({ service } = {}) {
  const routes = new Hono();
  const controller = createPhotoValidationController(service);

  for (const path of ["/public/photo-validation", "/api/public/photo-validation"]) {
    routes.use(path, async (c, next) => {
      if (c.req.method !== "GET") {
        c.header("Allow", "GET");
        return presentError(c, 405, "method_not_allowed", "Only GET is allowed.");
      }
      await next();
    });
    routes.get(path, controller.read);
  }
  return routes;
}

/** Production photo validation router. */
export const photoValidationRoutes = createPhotoValidationRoutes();
