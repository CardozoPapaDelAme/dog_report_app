/**
 * @module controllers/photoValidationController
 * HTTP adapter for the anonymous `GET /public/photo-validation`. Rejects any query parameter.
 */
import { ConfigurationError } from "../domain/configuration.js";
import { presentError } from "../presenters/error.js";
import { presentPhotoValidation } from "../presenters/photoValidation.js";
import { photoValidationService } from "../services/photoValidationService.js";

const ERROR_STATUSES = {
  configuration_unavailable: 503,
  dependency_unavailable: 503,
};

/**
 * Creates the photo validation Controller. `read` responds 200, 400 `invalid_request` (any query
 * parameter), 503 `configuration_unavailable` / `dependency_unavailable`, or 500 `internal_error`.
 * @param {ReturnType<typeof import('../services/photoValidationService.js').createPhotoValidationService>} [service]
 * @returns {{read: (c: import('hono').Context) => Promise<Response>}}
 */
export function createPhotoValidationController(service = photoValidationService) {
  return {
    async read(c) {
      if (new URL(c.req.url).search) {
        return presentError(
          c,
          400,
          "invalid_request",
          "This route does not accept query parameters.",
        );
      }
      try {
        return presentPhotoValidation(c, await service.read());
      } catch (error) {
        if (error instanceof ConfigurationError && ERROR_STATUSES[error.code]) {
          return presentError(c, ERROR_STATUSES[error.code], error.code, error.message);
        }
        return presentError(c, 500, "internal_error", "The request could not be completed.");
      }
    },
  };
}
