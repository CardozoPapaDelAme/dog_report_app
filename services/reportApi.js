/**
 * @module services/reportApi
 * Anonymous client for report submission and photo upload: `POST /reports`, `POST /reports/{id}/photo`
 * (fetch multipart or native `uploadAsync`) and `GET /reports/{id}/photo-status`. Photo endpoints are
 * authorized by the `X-Device-Fingerprint` header.
 */
import { apiRequest, getApiBaseUrl } from './apiClient.js';

/** Returns a random UUID (or a timestamp-based fallback) for `X-Request-Id`. */
function createRequestId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/** Reads a header from a plain object, trying the given, lower and upper case names. */
function getHeader(headers, name) {
  if (!headers) return null;
  return headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()] ?? null;
}

/**
 * Returns `payload.data`; on non-2xx throws an Error with the API `code` (default `request_failed`),
 * `status`, `details`, `requestId` and `retryAfterSeconds` from `Retry-After`.
 */
async function readEnvelope(response, fallbackMessage) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.error?.message ?? fallbackMessage);
    error.code = payload?.error?.code ?? 'request_failed';
    error.status = response.status;
    error.details = payload?.error?.details;
    error.requestId = payload?.error?.request_id ?? response.headers.get('X-Request-Id');
    const retryAfter = Number(response.headers.get('Retry-After'));
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      error.retryAfterSeconds = retryAfter;
    }
    throw error;
  }

  return payload?.data;
}

/** Same contract as `readEnvelope` for a native `uploadAsync` result (`status`, `body`, `headers`). */
function readUploadEnvelope(result, fallbackMessage) {
  let payload;
  try {
    payload = result?.body ? JSON.parse(result.body) : null;
  } catch {
    payload = null;
  }

  const status = Number(result?.status);
  if (!Number.isInteger(status) || status < 200 || status >= 300) {
    const error = new Error(payload?.error?.message ?? fallbackMessage);
    error.code = payload?.error?.code ?? 'request_failed';
    error.status = Number.isInteger(status) ? status : null;
    error.details = payload?.error?.details;
    error.requestId = payload?.error?.request_id ?? getHeader(result?.headers, 'X-Request-Id');
    const retryAfter = Number(getHeader(result?.headers, 'Retry-After'));
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      error.retryAfterSeconds = retryAfter;
    }
    throw error;
  }

  return payload?.data;
}

/** Returns the fingerprint header; throws `invalid_device_fingerprint` (400) when shorter than 16 characters. */
function authorizationlessHeaders(deviceFingerprint) {
  if (typeof deviceFingerprint !== 'string' || deviceFingerprint.length < 16) {
    throw Object.assign(new Error('device_fingerprint_required'), {
      code: 'invalid_device_fingerprint',
      status: 400,
    });
  }
  return { 'X-Device-Fingerprint': deviceFingerprint };
}

/**
 * @param {object} options
 * @param {object} options.payload - Report body from `models/reportPayload.js`.
 * @param {typeof import('./apiClient.js').apiRequest} [request] - Injectable transport.
 * @returns {Promise<*>} The created report `data`.
 * @throws {Error} The API error (default `request_failed`) with `status`, `details`, `requestId`,
 *   `retryAfterSeconds`; transport errors.
 */
export async function submitReport({ payload }, request = apiRequest) {
  const response = await request('/reports', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return readEnvelope(response, 'Report submission failed');
}

/**
 * @param {object} options
 * @param {string} options.reportId
 * @param {string} options.deviceFingerprint - Fingerprint used when the report was submitted.
 * @param {typeof import('./apiClient.js').apiRequest} [request] - Injectable transport.
 * @returns {Promise<*>} Photo status `data`, interpreted by `models/photoState.js`.
 * @throws {Error} `invalid_device_fingerprint` (400); the API error (default `request_failed`); transport errors.
 */
export async function getReportPhotoStatus(
  { reportId, deviceFingerprint },
  request = apiRequest,
) {
  const response = await request(`/reports/${reportId}/photo-status`, {
    headers: authorizationlessHeaders(deviceFingerprint),
  });
  return readEnvelope(response, 'Photo status request failed');
}

/**
 * Builds a multipart body with a single `photo` part.
 * @param {object} [options]
 * @param {string} [options.photoUri] - Local photo URI (React Native file part).
 * @param {string} [options.filename='report-photo.jpg']
 * @param {string} [options.mimeType='image/jpeg']
 * @param {Blob | object} [options.filePart] - Replaces the URI-based part (e.g. a web Blob).
 * @returns {FormData}
 */
export function createPhotoFormData({
  photoUri,
  filename = 'report-photo.jpg',
  mimeType = 'image/jpeg',
  filePart,
} = {}) {
  const form = new FormData();
  form.append('photo', filePart ?? {
    uri: photoUri,
    name: filename,
    type: mimeType,
  });
  return form;
}

/**
 * Uploads the report photo with `fetch` multipart.
 * @param {object} options
 * @param {string} options.reportId
 * @param {string} options.deviceFingerprint
 * @param {string} [options.photoUri]
 * @param {string} [options.filename]
 * @param {string} [options.mimeType]
 * @param {Blob | object} [options.filePart]
 * @param {typeof import('./apiClient.js').apiRequest} [request] - Injectable transport.
 * @returns {Promise<*>} Upload result `data`.
 * @throws {Error} `invalid_device_fingerprint` (400); the API error (default `request_failed`); transport errors.
 */
export async function uploadReportPhoto(
  {
    reportId,
    deviceFingerprint,
    photoUri,
    filename,
    mimeType,
    filePart,
  },
  request = apiRequest,
) {
  const body = createPhotoFormData({ photoUri, filename, mimeType, filePart });
  const response = await request(`/reports/${reportId}/photo`, {
    method: 'POST',
    headers: authorizationlessHeaders(deviceFingerprint),
    contentType: null,
    body,
  });
  return readEnvelope(response, 'Photo upload failed');
}

/**
 * Uploads the report photo with the native file system `uploadAsync` (multipart).
 * @param {object} options
 * @param {string} options.reportId
 * @param {string} options.deviceFingerprint
 * @param {string} options.photoUri - Local photo URI.
 * @param {string} [options.mimeType='image/jpeg']
 * @param {object} options.fileSystem - `expo-file-system/legacy` module (`uploadAsync`, `FileSystemUploadType`).
 * @param {string} [options.requestId] - Defaults to a generated id.
 * @returns {Promise<*>} Upload result `data`.
 * @throws {Error} `native_photo_upload_unavailable` without `uploadAsync` or multipart support;
 *   `api_base_url_missing`; `invalid_device_fingerprint` (400); the API error (default `request_failed`).
 */
export async function uploadReportPhotoFile(
  {
    reportId,
    deviceFingerprint,
    photoUri,
    mimeType = 'image/jpeg',
    fileSystem,
    requestId = createRequestId(),
  },
) {
  if (typeof fileSystem?.uploadAsync !== 'function') {
    throw Object.assign(new Error('Native photo upload is unavailable'), {
      code: 'native_photo_upload_unavailable',
      status: null,
    });
  }
  const uploadType = fileSystem.FileSystemUploadType?.MULTIPART;
  if (uploadType == null) {
    throw Object.assign(new Error('Multipart photo upload is unavailable'), {
      code: 'native_photo_upload_unavailable',
      status: null,
    });
  }
  const result = await fileSystem.uploadAsync(
    `${getApiBaseUrl()}/reports/${reportId}/photo`,
    photoUri,
    {
      httpMethod: 'POST',
      uploadType,
      fieldName: 'photo',
      mimeType,
      headers: {
        Accept: 'application/json',
        'X-Request-Id': requestId,
        ...authorizationlessHeaders(deviceFingerprint),
      },
    },
  );
  return readUploadEnvelope(result, 'Photo upload failed');
}
