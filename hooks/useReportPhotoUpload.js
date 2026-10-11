/**
 * @module hooks/useReportPhotoUpload
 * Report photo upload pipeline: prepares a reduced JPEG copy (longest side 1600 px) in the cache
 * directory, uploads it, resolves ambiguous upload failures through the photo status endpoint, and
 * polls the status until it is final.
 */
import {
  DEFAULT_PHOTO_POLL_ATTEMPTS,
  DEFAULT_PHOTO_POLL_INTERVAL_MS,
  photoStatusIsPending,
  photoStatusIsTerminal,
} from '../models/photoState.js';
import {
  getReportPhotoStatus,
  uploadReportPhoto,
} from '../services/reportApi.js';

const DEFAULT_MAX_LONGEST_SIDE = 1600;
const DEFAULT_JPEG_QUALITY = 0.82;
const PREPARED_PHOTO_DIRECTORY = 'reports/photo-uploads/';
const PHOTO_UPLOAD_MIME_TYPE = 'image/jpeg';

function assertExistingReportId(reportId) {
  if (typeof reportId !== 'string' || !reportId) {
    throw Object.assign(new Error('report_required_before_photo_upload'), {
      code: 'report_required_before_photo_upload',
      status: 400,
    });
  }
  return reportId;
}

function assertLocalPhotoUri(photoUri) {
  if (typeof photoUri !== 'string' || !photoUri) {
    throw Object.assign(new Error('photo_uri_required'), {
      code: 'photo_uri_required',
      status: 400,
    });
  }
  return photoUri;
}

async function loadDefaultFileSystem() {
  return import('expo-file-system/legacy');
}

async function loadDefaultImageManipulator() {
  return import('expo-image-manipulator');
}

/** Resolves after `ms` milliseconds. */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Whether the upload may have reached the server (network error or no HTTP status). */
function uploadFailureCanBeAmbiguous(error) {
  return (
    error?.code === 'network_unavailable' ||
    error?.code === 'request_timeout' ||
    !Number.isInteger(error?.status)
  );
}

/** @throws {Error} `photo_upload_directory_unavailable` without a cache or document directory. */
function baseUploadDirectory(fileSystem) {
  const base = fileSystem.cacheDirectory ?? fileSystem.documentDirectory;
  if (!base) {
    throw Object.assign(new Error('photo_upload_directory_unavailable'), {
      code: 'photo_upload_directory_unavailable',
      status: 500,
    });
  }
  return `${base}${PREPARED_PHOTO_DIRECTORY}`;
}

/**
 * @param {string} reportId
 * @param {{cacheDirectory?: string | null, documentDirectory?: string | null}} fileSystem
 * @returns {string} URI of the prepared upload copy for the report.
 * @throws {Error} `report_required_before_photo_upload` or `photo_upload_directory_unavailable`.
 */
export function preparedReportPhotoUri(reportId, fileSystem) {
  return `${baseUploadDirectory(fileSystem)}${assertExistingReportId(reportId)}.jpg`;
}

/**
 * @param {object} size
 * @param {number} size.width
 * @param {number} size.height
 * @param {number} [size.maxLongestSide=1600]
 * @returns {{width: number} | {height: number} | null} Resize action, or `null` when already small
 *   enough or the size is invalid.
 */
export function resizeForLongestSide({ width, height, maxLongestSide = DEFAULT_MAX_LONGEST_SIDE }) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    width <= maxLongestSide && height <= maxLongestSide
  ) {
    return null;
  }
  return width >= height
    ? { width: maxLongestSide }
    : { height: maxLongestSide };
}

async function fileExists(fileSystem, uri) {
  try {
    const info = await fileSystem.getInfoAsync(uri);
    return Boolean(info?.exists);
  } catch {
    return false;
  }
}

async function deleteIfPossible(fileSystem, uri) {
  try {
    await fileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Prepared upload copies are recoverable from the durable original photo.
  }
}

/** Renders the photo, resizes it when needed and saves it as JPEG; releases native image handles. */
async function saveReducedPhoto({
  imageManipulator,
  photoUri,
  maxLongestSide,
  jpegQuality,
}) {
  const context = imageManipulator.ImageManipulator.manipulate(photoUri);
  let sourceImage = null;
  let outputImage = null;
  try {
    sourceImage = await context.renderAsync();
    const resize = resizeForLongestSide({
      width: sourceImage.width,
      height: sourceImage.height,
      maxLongestSide,
    });

    if (resize) {
      sourceImage.release?.();
      sourceImage = null;
      context.resize(resize);
      outputImage = await context.renderAsync();
    } else {
      outputImage = sourceImage;
      sourceImage = null;
    }

    const result = await outputImage.saveAsync({
      compress: jpegQuality,
      format: imageManipulator.SaveFormat.JPEG,
    });
    return result;
  } finally {
    sourceImage?.release?.();
    outputImage?.release?.();
    context.release?.();
  }
}

/**
 * Creates (or reuses) the prepared JPEG copy of a report photo.
 * @param {object} options
 * @param {string} options.reportId
 * @param {string} options.photoUri - Local original photo URI.
 * @param {object} [options.fileSystem] - `expo-file-system/legacy`; loaded lazily when omitted.
 * @param {object} [options.imageManipulator] - `expo-image-manipulator`; loaded lazily when omitted.
 * @param {() => Promise<object>} [options.loadFileSystem]
 * @param {() => Promise<object>} [options.loadImageManipulator]
 * @param {number} [options.maxLongestSide=1600]
 * @param {number} [options.jpegQuality=0.82]
 * @returns {Promise<{photoUri: string, filename: string, mimeType: string, width?: number, height?: number}>}
 *   Dimensions are omitted when an existing prepared copy is reused.
 * @throws {Error} `report_required_before_photo_upload`, `photo_uri_required` or file system errors.
 */
export async function prepareReportPhotoForUpload({
  reportId,
  photoUri,
  fileSystem,
  imageManipulator,
  loadFileSystem = loadDefaultFileSystem,
  loadImageManipulator = loadDefaultImageManipulator,
  maxLongestSide = DEFAULT_MAX_LONGEST_SIDE,
  jpegQuality = DEFAULT_JPEG_QUALITY,
} = {}) {
  assertExistingReportId(reportId);
  assertLocalPhotoUri(photoUri);
  const fs = fileSystem ?? await loadFileSystem();
  const manipulator = imageManipulator ?? await loadImageManipulator();
  const preparedUri = preparedReportPhotoUri(reportId, fs);

  if (await fileExists(fs, preparedUri)) {
    return {
      photoUri: preparedUri,
      filename: `${reportId}.jpg`,
      mimeType: PHOTO_UPLOAD_MIME_TYPE,
    };
  }

  await fs.makeDirectoryAsync(baseUploadDirectory(fs), { intermediates: true });
  let reduced = null;
  try {
    reduced = await saveReducedPhoto({
      imageManipulator: manipulator,
      photoUri,
      maxLongestSide,
      jpegQuality,
    });
    await deleteIfPossible(fs, preparedUri);
    await fs.copyAsync({ from: reduced.uri, to: preparedUri });
  } finally {
    if (reduced?.uri) {
      await deleteIfPossible(fs, reduced.uri);
    }
  }

  return {
    photoUri: preparedUri,
    filename: `${reportId}.jpg`,
    mimeType: PHOTO_UPLOAD_MIME_TYPE,
    width: reduced.width,
    height: reduced.height,
  };
}

/**
 * Best-effort deletion of a report's prepared upload copy.
 * @param {object} options
 * @param {string} options.reportId
 * @param {object} [options.fileSystem]
 * @param {() => Promise<object>} [options.loadFileSystem]
 * @returns {Promise<void>}
 * @throws {Error} `report_required_before_photo_upload` for a missing report id.
 */
export async function deletePreparedReportPhoto({
  reportId,
  fileSystem,
  loadFileSystem = loadDefaultFileSystem,
} = {}) {
  assertExistingReportId(reportId);
  const fs = fileSystem ?? await loadFileSystem();
  await deleteIfPossible(fs, preparedReportPhotoUri(reportId, fs));
}

/**
 * Polls the photo status until it is terminal or the attempts run out.
 * @param {object} options
 * @param {string} options.reportId
 * @param {string} options.deviceFingerprint
 * @param {import('../models/photoState.js').PhotoStatus | null} [options.initialStatus=null]
 * @param {typeof getReportPhotoStatus} [options.getPhotoStatus=getReportPhotoStatus] - Network call.
 * @param {(ms: number) => Promise<void>} [options.wait] - Delay between pending readings.
 * @param {number} [options.pollIntervalMs]
 * @param {number} [options.maxAttempts]
 * @returns {Promise<import('../models/photoState.js').PhotoStatus | null>} The last status read, which may
 *   still be pending.
 */
export async function pollPhotoStatusUntilFinal({
  reportId,
  deviceFingerprint,
  initialStatus = null,
  getPhotoStatus = getReportPhotoStatus,
  wait = sleep,
  pollIntervalMs = DEFAULT_PHOTO_POLL_INTERVAL_MS,
  maxAttempts = DEFAULT_PHOTO_POLL_ATTEMPTS,
} = {}) {
  assertExistingReportId(reportId);
  let status = initialStatus;
  if (photoStatusIsTerminal(status)) return status;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (photoStatusIsPending(status)) {
      await wait(pollIntervalMs);
    }
    status = await getPhotoStatus({ reportId, deviceFingerprint });
    if (photoStatusIsTerminal(status)) {
      return status;
    }
  }
  return status;
}

/**
 * @param {object} [options]
 * @param {typeof prepareReportPhotoForUpload} [options.preparePhoto]
 * @param {Function | null} [options.uploadPreparedFile] - Preferred over `uploadPhoto` when given.
 * @param {typeof uploadReportPhoto} [options.uploadPhoto=uploadReportPhoto] - Network call.
 * @param {typeof getReportPhotoStatus} [options.getPhotoStatus=getReportPhotoStatus] - Network call.
 * @param {typeof deletePreparedReportPhoto} [options.deletePreparedPhoto]
 * @param {(ms: number) => Promise<void>} [options.wait]
 * @param {number} [options.pollIntervalMs]
 * @param {number} [options.maxPollAttempts]
 * @returns {{uploadPhoto: (input: {reportId: string, deviceFingerprint: string, photoUri: string}) =>
 *   Promise<import('../models/photoState.js').PhotoStatus>, pollPhotoStatus: (input: object) =>
 *   Promise<import('../models/photoState.js').PhotoStatus | null>, deletePreparedPhoto: Function}}
 *   `uploadPhoto` returns the server status instead of failing when the status shows the upload
 *   arrived (terminal, or pending after an ambiguous failure).
 */
export function createReportPhotoUploadClient({
  preparePhoto = prepareReportPhotoForUpload,
  uploadPreparedFile = null,
  uploadPhoto = uploadReportPhoto,
  getPhotoStatus = getReportPhotoStatus,
  deletePreparedPhoto = deletePreparedReportPhoto,
  wait = sleep,
  pollIntervalMs = DEFAULT_PHOTO_POLL_INTERVAL_MS,
  maxPollAttempts = DEFAULT_PHOTO_POLL_ATTEMPTS,
} = {}) {
  async function uploadPreparedPhoto({ reportId, deviceFingerprint, photoUri }) {
    const prepared = await preparePhoto({ reportId, photoUri });
    try {
      const upload = uploadPreparedFile ?? uploadPhoto;
      return await upload({
        reportId,
        deviceFingerprint,
        photoUri: prepared.photoUri,
        filename: prepared.filename,
        mimeType: prepared.mimeType,
      });
    } catch (error) {
      try {
        const status = await getPhotoStatus({ reportId, deviceFingerprint });
        if (
          photoStatusIsTerminal(status) ||
          uploadFailureCanBeAmbiguous(error) && photoStatusIsPending(status)
        ) {
          return status;
        }
      } catch {
        // Keep the original upload failure when status cannot resolve ambiguity.
      }
      throw error;
    }
  }

  return {
    uploadPhoto: uploadPreparedPhoto,
    pollPhotoStatus: (input) =>
      pollPhotoStatusUntilFinal({
        ...input,
        getPhotoStatus,
        wait,
        pollIntervalMs,
        maxAttempts: maxPollAttempts,
      }),
    deletePreparedPhoto,
  };
}
