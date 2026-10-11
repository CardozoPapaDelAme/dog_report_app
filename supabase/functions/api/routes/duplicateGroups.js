/**
 * @module routes/duplicateGroups
 * Administrator duplicate router (role `administrator`). For both `/admin/duplicate-groups` and the
 * `/admin/duplicateGroups` alias it registers `GET` (list), `POST` (resolve), and
 * `POST /:group_id/reverse`; it also registers `GET /admin/duplicate-candidates`. Other methods get
 * 405 `method_not_allowed` with an `Allow` header.
 */
import { Hono } from "hono";
import { createDuplicateController } from "../controllers/duplicateController.js";
import { requireAuth } from "../middleware/auth.js";
import { presentError } from "../presenters/error.js";
/** Middleware that responds 405 `method_not_allowed` unless the method is in `allowed`. */
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
/**
 * Creates the duplicate router.
 * @param {object} [options]
 * @param {ReturnType<typeof import('../services/duplicateService.js').createDuplicateService>} [options.service]
 *   Duplicate Service; the production instance when omitted.
 * @param {import('hono').MiddlewareHandler} [options.authorize] - Authorization middleware;
 *   defaults to `requireAuth('administrator')`.
 * @returns {import('hono').Hono}
 */
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
/** Production duplicate router. */
export const duplicateRoutes = createDuplicateRoutes();
