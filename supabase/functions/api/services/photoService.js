import { PhotoImageError, sanitizePhotoBytes } from "../domain/photoImage.js";
import { getConfig } from "../infrastructure/config.js";
import { getSql } from "../infrastructure/db.js";
import * as repository from "../repositories/photoRepository.js";
import {
  deleteStorageObject,
  downloadStorageObject,
  uploadStorageObject,
} from "../repositories/storageRepository.js";
import { sha256Hex } from "./reportService.js";

const KNOWN_AUTHENTICATED_ROLES = new Set(["association", "administrator"]);
const CONNECTION_ERROR_CODES = new Set([
  "CONNECTION_CLOSED",
  "CONNECTION_ENDED",
  "CONNECT_TIMEOUT",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "57P01",
  "57P02",
  "57P03",
]);

export class PhotoServiceError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "PhotoServiceError";
    this.code = code;
    this.details = details;
  }
}

function serviceError(code, message, details) {
  return new PhotoServiceError(code, message, details);
}

function claimRole(payload) {
  const metadata = payload?.app_metadata ?? {};
  const value = metadata.app_role ?? metadata.role;
  return typeof value === "string" ? value : null;
}

function claimSubject(payload) {
  return typeof payload?.sub === "string" && payload.sub ? payload.sub : null;
}

async function sha256BytesHex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function statusFromRow(row) {
  return {
    reportId: row.report_id,
    photoExpected: row.photo_expected === true,
    state: row.state ?? null,
    rejectionCode: row.rejection_code ?? null,
  };
}

function existingStatus(report, photo) {
  return {
    reportId: report.id,
    photoExpected: report.photo_expected === true,
    state: photo?.state ?? null,
    rejectionCode: photo?.rejection_code ?? null,
  };
}

function extensionForMime(mimeType) {
  return mimeType === "image/png" ? "png" : "jpg";
}

function approvedObjectPath({ reportId, sourceSha256, mimeType }) {
  return `reports/${reportId}/${sourceSha256}.${extensionForMime(mimeType)}`;
}

function mapPersistenceError(error) {
  if (error instanceof PhotoServiceError) return error;
  if (error?.code === "23505") {
    return serviceError(
      "photo_content_conflict",
      "A photo is already registered for this report.",
    );
  }
  if (
    CONNECTION_ERROR_CODES.has(error?.code) ||
    error?.code?.startsWith?.("08")
  ) {
    return serviceError("database_unavailable", "Postgres is not reachable.");
  }
  return error;
}

function mapStorageError(error) {
  if (
    [
      "storage_upload_failed",
      "storage_download_failed",
      "storage_delete_failed",
    ]
      .includes(error?.code)
  ) {
    return serviceError(
      "storage_unavailable",
      "Private photo storage is unavailable.",
      { dependency_status: error.status ?? null },
    );
  }
  return error;
}

function requireStorageConfig(config) {
  if (
    !config.supabaseUrl || !config.serviceRoleKey ||
    !config.approvedPhotosBucket
  ) {
    throw serviceError(
      "storage_unavailable",
      "Private photo storage is not configured.",
    );
  }
  return {
    supabaseUrl: config.supabaseUrl,
    serviceRoleKey: config.serviceRoleKey,
    bucket: config.approvedPhotosBucket,
  };
}

export function createPhotoService(dependencies = {}) {
  const deps = {
    getConfig,
    getSql,
    repository,
    sanitizePhotoBytes,
    uploadStorageObject,
    downloadStorageObject,
    deleteStorageObject,
    sha256Hex,
    sha256BytesHex,
    ...dependencies,
  };

  async function inReporterTransaction({ reportId, originHash }, operation) {
    try {
      return await deps.getSql().begin(async (tx) => {
        await tx`SELECT set_config('app.user_id', '', true)`;
        await tx`SELECT set_config('app.role', 'anonymous', true)`;
        await tx`SELECT set_config('app.origin_hash', ${originHash}, true)`;
        await tx`SELECT set_config('app.report_id', ${reportId}, true)`;
        return operation(tx);
      });
    } catch (error) {
      throw mapPersistenceError(error);
    }
  }

  async function setDownloadContext(tx, actor) {
    if (actor?.type !== "authenticated") {
      await tx`SELECT set_config('app.user_id', '', true)`;
      await tx`SELECT set_config('app.role', 'anonymous', true)`;
      await tx`SELECT set_config('app.origin_hash', '', true)`;
      await tx`SELECT set_config('app.report_id', '', true)`;
      return { role: "anonymous" };
    }

    const userId = claimSubject(actor.claims);
    const jwtRole = claimRole(actor.claims);
    if (!userId || !KNOWN_AUTHENTICATED_ROLES.has(jwtRole)) {
      throw serviceError(
        "invalid_token",
        "Authorization bearer token is invalid.",
      );
    }

    await tx`SELECT set_config('app.user_id', ${userId}, true)`;
    await tx`SELECT set_config('app.role', ${jwtRole}, true)`;
    await tx`SELECT set_config('app.origin_hash', '', true)`;
    await tx`SELECT set_config('app.report_id', '', true)`;

    const profile = await deps.repository.readAuthenticatedProfile(tx, userId);
    if (!profile || profile.active !== true) {
      throw serviceError(
        "inactive_profile",
        "The account profile is missing or inactive.",
      );
    }
    if (profile.role !== jwtRole) {
      throw serviceError(
        "role_mismatch",
        "The token role does not match the active profile.",
      );
    }
    return { role: jwtRole, userId };
  }

  async function inDownloadTransaction(actor, operation) {
    try {
      return await deps.getSql().begin(async (tx) => {
        const resolvedActor = await setDownloadContext(tx, actor);
        return operation(tx, resolvedActor);
      });
    } catch (error) {
      throw mapPersistenceError(error);
    }
  }

  async function reserveUpload({ reportId, originHash, sourceSha256 }) {
    return inReporterTransaction({ reportId, originHash }, async (tx) => {
      const report = await deps.repository.lockReportForPhotoUpload(tx, {
        reportId,
        originHash,
      });
      if (!report) {
        throw serviceError(
          "photo_not_available",
          "Photo status is not available for this report.",
        );
      }
      if (report.photo_expected !== true) {
        throw serviceError(
          "photo_not_expected",
          "This report was submitted without a photo.",
        );
      }

      const existing = await deps.repository.lockPhotoForReport(tx, reportId);
      if (existing) {
        if (existing.source_sha256 === sourceSha256) {
          if (existing.state === "processing") {
            return { action: "process", report };
          }
          return {
            action: "existing",
            status: existingStatus(report, existing),
          };
        }
        throw serviceError(
          "photo_content_conflict",
          "A different photo is already registered for this report.",
        );
      }

      await deps.repository.insertProcessingPhoto(tx, {
        reportId,
        sourceSha256,
      });
      return { action: "process", report };
    });
  }

  async function rejectReservedPhoto({
    reportId,
    originHash,
    sourceSha256,
    rejectionCode,
  }) {
    await inReporterTransaction({ reportId, originHash }, async (tx) => {
      const rejected = await deps.repository.rejectPhoto(tx, {
        reportId,
        sourceSha256,
        rejectionCode,
      });
      if (!rejected) {
        throw serviceError(
          "photo_processing_conflict",
          "Photo processing state changed concurrently.",
        );
      }
      return rejected;
    });
  }

  async function approveReservedPhoto({
    reportId,
    originHash,
    sourceSha256,
    objectPath,
    sanitized,
    sanitizedSha256,
  }) {
    return inReporterTransaction({ reportId, originHash }, async (tx) => {
      const approved = await deps.repository.approvePhoto(tx, {
        reportId,
        sourceSha256,
        objectPath,
        detectedMimeType: sanitized.detectedMimeType,
        byteSize: sanitized.bytes.length,
        widthPixels: sanitized.width,
        heightPixels: sanitized.height,
        sanitizedSha256,
      });
      if (!approved) {
        throw serviceError(
          "photo_processing_conflict",
          "Photo processing state changed concurrently.",
        );
      }
      return statusFromRow(approved);
    });
  }

  async function getStatus({ reportId, deviceFingerprint }) {
    const originHash = await deps.sha256Hex(deviceFingerprint);
    return inReporterTransaction({ reportId, originHash }, async (tx) => {
      const row = await deps.repository.readPhotoStatusForOrigin(tx, {
        reportId,
        originHash,
      });
      if (!row) {
        throw serviceError(
          "photo_not_available",
          "Photo status is not available for this report.",
        );
      }
      return statusFromRow(row);
    });
  }

  async function upload({ reportId, deviceFingerprint, photo }) {
    const originHash = await deps.sha256Hex(deviceFingerprint);
    const sourceSha256 = await deps.sha256BytesHex(photo.bytes);
    const reservation = await reserveUpload({
      reportId,
      originHash,
      sourceSha256,
    });
    if (reservation.action === "existing") {
      return { status: reservation.status, responseStatus: 200 };
    }

    let sanitized;
    try {
      sanitized = await deps.sanitizePhotoBytes({
        bytes: photo.bytes,
        declaredMimeType: photo.declaredMimeType,
      });
    } catch (error) {
      if (error instanceof PhotoImageError) {
        await rejectReservedPhoto({
          reportId,
          originHash,
          sourceSha256,
          rejectionCode: error.rejectionCode,
        });
        throw serviceError(error.code, error.message);
      }
      throw error;
    }

    const sanitizedSha256 = await deps.sha256BytesHex(sanitized.bytes);
    const objectPath = approvedObjectPath({
      reportId,
      sourceSha256,
      mimeType: sanitized.detectedMimeType,
    });
    const storage = requireStorageConfig(deps.getConfig());

    try {
      await deps.uploadStorageObject({
        ...storage,
        objectPath,
        bytes: sanitized.bytes,
        contentType: sanitized.detectedMimeType,
      });
    } catch (error) {
      throw mapStorageError(error);
    }

    try {
      const status = await approveReservedPhoto({
        reportId,
        originHash,
        sourceSha256,
        objectPath,
        sanitized,
        sanitizedSha256,
      });
      return { status, responseStatus: 201 };
    } catch (error) {
      try {
        await deps.deleteStorageObject({ ...storage, objectPath });
      } catch (deleteError) {
        throw mapStorageError(deleteError);
      }
      throw error;
    }
  }

  async function download({ reportId, actor }) {
    const storage = requireStorageConfig(deps.getConfig());
    const photo = await inDownloadTransaction(
      actor,
      (tx, resolvedActor) =>
        deps.repository.findAuthorizedPhotoForDownload(tx, {
          reportId,
          actorRole: resolvedActor.role,
        }),
    );
    if (!photo) {
      throw serviceError(
        "photo_not_available",
        "Photo is not available.",
      );
    }

    try {
      const object = await deps.downloadStorageObject({
        ...storage,
        objectPath: photo.approved_object_path,
      });
      return {
        body: object.body,
        contentType: photo.detected_mime_type ?? object.contentType ??
          "application/octet-stream",
        contentLength: object.contentLength ??
          (photo.byte_size ? String(photo.byte_size) : null),
      };
    } catch (error) {
      if (error?.code === "storage_download_failed" && error.status === 404) {
        throw serviceError("photo_not_available", "Photo is not available.");
      }
      throw mapStorageError(error);
    }
  }

  return { getStatus, upload, download };
}

export const photoService = createPhotoService();
