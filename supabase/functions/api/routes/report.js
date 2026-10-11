/**
 * @module routes/report
 * Anonymous report router. Registers `POST /reports` and `POST /reports/:report_id/flags`, each with
 * and without the `/api` prefix.
 */
import { Hono } from "hono";

import { flagController } from "../controllers/flag-controller.js";
import { createReportController } from "../controllers/reportController.js";

/**
 * Creates the report router.
 * @param {object} [options]
 * @param {(c: import('hono').Context) => Promise<Response>} [options.createReportHandler] - Report
 *   submission handler; defaults to `createReportController`.
 * @param {(c: import('hono').Context) => Promise<Response>} [options.flagHandler] - Flag handler;
 *   defaults to `flagController`.
 * @returns {import('hono').Hono}
 */
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
