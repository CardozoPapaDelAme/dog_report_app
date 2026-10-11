/**
 * @module controllers/zoneController
 * HTTP adapter for zone set creation and activation. Validates the request shape at the boundary and
 * maps {@link ZoneSetError} codes to HTTP statuses.
 */
import {
  validateZoneSetActivation,
  validateZoneSetCreation,
  ZoneSetError,
} from "../domain/zoneSet.js";
import { presentError } from "../presenters/error.js";
import { presentZoneSet } from "../presenters/zoneSet.js";
import { zoneService } from "../services/zoneService.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** HTTP status for each `ZoneSetError` code; unmapped errors become 500 `internal_error`. */
const ERROR_STATUSES = {
  invalid_request: 400,
  authentication_required: 401,
  forbidden: 403,
  not_found: 404,
  zone_set_conflict: 409,
  dependency_unavailable: 503,
  preflight_mismatch: 503,
};

function handleError(c, error) {
  if (error instanceof ZoneSetError && ERROR_STATUSES[error.code]) {
    return presentError(
      c,
      ERROR_STATUSES[error.code],
      error.code,
      error.message,
      error.details,
    );
  }
  return presentError(
    c,
    500,
    "internal_error",
    "The request could not be completed.",
  );
}

/** @throws {ZoneSetError} `invalid_request` when the URL has a query string. */
function rejectQuery(c) {
  if (new URL(c.req.url).search) {
    throw new ZoneSetError(
      "invalid_request",
      "This route does not accept query parameters.",
    );
  }
}

/** Reads a JSON body. @throws {ZoneSetError} `invalid_request` for another Content-Type or invalid JSON. */
async function readJson(c) {
  const contentType = c.req.header("Content-Type")?.split(";")[0].trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new ZoneSetError(
      "invalid_request",
      "Content-Type must be application/json.",
    );
  }
  try {
    return await c.req.json();
  } catch {
    throw new ZoneSetError("invalid_request", "Body must contain valid JSON.");
  }
}

/**
 * Creates the zone set Controller. `create` responds 201 with the draft; `activate` responds 200 with
 * the active zone set. Errors: 400 `invalid_request`, 401 `authentication_required`, 403 `forbidden`,
 * 404 `not_found`, 409 `zone_set_conflict`, 503 `dependency_unavailable` / `preflight_mismatch`,
 * 500 `internal_error` otherwise.
 * @param {ReturnType<typeof import('../services/zoneService.js').createZoneService>} [service] - Zone set Service.
 * @returns {{create: (c: import('hono').Context) => Promise<Response>, activate: (c: import('hono').Context) => Promise<Response>}}
 */
export function createZoneController(service = zoneService) {
  return {
    async create(c) {
      try {
        rejectQuery(c);
        // Validate at HTTP boundary; the Service validates again for non-HTTP callers.
        const input = await readJson(c);
        await validateZoneSetCreation(input);
        return presentZoneSet(
          c,
          await service.create({ actor: c.get("auth"), input }),
          201,
        );
      } catch (error) {
        return handleError(c, error);
      }
    },
    async activate(c) {
      try {
        rejectQuery(c);
        const zoneSetId = c.req.param("zone_set_id");
        if (!UUID_PATTERN.test(zoneSetId)) {
          throw new ZoneSetError(
            "invalid_request",
            "zone_set_id must be a UUID.",
          );
        }
        const input = await readJson(c);
        validateZoneSetActivation(input);
        return presentZoneSet(
          c,
          await service.activate({ actor: c.get("auth"), zoneSetId, input }),
        );
      } catch (error) {
        return handleError(c, error);
      }
    },
  };
}
