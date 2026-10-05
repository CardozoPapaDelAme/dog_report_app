import { createReportDraftQueueController } from './reportDraftQueueController.js';
import {
  REPORT_DRAFT_STATE,
  createLocalReportDraft,
  thawReportPayload,
} from '../models/reportDraft.js';

function assert(value, message = 'Assertion failed') {
  if (!value) throw new Error(message);
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function createMemoryRepository() {
  const rows = new Map();
  return {
    rows,
    async insert(draft) {
      rows.set(draft.id, clone(draft));
    },
    async update(draft) {
      rows.set(draft.id, clone(draft));
    },
    async getById(id) {
      return clone(rows.get(id));
    },
    async list({ states } = {}) {
      const values = [...rows.values()];
      return values
        .filter((draft) => !states || states.includes(draft.local_state))
        .map(clone);
    },
  };
}

const id = '00000000-0000-4000-8000-000000000001';
const serverReportId = '00000000-0000-4000-8000-000000000002';
const reportFields = {
  incident_type: 'avistamiento_simple',
  sighting_type: 'solitario',
  details: { cantidad_aprox: 1, descripcion: 'Near plaza' },
  dog: { predominant_color: null, size: null, has_collar: null },
};
const locationSnapshot = {
  longitude: -107.63,
  latitude: 27.75,
  accuracy_meters: 12.5,
  mock_suspected: true,
  mocked_by_provider: false,
  mock_detector_suspected: true,
  captured_at: '2026-09-28T20:00:00.000Z',
};

Deno.test('L6 queue controller preserves draft, UUID and exact payload when network fails mid-submit', async () => {
  const repository = createMemoryRepository();
  let now = new Date('2026-09-28T20:01:00.000Z');
  const submitted = [];
  const controller = createReportDraftQueueController({
    repository,
    createDraftRecord: createLocalReportDraft,
    createId: () => id,
    getLocationSnapshot: async () => locationSnapshot,
    submitReport: async ({ payload }) => {
      submitted.push(clone(payload));
      throw Object.assign(new Error('offline'), { code: 'network_unavailable' });
    },
    uploadPhoto: async () => {
      throw new Error('should_not_upload_without_report_receipt');
    },
    getPhotoStatus: async () => {
      throw new Error('should_not_poll_without_upload');
    },
    now: () => now,
  });

  const draft = await controller.createDraft({
    photo: { photoUri: 'file:///private/report.jpg', validation: { dogProbability: 0.95 } },
  });
  const queued = await controller.queueDraft(draft.id, {
    reportFields,
    deviceFingerprint: 'device-fingerprint-1',
  });
  const frozen = queued.payload_json;
  const failed = await controller.syncDraft(draft.id);

  assert(failed.local_state === REPORT_DRAFT_STATE.RETRY_WAIT);
  assert(failed.id === id);
  assert(failed.payload_json === frozen);
  assert(failed.photo_file_uri === 'file:///private/report.jpg');
  assert(!failed.payload_json.includes('file:///private/report.jpg'), 'payload JSON must not embed the image file');
  assert(submitted.length === 1);
  assert(submitted[0].id === id);

  now = new Date('2026-09-28T20:03:00.000Z');
  await controller.syncDraft(draft.id);
  assert(submitted.length === 2);
  assert(JSON.stringify(submitted[1]) === JSON.stringify(submitted[0]));
});

Deno.test('L6 queue controller reuses accepted report receipt and finishes photo status without changing UUID', async () => {
  const repository = createMemoryRepository();
  const calls = { submit: 0, upload: 0, status: 0 };
  const deleted = [];
  const controller = createReportDraftQueueController({
    repository,
    createDraftRecord: createLocalReportDraft,
    createId: () => id,
    getLocationSnapshot: async () => locationSnapshot,
    submitReport: async ({ payload }) => {
      calls.submit += 1;
      return {
        report_id: payload.id,
        moderation_status: 'pending_review',
        photo_expected: true,
        photo_status_url: `/reports/${payload.id}/photo-status`,
      };
    },
    uploadPhoto: async ({ reportId, photoUri }) => {
      calls.upload += 1;
      assert(reportId === id);
      assert(photoUri === 'file:///private/report.jpg');
      return {
        report_id: id,
        photo_expected: true,
        state: 'processing',
        rejection_code: null,
        processing_complete: false,
        upload_succeeded: false,
        local_cleanup_allowed: false,
      };
    },
    getPhotoStatus: async ({ reportId }) => {
      calls.status += 1;
      assert(reportId === id);
      return {
        report_id: id,
        photo_expected: true,
        state: 'approved',
        rejection_code: null,
        processing_complete: true,
        upload_succeeded: true,
        local_cleanup_allowed: true,
      };
    },
    deleteLocalPhoto: async (uri) => {
      deleted.push(uri);
    },
    now: () => new Date('2026-09-28T20:01:00.000Z'),
  });

  const draft = await controller.createDraft({ photo: { photoUri: 'file:///private/report.jpg' } });
  await controller.queueDraft(draft.id, {
    reportFields,
    deviceFingerprint: 'device-fingerprint-1',
  });
  const synced = await controller.syncDraft(draft.id);
  const payload = thawReportPayload(synced.payload_json);

  assert(synced.local_state === REPORT_DRAFT_STATE.SYNCED);
  assert(payload.id === id);
  assert(payload.location.mock_suspected === true);
  assert(calls.submit === 1);
  assert(calls.upload === 1);
  assert(calls.status === 1);
  assert(deleted.length === 1 && deleted[0] === 'file:///private/report.jpg');
  assert(synced.photo_file_uri === null);
  assert(synced.receipt.moderation_status === 'pending_review');
  assert(synced.photo_status.state === 'approved');
});

Deno.test('L8 queue controller sends photo only after L7 receipt and uses receipt report id', async () => {
  const repository = createMemoryRepository();
  const events = [];
  const deleted = [];
  const controller = createReportDraftQueueController({
    repository,
    createDraftRecord: createLocalReportDraft,
    createId: () => id,
    getLocationSnapshot: async () => locationSnapshot,
    submitReport: async ({ payload }) => {
      events.push(`submit:${payload.id}`);
      return {
        report_id: serverReportId,
        moderation_status: 'pending_review',
        photo_expected: true,
        photo_status_url: `/reports/${serverReportId}/photo-status`,
      };
    },
    uploadPhoto: async ({ reportId, deviceFingerprint, photoUri }) => {
      events.push(`upload:${reportId}`);
      assert(events[0] === `submit:${id}`, 'report must be submitted before photo upload');
      assert(reportId === serverReportId, 'photo upload must use the accepted report id');
      assert(deviceFingerprint === 'device-fingerprint-1');
      assert(photoUri === 'file:///private/report.jpg');
      return {
        report_id: serverReportId,
        photo_expected: true,
        state: 'approved',
        rejection_code: null,
        processing_complete: true,
        upload_succeeded: true,
        local_cleanup_allowed: true,
      };
    },
    pollPhotoStatus: async () => {
      throw new Error('final upload response must not be polled again');
    },
    deleteLocalPhoto: async (uri) => {
      deleted.push(uri);
    },
    now: () => new Date('2026-09-28T20:01:00.000Z'),
  });

  const draft = await controller.createDraft({ photo: { photoUri: 'file:///private/report.jpg' } });
  await controller.queueDraft(draft.id, {
    reportFields,
    deviceFingerprint: 'device-fingerprint-1',
  });
  const synced = await controller.syncDraft(draft.id);

  assert(JSON.stringify(events) === JSON.stringify([`submit:${id}`, `upload:${serverReportId}`]));
  assert(synced.local_state === REPORT_DRAFT_STATE.SYNCED);
  assert(synced.photo_file_uri === null);
  assert(deleted.length === 1 && deleted[0] === 'file:///private/report.jpg');
});

Deno.test('L8 queue controller keeps local photo when polling budget ends in processing', async () => {
  const repository = createMemoryRepository();
  const deleted = [];
  let pollCalls = 0;
  const controller = createReportDraftQueueController({
    repository,
    createDraftRecord: createLocalReportDraft,
    createId: () => id,
    getLocationSnapshot: async () => locationSnapshot,
    submitReport: async ({ payload }) => ({
      report_id: payload.id,
      moderation_status: 'pending_review',
      photo_expected: true,
      photo_status_url: `/reports/${payload.id}/photo-status`,
    }),
    uploadPhoto: async () => ({
      report_id: id,
      photo_expected: true,
      state: 'processing',
      rejection_code: null,
      processing_complete: false,
      upload_succeeded: false,
      local_cleanup_allowed: false,
    }),
    pollPhotoStatus: async ({ initialStatus }) => {
      pollCalls += 1;
      assert(initialStatus.state === 'processing');
      return {
        report_id: id,
        photo_expected: true,
        state: 'processing',
        rejection_code: null,
        processing_complete: false,
        upload_succeeded: false,
        local_cleanup_allowed: false,
      };
    },
    deleteLocalPhoto: async (uri) => {
      deleted.push(uri);
    },
    now: () => new Date('2026-09-28T20:01:00.000Z'),
  });

  const draft = await controller.createDraft({ photo: { photoUri: 'file:///private/report.jpg' } });
  await controller.queueDraft(draft.id, {
    reportFields,
    deviceFingerprint: 'device-fingerprint-1',
  });
  const pending = await controller.syncDraft(draft.id);

  assert(pollCalls === 1);
  assert(pending.local_state === REPORT_DRAFT_STATE.AWAITING_PROCESSING);
  assert(pending.photo_file_uri === 'file:///private/report.jpg');
  assert(pending.photo_status.state === 'processing');
  assert(pending.next_retry_at === '2026-09-28T20:01:30.000Z');
  assert(deleted.length === 0, 'local photo must not be deleted before a final status');
});

Deno.test('L7 queue controller does not resubmit a synced draft', async () => {
  const repository = createMemoryRepository();
  let submitCalls = 0;
  const controller = createReportDraftQueueController({
    repository,
    createDraftRecord: createLocalReportDraft,
    createId: () => id,
    getLocationSnapshot: async () => locationSnapshot,
    submitReport: async ({ payload }) => {
      submitCalls += 1;
      return {
        report_id: payload.id,
        moderation_status: 'pending_review',
        photo_expected: false,
        photo_status_url: `/reports/${payload.id}/photo-status`,
      };
    },
    uploadPhoto: async () => {
      throw new Error('should_not_upload_without_photo');
    },
    getPhotoStatus: async () => {
      throw new Error('should_not_poll_without_photo');
    },
    now: () => new Date('2026-09-28T20:01:00.000Z'),
  });

  const draft = await controller.createDraft();
  await controller.queueDraft(draft.id, {
    reportFields,
    deviceFingerprint: 'device-fingerprint-1',
  });
  const synced = await controller.syncDraft(draft.id);
  const replay = await controller.syncDraft(draft.id);

  assert(synced.local_state === REPORT_DRAFT_STATE.SYNCED);
  assert(replay.local_state === REPORT_DRAFT_STATE.SYNCED);
  assert(submitCalls === 1);
  assert(replay.payload_json === synced.payload_json);
});
