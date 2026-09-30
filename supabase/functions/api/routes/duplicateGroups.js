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
  for (const path of ["/admin/duplicate-groups", "/admin/duplicateGroups"]) {
    routes.use(path, methods(["GET", "POST"]));
    routes.use(`${path}/:group_id/reverse`, methods(["POST"]));
    routes.get(path, authorize, controller.list);
    routes.post(path, authorize, controller.resolve);
    routes.post(`${path}/:group_id/reverse`, authorize, controller.reverse);
  }
  routes.use("/admin/duplicate-candidates", methods(["GET"]));
  routes.get("/admin/duplicate-candidates", authorize, controller.candidates);
  return routes;
}
export const duplicateRoutes = createDuplicateRoutes();
