import { Hono } from "hono";
import { createDuplicateController } from "../controllers/duplicateController.js";
import { requireAuth } from "../middleware/auth.js";
import { presentError } from "../presenters/error.js";
function methods(allowed) {
  return (c, next) => {
    if (!allowed.includes(c.req.method)) {
      c.header("Allow", allowed.join(", "));
      return presentError(
        c,
        405,
        "method_not_allowed",
        "Method is not supported for this route.",
      );
    }
    return next();
  };
}
export function createDuplicateRoutes(
  { service, authorize = requireAuth("administrator") } = {},
) {
  const routes = new Hono();
  const controller = createDuplicateController(service);
  routes.use("/admin/duplicateGroups", methods(["GET", "POST"]));
  routes.use("/admin/duplicateGroups/:group_id/reverse", methods(["POST"]));
  routes.get("/admin/duplicateGroups", authorize, controller.list);
  routes.post("/admin/duplicateGroups", authorize, controller.resolve);
  routes.post(
    "/admin/duplicateGroups/:group_id/reverse",
    authorize,
    controller.reverse,
  );
  return routes;
}
export const duplicateRoutes = createDuplicateRoutes();
