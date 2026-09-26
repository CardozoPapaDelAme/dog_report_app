import { Hono } from "hono";

import { createPhotoController } from "../controllers/photoController.js";

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

export const photoRoutes = createPhotoRoutes();
