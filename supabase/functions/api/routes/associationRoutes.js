/**
 * @module routes/associationRoutes
 * Association router (Hono API on Supabase Edge: routes -> Controllers -> Services -> Repositories).
 * Registers `GET /association/reports` (role `association`).
 */
import { Hono } from "hono";

import { getAssociationReports } from "../controllers/associationController.js";
import { requireAuth } from "../middleware/auth.js";

const associationRoutes = new Hono();

associationRoutes.get(
  "/association/reports",
  requireAuth("association"),
  getAssociationReports,
);

export { associationRoutes };
