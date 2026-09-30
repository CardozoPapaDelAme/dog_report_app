import { apiRequest } from './apiClient.js';

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

function authorizationlessHeaders(deviceFingerprint) {
  if (typeof deviceFingerprint !== 'string' || deviceFingerprint.length < 16) {
    throw Object.assign(new Error('device_fingerprint_required'), {
      code: 'invalid_device_fingerprint',
      status: 400,
    });
  }
  return { 'X-Device-Fingerprint': deviceFingerprint };
}

export async function submitReport({ payload }, request = apiRequest) {
  const response = await request('/reports', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return readEnvelope(response, 'Report submission failed');
}

export async function getReportPhotoStatus(
  { reportId, deviceFingerprint },
  request = apiRequest,
) {
  const response = await request(`/reports/${reportId}/photo-status`, {
    headers: authorizationlessHeaders(deviceFingerprint),
  });
  return readEnvelope(response, 'Photo status request failed');
}

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
