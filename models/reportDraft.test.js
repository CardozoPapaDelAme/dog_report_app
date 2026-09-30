import {
  REPORT_DRAFT_STATE,
  REPORT_DRAFT_STATES,
  assertReportDraftState,
  applySyncErrorToDraft,
  createLocalReportDraft,
  queueReportDraft,
  thawReportPayload,
} from './reportDraft.js';

function assert(value, message = 'Assertion failed') {
  if (!value) throw new Error(message);
}

const id = '00000000-0000-4000-8000-000000000001';
const locationSnapshot = {
  longitude: -107.63,
  latitude: 27.75,
  accuracy_meters: 12.5,
  mock_suspected: false,
  captured_at: '2026-09-28T20:00:00.000Z',
};
const reportFields = {
  incident_type: 'avistamiento_simple',
  sighting_type: 'solitario',
  details: { cantidad_aprox: 1, descripcion: 'Near plaza' },
  dog: { predominant_color: null, size: null, has_collar: null },
};

Deno.test('L6 draft model uses exactly the eight local queue states', () => {
  assert(JSON.stringify(REPORT_DRAFT_STATES) === JSON.stringify([
    'draft',
    'queued',
    'submitting',
    'uploading',
    'awaiting_processing',
    'retry_wait',
    'synced',
    'terminal_error',
  ]));
  for (const state of REPORT_DRAFT_STATES) assert(assertReportDraftState(state) === state);
  for (const state of ['pending_review', 'visible', 'hidden', 'deleted']) {
    let failed = false;
    try {
      assertReportDraftState(state);
    } catch (error) {
      failed = error.message.includes('server_moderation_state_is_not_local_queue_state');
    }
    assert(failed, `${state} must not be accepted as a local queue state`);
  }
});

Deno.test('L6 draft model creates UUID draft with location metadata and external photo URI only', () => {
  const draft = createLocalReportDraft({
    id,
    now: '2026-09-28T20:01:00.000Z',
    locationSnapshot,
    photo: { photoUri: 'file:///private/report.jpg', validation: { dogProbability: 0.9 } },
  });
  assert(draft.local_state === REPORT_DRAFT_STATE.DRAFT);
  assert(draft.id === id);
  assert(draft.photo_file_uri === 'file:///private/report.jpg');
  assert(draft.payload_json === null, 'draft should not freeze a payload before queueing');
  assert(draft.location_snapshot.accuracy_meters === 12.5);
  assert(draft.client_created_at === locationSnapshot.captured_at);
});

Deno.test('L6 draft model keeps mock suspicion when provider or detector reports it', () => {
  const provider = createLocalReportDraft({
    id,
    locationSnapshot: {
      ...locationSnapshot,
      mock_suspected: false,
      mocked_by_provider: true,
      mock_detector_suspected: false,
    },
  });
  assert(provider.location_snapshot.mock_suspected === true);

  const detector = createLocalReportDraft({
    id,
    locationSnapshot: {
      ...locationSnapshot,
      mock_suspected: false,
      mocked_by_provider: false,
      mock_detector_suspected: true,
    },
  });
  assert(detector.location_snapshot.mock_suspected === true);
});

Deno.test('L6 draft model freezes payload with same UUID and rejects server-owned fields', () => {
  const draft = createLocalReportDraft({ id, locationSnapshot });
  const queued = queueReportDraft(draft, {
    reportFields,
    deviceFingerprint: 'device-fingerprint-1',
    now: '2026-09-28T20:02:00.000Z',
  });
  const payload = thawReportPayload(queued.payload_json);
  assert(queued.local_state === REPORT_DRAFT_STATE.QUEUED);
  assert(payload.id === id);
  assert(payload.client_created_at === locationSnapshot.captured_at);
  assert(payload.location.mock_suspected === false);
  assert(payload.photo.expected === false);
  assert(payload.anti_abuse.device_fingerprint === 'device-fingerprint-1');

  let failed = false;
  try {
    queueReportDraft(draft, {
      reportFields: { ...reportFields, status: 'visible' },
      deviceFingerprint: 'device-fingerprint-1',
    });
  } catch (error) {
    failed = error.message.includes('unsupported_report_fields');
  }
  assert(failed, 'server moderation fields must not enter the queued payload');
});

Deno.test('L6 draft model schedules retry without changing frozen UUID or payload', () => {
  const draft = createLocalReportDraft({ id, locationSnapshot });
  const queued = queueReportDraft(draft, {
    reportFields,
    deviceFingerprint: 'device-fingerprint-1',
    now: '2026-09-28T20:02:00.000Z',
  });
  const retried = applySyncErrorToDraft(
    queued,
    Object.assign(new Error('offline'), { code: 'network_unavailable' }),
    { now: '2026-09-28T20:03:00.000Z' },
  );
  assert(retried.local_state === REPORT_DRAFT_STATE.RETRY_WAIT);
  assert(retried.retry_count === 1);
  assert(retried.id === queued.id);
  assert(retried.payload_json === queued.payload_json);

  const terminal = applySyncErrorToDraft(
    queued,
    Object.assign(new Error('conflict'), { code: 'report_id_payload_conflict', status: 409 }),
    { now: '2026-09-28T20:04:00.000Z' },
  );
  assert(terminal.local_state === REPORT_DRAFT_STATE.TERMINAL_ERROR);
});
