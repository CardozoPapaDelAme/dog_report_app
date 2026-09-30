import {
  createPhotoFormData,
  getReportPhotoStatus,
  submitReport,
  uploadReportPhoto,
} from './reportApi.js';

function assert(value, message = 'Assertion failed') {
  if (!value) throw new Error(message);
}

const payload = {
  id: '00000000-0000-4000-8000-000000000001',
  location: { longitude: -107.63, latitude: 27.75, accuracy_meters: 12.5, mock_suspected: false },
  incident_type: 'avistamiento_simple',
  sighting_type: 'solitario',
  details: { cantidad_aprox: 1 },
  dog: { predominant_color: null, size: null, has_collar: null },
  photo: { expected: false, client_check_passed: null },
  anti_abuse: { device_fingerprint: 'device-fingerprint-1', honeypot_filled: false },
  client_created_at: '2026-09-28T20:00:00.000Z',
};

Deno.test('L6 report API submits JSON report payload through public Hono route', async () => {
  const calls = [];
  const request = async (path, options) => {
    calls.push({ path, options });
    return Response.json({
      data: {
        report_id: payload.id,
        moderation_status: 'pending_review',
        photo_expected: false,
        photo_status_url: `/reports/${payload.id}/photo-status`,
      },
    }, { status: 201 });
  };
  const result = await submitReport({ payload }, request);
  assert(result.report_id === payload.id);
  assert(calls[0].path === '/reports');
  assert(calls[0].options.method === 'POST');
  assert(JSON.stringify(JSON.parse(calls[0].options.body)) === JSON.stringify(payload));
});

Deno.test('L6 report API preserves typed errors and Retry-After for retry logic', async () => {
  const request = async () => Response.json({
    error: {
      code: 'report_rate_limit_exceeded',
      message: 'Hourly report limit exceeded.',
      request_id: 'request-1',
    },
  }, {
    status: 429,
    headers: { 'Retry-After': '120' },
  });

  try {
    await submitReport({ payload }, request);
    throw new Error('Expected failure');
  } catch (error) {
    assert(error.status === 429);
    assert(error.code === 'report_rate_limit_exceeded');
    assert(error.retryAfterSeconds === 120);
    assert(error.requestId === 'request-1');
  }
});

Deno.test('L6 report API uploads photo as multipart without JSON content type', async () => {
  const calls = [];
  const filePart = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
  const request = async (path, options) => {
    calls.push({ path, options });
    return Response.json({
      data: {
        report_id: payload.id,
        photo_expected: true,
        state: 'processing',
        rejection_code: null,
        processing_complete: false,
        upload_succeeded: false,
        local_cleanup_allowed: false,
      },
    }, { status: 201 });
  };
  const result = await uploadReportPhoto({
    reportId: payload.id,
    deviceFingerprint: 'device-fingerprint-1',
    photoUri: 'file:///private/report.jpg',
    filePart,
  }, request);
  assert(result.state === 'processing');
  assert(calls[0].path === `/reports/${payload.id}/photo`);
  assert(calls[0].options.method === 'POST');
  assert(calls[0].options.headers['X-Device-Fingerprint'] === 'device-fingerprint-1');
  assert(calls[0].options.contentType === null);
  assert(calls[0].options.body instanceof FormData);
});

Deno.test('L6 report API reads photo status with submitting fingerprint', async () => {
  const calls = [];
  const request = async (path, options) => {
    calls.push({ path, options });
    return Response.json({
      data: {
        report_id: payload.id,
        photo_expected: true,
        state: 'approved',
        rejection_code: null,
        processing_complete: true,
        upload_succeeded: true,
        local_cleanup_allowed: true,
      },
    });
  };
  const result = await getReportPhotoStatus({
    reportId: payload.id,
    deviceFingerprint: 'device-fingerprint-1',
  }, request);
  assert(result.state === 'approved');
  assert(calls[0].path === `/reports/${payload.id}/photo-status`);
  assert(calls[0].options.headers['X-Device-Fingerprint'] === 'device-fingerprint-1');
});

Deno.test('L6 report API form helper keeps the photo as a multipart part only', () => {
  const form = createPhotoFormData({
    filePart: new Blob([new Uint8Array([1])], { type: 'image/jpeg' }),
  });
  assert(form instanceof FormData);
  assert(form.has('photo'));
});
