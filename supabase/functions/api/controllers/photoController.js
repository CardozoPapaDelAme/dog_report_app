import { presentError } from "../presenters/error.js";
import { presentPhotoStatus } from "../presenters/photo.js";
import { photoService, PhotoServiceError } from "../services/photoService.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ERROR_STATUSES = {
  invalid_request: 400,
  invalid_image_content: 400,
  invalid_token: 401,
  photo_not_available: 404,
  photo_content_conflict: 409,
  photo_not_expected: 409,
  photo_processing_conflict: 409,
  photo_too_large: 413,
  image_too_large: 413,
  unsupported_media_type: 415,
  inactive_profile: 403,
  role_mismatch: 403,
  storage_unavailable: 503,
  database_unavailable: 503,
};

function invalid(message) {
  return { ok: false, code: "invalid_request", message };
}

function validateReportId(reportId) {
  return typeof reportId === "string" && UUID_PATTERN.test(reportId);
}

function rejectQuery(c) {
  if (new URL(c.req.url).search) {
    return invalid("This route does not accept query parameters.");
  }
  return null;
}

function deviceFingerprint(c) {
  const value = c.req.header("X-Device-Fingerprint");
  if (typeof value !== "string" || value.length < 16) {
    return null;
  }
  return value;
}

function multipartContentType(c) {
  return c.req.header("Content-Type")?.split(";")[0].trim().toLowerCase();
}

function normalizePartValues(value) {
  return Array.isArray(value) ? value : [value];
}

async function parsePhotoPart(c) {
  if (multipartContentType(c) !== "multipart/form-data") {
    return invalid("Content-Type must be multipart/form-data.");
  }

  let body;
  try {
    body = await c.req.parseBody({ all: true });
  } catch {
    return invalid("Multipart body is malformed.");
  }

  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== "photo") {
    return invalid("Multipart body must contain only the photo part.");
  }

  const values = normalizePartValues(body.photo);
  if (values.length !== 1 || !(values[0] instanceof File)) {
    return invalid("Multipart photo part must contain exactly one file.");
  }

  const file = values[0];
  return {
    ok: true,
    value: {
      bytes: new Uint8Array(await file.arrayBuffer()),
      declaredMimeType: file.type || "",
      filename: file.name || "",
    },
  };
}

function handlePhotoError(c, error) {
  if (error instanceof PhotoServiceError && ERROR_STATUSES[error.code]) {
    return presentError(
      c,
      ERROR_STATUSES[error.code],
      error.code,
      error.message,
      error.details,
    );
  }
  throw error;
}

function routeReportId(c) {
  const reportId = c.req.param("report_id");
  if (!validateReportId(reportId)) {
    return null;
  }
  return reportId;
}

export function createPhotoController(service = photoService) {
  return {
    async status(c) {
      const queryError = rejectQuery(c);
      if (queryError) {
        return presentError(c, 400, queryError.code, queryError.message);
      }
      const reportId = routeReportId(c);
      if (!reportId) {
        return presentError(
          c,
          400,
          "invalid_request",
          "report_id must be a lowercase canonical UUID.",
        );
      }
      const fingerprint = deviceFingerprint(c);
      if (!fingerprint) {
        return presentError(
          c,
          400,
          "invalid_request",
          "X-Device-Fingerprint is required.",
        );
      }

      try {
        return presentPhotoStatus(
          c,
          await service.getStatus({ reportId, deviceFingerprint: fingerprint }),
        );
      } catch (error) {
        return handlePhotoError(c, error);
      }
    },

    async upload(c) {
      const queryError = rejectQuery(c);
      if (queryError) {
        return presentError(c, 400, queryError.code, queryError.message);
      }
      const reportId = routeReportId(c);
      if (!reportId) {
        return presentError(
          c,
          400,
          "invalid_request",
          "report_id must be a lowercase canonical UUID.",
        );
      }
      const fingerprint = deviceFingerprint(c);
      if (!fingerprint) {
        return presentError(
          c,
          400,
          "invalid_request",
          "X-Device-Fingerprint is required.",
        );
      }
      const parsed = await parsePhotoPart(c);
      if (!parsed.ok) {
        return presentError(c, 400, parsed.code, parsed.message);
      }

      try {
        const result = await service.upload({
          reportId,
          deviceFingerprint: fingerprint,
          photo: parsed.value,
        });
        return presentPhotoStatus(c, result.status, result.responseStatus);
      } catch (error) {
        return handlePhotoError(c, error);
      }
    },

    async download(c) {
      const queryError = rejectQuery(c);
      if (queryError) {
        return presentError(c, 400, queryError.code, queryError.message);
      }
      const reportId = routeReportId(c);
      if (!reportId) {
        return presentError(
          c,
          400,
          "invalid_request",
          "report_id must be a lowercase canonical UUID.",
        );
      }

      try {
        const result = await service.download({
          reportId,
          actor: c.get("auth"),
        });
        c.header("Content-Type", result.contentType);
        c.header("Cache-Control", "private, no-store");
        if (result.contentLength) {
          c.header("Content-Length", result.contentLength);
        }
        return c.body(result.body, 200);
      } catch (error) {
        return handlePhotoError(c, error);
      }
    },
  };
}

export const photoController = createPhotoController();
