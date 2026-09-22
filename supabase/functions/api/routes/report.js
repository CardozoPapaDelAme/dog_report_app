import { Hono } from "hono";

import { createReportController } from "../controllers/reportController.js";

const reportRoutes = new Hono();

reportRoutes.post("/reports", createReportController);
reportRoutes.post("/api/reports", createReportController);

export { reportRoutes };
