/**
 * @module controllers/duplicateController
 * HTTP adapter for duplicate candidates and duplicate groups. Validates the request shape at the
 * boundary and maps {@link DuplicateError} codes to HTTP statuses.
 */
import {
  DuplicateError,
  validateDuplicateId,
  validateDuplicateResolution,
  validateDuplicateReversal,
} from "../domain/duplicateGroup.js";
import { duplicateService } from "../services/duplicateService.js";
import {
  presentDuplicateCandidates,
  presentDuplicateGroup,
  presentDuplicateGroups,
} from "../presenters/duplicateGroup.js";
import { presentError } from "../presenters/error.js";
/** HTTP status for each `DuplicateError` code; unmapped errors become 500 `internal_error`. */
const statuses = {
  invalid_request: 400,
  authentication_required: 401,
  forbidden: 403,
  not_found: 404,
  duplicate_graph_disconnected: 409,
  duplicate_membership_conflict: 409,
  duplicate_group_conflict: 409,
  dependency_unavailable: 503,
  preflight_mismatch: 503,
};
function errorResponse(c, error) {
  if (error instanceof DuplicateError && statuses[error.code]) {
    return presentError(
      c,
      statuses[error.code],
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
/** @throws {DuplicateError} `invalid_request` when the URL has a query string. */
function rejectQuery(c) {
  if (new URL(c.req.url).search) {
    throw new DuplicateError(
      "invalid_request",
      "This route does not accept query parameters.",
    );
  }
}
/** Reads a JSON body. @throws {DuplicateError} `invalid_request` for another Content-Type or invalid JSON. */
async function readJson(c) {
  if (
    c.req.header("Content-Type")?.split(";")[0].trim().toLowerCase() !==
      "application/json"
  ) {
    throw new DuplicateError(
      "invalid_request",
      "Content-Type must be application/json.",
    );
  }
  try {
    return await c.req.json();
  } catch {
    throw new DuplicateError(
      "invalid_request",
      "Body must contain valid JSON.",
    );
  }
}
/**
 * Creates the duplicate Controller.
 * `candidates` and `list` respond 200 (GET, no query or body); `resolve` responds 201 with the new
 * group; `reverse` responds 200 with the reversed group. Errors: 400 `invalid_request`, 401
 * `authentication_required`, 403 `forbidden`, 404 `not_found`, 409 `duplicate_graph_disconnected` /
 * `duplicate_membership_conflict` / `duplicate_group_conflict`, 503 `dependency_unavailable` /
 * `preflight_mismatch`, 500 `internal_error` otherwise.
 * @param {ReturnType<typeof import('../services/duplicateService.js').createDuplicateService>} [service]
 *   Duplicate Service.
 * @returns {{candidates: (c: import('hono').Context) => Promise<Response>, list: (c: import('hono').Context) => Promise<Response>,
 *   resolve: (c: import('hono').Context) => Promise<Response>, reverse: (c: import('hono').Context) => Promise<Response>}}
 */
export function createDuplicateController(service = duplicateService) {
  return {
    async candidates(c) {
      try {
        rejectQuery(c);
        if (await c.req.text()) {
          throw new DuplicateError("invalid_request", "GET does not accept a body.");
        }
        return presentDuplicateCandidates(c, await service.candidates({ actor: c.get("auth") }));
      } catch (error) {
        return errorResponse(c, error);
      }
    },
    async list(c) {
      try {
        rejectQuery(c);
        if (await c.req.text()) {
          throw new DuplicateError(
            "invalid_request",
            "GET does not accept a body.",
          );
        }
        return presentDuplicateGroups(
          c,
          await service.list({ actor: c.get("auth") }),
        );
      } catch (error) {
        return errorResponse(c, error);
      }
    },
    async resolve(c) {
      try {
        rejectQuery(c);
        const input = await readJson(c);
        validateDuplicateResolution(input);
        return presentDuplicateGroup(
          c,
          await service.resolve({ actor: c.get("auth"), input }),
          201,
        );
      } catch (error) {
        return errorResponse(c, error);
      }
    },
    async reverse(c) {
      try {
        rejectQuery(c);
        const groupId = validateDuplicateId(c.req.param("group_id"));
        const input = await readJson(c);
        validateDuplicateReversal(input);
        return presentDuplicateGroup(
          c,
          await service.reverse({ actor: c.get("auth"), groupId, input }),
        );
      } catch (error) {
        return errorResponse(c, error);
      }
    },
  };
}
