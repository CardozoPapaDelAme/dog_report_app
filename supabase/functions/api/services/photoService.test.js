import { sanitizePhotoBytes } from "../domain/photoImage.js";
import { createPhotoService, PhotoServiceError } from "./photoService.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const REPORT_ID = "11111111-2222-4333-8444-555555555555";
const ORIGIN_HASH = "a".repeat(64);
const SOURCE_HASH = "b".repeat(64);
const SANITIZED_HASH = "c".repeat(64);
const STORAGE_CONFIG = {
  supabaseUrl: "https://project.supabase.co",
  serviceRoleKey: "server-only-key",
  approvedPhotosBucket: "approved-photos",
};

function fakeTx() {
  return [];
}

function baseDependencies(overrides = {}) {
  const calls = [];
  const dependencies = {
    getConfig: () => STORAGE_CONFIG,
    getSql: () => ({
      begin: (operation) => operation(fakeTx),
    }),
    sha256Hex: () => ORIGIN_HASH,
    sha256BytesHex: (bytes) => {
      if (bytes?.[0] === 9) return SANITIZED_HASH;
      return SOURCE_HASH;
    },
    repository: {
      lockReportForPhotoUpload: () => {
        calls.push("lock-report");
        return { id: REPORT_ID, photo_expected: true };
      },
      lockPhotoForReport: () => {
        calls.push("lock-photo");
        return null;
      },
      insertProcessingPhoto: () => {
        calls.push("insert-processing");
        return {
          report_id: REPORT_ID,
          state: "processing",
          source_sha256: SOURCE_HASH,
        };
      },
      rejectPhoto: (_tx, values) => {
        calls.push(`reject:${values.rejectionCode}`);
        return {
          report_id: REPORT_ID,
          state: "rejected",
          source_sha256: values.sourceSha256,
          rejection_code: values.rejectionCode,
        };
      },
      approvePhoto: (_tx, values) => {
        calls.push(`approve:${values.objectPath}`);
        return {
          report_id: REPORT_ID,
          photo_expected: true,
          state: "approved",
          rejection_code: null,
        };
      },
      readPhotoStatusForOrigin: () => null,
      readAuthenticatedProfile: () => ({
        id: "user",
        role: "administrator",
        active: true,
      }),
      findAuthorizedPhotoForDownload: () => ({
        approved_object_path: "reports/approved/photo.png",
        detected_mime_type: "image/png",
        byte_size: 3,
      }),
    },
    sanitizePhotoBytes: () => ({
      bytes: new Uint8Array([9, 8, 7]),
      detectedMimeType: "image/png",
      width: 1,
      height: 1,
    }),
    uploadStorageObject: (_input) => {
      calls.push("upload");
    },
    deleteStorageObject: (_input) => {
      calls.push("delete");
    },
    downloadStorageObject: () => ({
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      }),
      contentType: "image/png",
      contentLength: "3",
    }),
    ...overrides,
  };
  return { calls, dependencies };
}

Deno.test("same source hash upload returns existing state without processing or storage", async () => {
  const { calls, dependencies } = baseDependencies({
    repository: {
      ...baseDependencies().dependencies.repository,
      lockPhotoForReport: () => ({
        report_id: REPORT_ID,
        state: "approved",
        source_sha256: SOURCE_HASH,
        rejection_code: null,
      }),
      insertProcessingPhoto: () => {
        throw new Error("same photo must not insert a new processing row");
      },
    },
    sanitizePhotoBytes: () => {
      throw new Error("same photo must not be reprocessed");
    },
    uploadStorageObject: () => {
      throw new Error("same photo must not upload to storage");
    },
  });
  const service = createPhotoService(dependencies);

  const result = await service.upload({
    reportId: REPORT_ID,
    deviceFingerprint: "raw-device-fingerprint",
    photo: { bytes: new Uint8Array([1, 2, 3]), declaredMimeType: "image/png" },
  });

  assert(
    result.responseStatus === 200,
    "same photo should be a replay response",
  );
  assert(
    result.status.state === "approved",
    "existing approved status should be returned",
  );
  assert(
    !calls.includes("insert-processing"),
    "no processing row should be inserted",
  );
});

Deno.test("different source hash for the same report conflicts", async () => {
  const { dependencies } = baseDependencies({
    repository: {
      ...baseDependencies().dependencies.repository,
      lockPhotoForReport: () => ({
        report_id: REPORT_ID,
        state: "approved",
        source_sha256: "d".repeat(64),
        rejection_code: null,
      }),
    },
  });
  const service = createPhotoService(dependencies);

  try {
    await service.upload({
      reportId: REPORT_ID,
      deviceFingerprint: "raw-device-fingerprint",
      photo: {
        bytes: new Uint8Array([1, 2, 3]),
        declaredMimeType: "image/png",
      },
    });
    throw new Error("different photo was accepted");
  } catch (error) {
    assert(error instanceof PhotoServiceError);
    assert(
      error.code === "photo_content_conflict",
      "different source should conflict",
    );
  }
});

Deno.test("fake image content is rejected by real content inspection and persists rejection", async () => {
  const { calls, dependencies } = baseDependencies();
  const service = createPhotoService({
    ...dependencies,
    sanitizePhotoBytes,
  });

  try {
    await service.upload({
      reportId: REPORT_ID,
      deviceFingerprint: "raw-device-fingerprint",
      photo: {
        bytes: new TextEncoder().encode("not an image"),
        declaredMimeType: "image/jpeg",
      },
    });
    throw new Error("fake image was accepted");
  } catch (error) {
    assert(error instanceof PhotoServiceError);
    assert(
      error.code === "invalid_image_content",
      "fake content should be rejected by content",
    );
  }

  assert(
    calls.includes("reject:undecodable_image"),
    "rejection code should persist",
  );
  assert(!calls.includes("upload"), "invalid image must not be uploaded");
});

Deno.test("valid image path uploads sanitized bytes and registers clean metadata", async () => {
  const { calls, dependencies } = baseDependencies();
  const service = createPhotoService(dependencies);

  const result = await service.upload({
    reportId: REPORT_ID,
    deviceFingerprint: "raw-device-fingerprint",
    photo: { bytes: new Uint8Array([1, 2, 3]), declaredMimeType: "image/png" },
  });

  assert(
    result.responseStatus === 201,
    "new valid image should create a photo asset",
  );
  assert(calls.includes("upload"), "sanitized bytes should be uploaded");
  assert(
    calls.some((call) =>
      call.startsWith(`approve:reports/${REPORT_ID}/${SOURCE_HASH}.png`)
    ),
    "approved row should store the stable private object path",
  );
});

Deno.test("database failure after storage upload deletes the orphan object", async () => {
  const { calls, dependencies } = baseDependencies({
    repository: {
      ...baseDependencies().dependencies.repository,
      approvePhoto: () => {
        const error = new Error("connection ended");
        error.code = "CONNECTION_CLOSED";
        throw error;
      },
    },
  });
  const service = createPhotoService(dependencies);

  try {
    await service.upload({
      reportId: REPORT_ID,
      deviceFingerprint: "raw-device-fingerprint",
      photo: {
        bytes: new Uint8Array([1, 2, 3]),
        declaredMimeType: "image/png",
      },
    });
    throw new Error("upload unexpectedly succeeded");
  } catch (error) {
    assert(error instanceof PhotoServiceError);
    assert(
      error.code === "database_unavailable",
      "original database failure should surface",
    );
  }

  assert(calls.includes("upload"), "storage upload should have happened first");
  assert(
    calls.includes("delete"),
    "orphan object should be deleted on database failure",
  );
});

Deno.test("download returns a proxied stream without public URL or object path fields", async () => {
  const { dependencies } = baseDependencies();
  const service = createPhotoService(dependencies);

  const result = await service.download({
    reportId: REPORT_ID,
    actor: { type: "anonymous" },
  });

  assert(
    result.contentType === "image/png",
    "download should preserve sanitized MIME",
  );
  assert(
    result.body instanceof ReadableStream,
    "download should return a response stream",
  );
  assert(
    !Object.hasOwn(result, "url"),
    "download result must not expose a public URL",
  );
  assert(
    !Object.hasOwn(result, "objectPath"),
    "download result must not expose storage paths",
  );
});
