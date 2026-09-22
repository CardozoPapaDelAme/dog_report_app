import { Hono } from "hono";

import { associationRoutes } from "./associationRoutes.js";

Deno.test("GET /association/reports requires authentication", async () => {
  const app = new Hono();
  app.route("/", associationRoutes);
  const response = await app.request("/association/reports");
  const body = await response.json();
  if (
    response.status !== 401 || body.error.code !== "authentication_required"
  ) {
    throw new Error("association reports must reject missing authentication");
  }
});
