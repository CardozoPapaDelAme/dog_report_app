import {
  createReportPhotoUploadClient,
  pollPhotoStatusUntilFinal,
  prepareReportPhotoForUpload,
  resizeForLongestSide,
} from './useReportPhotoUpload.js';

function assert(value, message = 'Assertion failed') {
  if (!value) throw new Error(message);
}

const reportId = '00000000-0000-4000-8000-000000000001';

function processingStatus() {
  return {
    report_id: reportId,
    photo_expected: true,
    state: 'processing',
    rejection_code: null,
    processing_complete: false,
    upload_succeeded: false,
    local_cleanup_allowed: false,
  };
}

function approvedStatus() {
  return {
    report_id: reportId,
    photo_expected: true,
    state: 'approved',
    rejection_code: null,
    processing_complete: true,
    upload_succeeded: true,
    local_cleanup_allowed: true,
  };
}

Deno.test('L8 resize helper keeps the longest side at 1600 without distorting intent', () => {
  assert(JSON.stringify(resizeForLongestSide({ width: 4032, height: 3024 })) === JSON.stringify({ width: 1600 }));
  assert(JSON.stringify(resizeForLongestSide({ width: 1200, height: 2400 })) === JSON.stringify({ height: 1600 }));
  assert(resizeForLongestSide({ width: 1200, height: 900 }) === null);
});

Deno.test('L8 prepareReportPhotoForUpload writes a stable reduced JPEG per existing report', async () => {
  const files = new Set();
  const calls = [];
  const fileSystem = {
    cacheDirectory: 'file:///cache/',
    async getInfoAsync(uri) {
      return { exists: files.has(uri) };
    },
    async makeDirectoryAsync(uri, options) {
      calls.push(['mkdir', uri, options]);
    },
    async copyAsync({ from, to }) {
      calls.push(['copy', from, to]);
      files.add(to);
    },
    async deleteAsync(uri) {
      calls.push(['delete', uri]);
      files.delete(uri);
    },
  };
  const imageManipulator = {
    SaveFormat: { JPEG: 'jpeg' },
    ImageManipulator: {
      manipulate(uri) {
        const context = {
          uri,
          resizeAction: null,
          resize(action) {
            this.resizeAction = action;
            calls.push(['resize', action]);
            return this;
          },
          async renderAsync() {
            const size = this.resizeAction
              ? { width: 1600, height: 1200 }
              : { width: 4032, height: 3024 };
            return {
              ...size,
              async saveAsync(options) {
                calls.push(['save', options]);
                return { uri: 'file:///tmp/reduced.jpg', ...size };
              },
              release() {},
            };
          },
          release() {},
        };
        return context;
      },
    },
  };

  const prepared = await prepareReportPhotoForUpload({
    reportId,
    photoUri: 'file:///camera/original.heic',
    fileSystem,
    imageManipulator,
  });
  const expectedUri = `file:///cache/reports/photo-uploads/${reportId}.jpg`;

  assert(prepared.photoUri === expectedUri);
  assert(prepared.mimeType === 'image/jpeg');
  assert(calls.some((call) => call[0] === 'resize' && call[1].width === 1600));
  assert(calls.some((call) => call[0] === 'save' && call[1].format === 'jpeg'));
  assert(files.has(expectedUri));

  const replay = await prepareReportPhotoForUpload({
    reportId,
    photoUri: 'file:///camera/original.heic',
    fileSystem,
    imageManipulator,
  });
  assert(replay.photoUri === expectedUri);
  assert(calls.filter((call) => call[0] === 'resize').length === 1);
});

Deno.test('L8 prepareReportPhotoForUpload keeps the image ref alive until save completes', async () => {
  const files = new Set();
  const fileSystem = {
    cacheDirectory: 'file:///cache/',
    async getInfoAsync(uri) {
      return { exists: files.has(uri) };
    },
    async makeDirectoryAsync() {},
    async copyAsync({ to }) {
      files.add(to);
    },
    async deleteAsync(uri) {
      files.delete(uri);
    },
  };

  let releaseCount = 0;
  let resumeSave;
  let markSaveStarted;
  const saveGate = new Promise((resolve) => {
    resumeSave = resolve;
  });
  const saveStarted = new Promise((resolve) => {
    markSaveStarted = resolve;
  });
  const imageManipulator = {
    SaveFormat: { JPEG: 'jpeg' },
    ImageManipulator: {
      manipulate() {
        return {
          async renderAsync() {
            return {
              width: 1200,
              height: 900,
              async saveAsync() {
                markSaveStarted();
                await saveGate;
                return { uri: 'file:///tmp/reduced.jpg', width: 1200, height: 900 };
              },
              release() {
                releaseCount += 1;
              },
            };
          },
          release() {},
        };
      },
    },
  };

  const preparing = prepareReportPhotoForUpload({
    reportId,
    photoUri: 'file:///camera/original.jpg',
    fileSystem,
    imageManipulator,
  });

  await saveStarted;
  assert(releaseCount === 0, 'image ref must not be released while saveAsync is pending');
  resumeSave();
  await preparing;
  assert(releaseCount === 1, 'image ref should be released after saveAsync completes');
});

Deno.test('L8 polling stops on the first final photo status', async () => {
  const waits = [];
  const statuses = [processingStatus(), approvedStatus(), approvedStatus()];
  let statusCalls = 0;
  const final = await pollPhotoStatusUntilFinal({
    reportId,
    deviceFingerprint: 'device-fingerprint-1',
    initialStatus: processingStatus(),
    wait: async (ms) => waits.push(ms),
    maxAttempts: 5,
    getPhotoStatus: async () => {
      statusCalls += 1;
      return statuses.shift();
    },
  });

  assert(final.state === 'approved');
  assert(statusCalls === 2, 'polling must stop once the final state is observed');
  assert(JSON.stringify(waits) === JSON.stringify([2500, 2500]));
});

Deno.test('L8 polling preserves local retry when max attempts are still processing', async () => {
  let statusCalls = 0;
  const result = await pollPhotoStatusUntilFinal({
    reportId,
    deviceFingerprint: 'device-fingerprint-1',
    initialStatus: processingStatus(),
    wait: async () => {},
    maxAttempts: 3,
    getPhotoStatus: async () => {
      statusCalls += 1;
      return processingStatus();
    },
  });

  assert(result.state === 'processing');
  assert(statusCalls === 3);
});

Deno.test('L8 upload client resolves ambiguous upload errors through photo-status', async () => {
  const client = createReportPhotoUploadClient({
    preparePhoto: async () => ({
      photoUri: 'file:///cache/prepared.jpg',
      filename: `${reportId}.jpg`,
      mimeType: 'image/jpeg',
    }),
    uploadPhoto: async () => {
      throw Object.assign(new Error('network lost'), { code: 'network_unavailable' });
    },
    getPhotoStatus: async () => approvedStatus(),
  });

  const status = await client.uploadPhoto({
    reportId,
    deviceFingerprint: 'device-fingerprint-1',
    photoUri: 'file:///camera/original.jpg',
  });

  assert(status.state === 'approved');
});

Deno.test('L8 upload client uses native prepared-file upload when available', async () => {
  const calls = [];
  const client = createReportPhotoUploadClient({
    preparePhoto: async () => ({
      photoUri: 'file:///cache/prepared.jpg',
      filename: `${reportId}.jpg`,
      mimeType: 'image/jpeg',
    }),
    uploadPreparedFile: async (input) => {
      calls.push(input);
      return approvedStatus();
    },
    uploadPhoto: async () => {
      throw new Error('fetch upload fallback should not be used');
    },
  });

  const status = await client.uploadPhoto({
    reportId,
    deviceFingerprint: 'device-fingerprint-1',
    photoUri: 'file:///camera/original.jpg',
  });

  assert(status.state === 'approved');
  assert(calls.length === 1);
  assert(calls[0].photoUri === 'file:///cache/prepared.jpg');
  assert(calls[0].filename === `${reportId}.jpg`);
  assert(calls[0].mimeType === 'image/jpeg');
});

Deno.test('L8 upload client keeps typed server upload errors instead of pending status', async () => {
  const client = createReportPhotoUploadClient({
    preparePhoto: async () => ({
      photoUri: 'file:///cache/prepared.jpg',
      filename: `${reportId}.jpg`,
      mimeType: 'image/jpeg',
    }),
    uploadPhoto: async () => {
      throw Object.assign(new Error('storage unavailable'), {
        code: 'storage_unavailable',
        status: 503,
      });
    },
    getPhotoStatus: async () => processingStatus(),
  });

  try {
    await client.uploadPhoto({
      reportId,
      deviceFingerprint: 'device-fingerprint-1',
      photoUri: 'file:///camera/original.jpg',
    });
    throw new Error('Expected upload failure');
  } catch (error) {
    assert(error.code === 'storage_unavailable');
    assert(error.status === 503);
  }
});
