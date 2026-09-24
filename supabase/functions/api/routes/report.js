import { Hono } from "hono";

import { flagController } from "../controllers/flag-controller.js";
import { createReportController } from "../controllers/reportController.js";

export function createReportRoutes(
  {
    createReportHandler = createReportController,
    flagHandler = flagController,
  } = {},
) {
  const routes = new Hono();

  routes.post("/reports", createReportHandler);
  routes.post("/api/reports", createReportHandler);
  routes.post("/reports/:report_id/flags", flagHandler);
  routes.post("/api/reports/:report_id/flags", flagHandler);

  return routes;
}

const reportRoutes = createReportRoutes();

export { reportRoutes };
