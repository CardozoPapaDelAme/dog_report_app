import {
  DuplicateError,
  validateDuplicateId,
  validateDuplicateResolution,
  validateDuplicateReversal,
} from "../domain/duplicateGroup.js";
import { duplicateService } from "../services/duplicateService.js";
import {
  presentDuplicateGroup,
  presentDuplicateGroups,
} from "../presenters/duplicateGroup.js";
import { presentError } from "../presenters/error.js";
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
function rejectQuery(c) {
  if (new URL(c.req.url).search) {
    throw new DuplicateError(
      "invalid_request",
      "This route does not accept query parameters.",
    );
  }
}
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
export function createDuplicateController(service = duplicateService) {
  return {
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
