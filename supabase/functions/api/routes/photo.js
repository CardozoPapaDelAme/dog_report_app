/**
 * @module routes/photo
 * Report photo router; each route is registered with and without the `/api` prefix.
 * - `GET /reports/:report_id/photo-status` and `POST /reports/:report_id/photo`: anonymous reporter,
 *   identified by `X-Device-Fingerprint`.
 * - `GET /reports/:report_id/photo`: anonymous or authenticated; the photo Service authorizes access
 *   based on the caller from the global `optionalAuth`.
 */
import { Hono } from "hono";

import { createPhotoController } from "../controllers/photoController.js";

/**
 * Creates the photo router.
 * @param {object} [options]
 * @param {ReturnType<typeof import('../services/photoService.js').createPhotoService>} [options.service]
 *   Photo Service; the production instance when omitted.
 * @returns {import('hono').Hono}
 */
export function createPhotoRoutes({ service } = {}) {
  const routes = new Hono();
  const controller = createPhotoController(service);

  routes.get("/reports/:report_id/photo-status", controller.status);
  routes.get("/api/reports/:report_id/photo-status", controller.status);
  routes.post("/reports/:report_id/photo", controller.upload);
  routes.post("/api/reports/:report_id/photo", controller.upload);
  routes.get("/reports/:report_id/photo", controller.download);
  routes.get("/api/reports/:report_id/photo", controller.download);

  return routes;
}

/** Production photo router. */
export const photoRoutes = createPhotoRoutes();
