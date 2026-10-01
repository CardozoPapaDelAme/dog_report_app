import { buildReportPayload } from './reportPayload.js';

export const REPORT_DRAFT_STATES = Object.freeze([
  'draft',
  'queued',
  'submitting',
  'uploading',
  'awaiting_processing',
  'retry_wait',
  'synced',
  'terminal_error',
]);

export const REPORT_DRAFT_STATE = Object.freeze({
  DRAFT: 'draft',
  QUEUED: 'queued',
  SUBMITTING: 'submitting',
  UPLOADING: 'uploading',
  AWAITING_PROCESSING: 'awaiting_processing',
  RETRY_WAIT: 'retry_wait',
  SYNCED: 'synced',
  TERMINAL_ERROR: 'terminal_error',
});

export const SERVER_MODERATION_STATES = Object.freeze([
  'pending_review',
  'visible',
  'hidden',
  'deleted',
]);

const LOCAL_STATE_SET = new Set(REPORT_DRAFT_STATES);
const MODERATION_STATE_SET = new Set(SERVER_MODERATION_STATES);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DEFAULT_RETRY_BASE_MS = 30_000;
const DEFAULT_RETRY_MAX_MS = 15 * 60_000;

export { buildReportPayload } from './reportPayload.js';

function iso(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return new Date(value).toISOString();
  return new Date(value ?? Date.now()).toISOString();
}

function requirePlainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name}_must_be_object`);
  }
  return value;
}

function finiteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name}_must_be_number`);
  }
  return value;
}

function normalizeValidation(validation) {
  if (validation == null) return null;
  return requirePlainObject(validation, 'photo_validation');
}

export function isReportDraftState(value) {
  return LOCAL_STATE_SET.has(value);
}

export function assertReportDraftState(value) {
  if (MODERATION_STATE_SET.has(value)) {
    throw new Error(`server_moderation_state_is_not_local_queue_state:${value}`);
  }
  if (!isReportDraftState(value)) {
    throw new Error(`invalid_report_draft_state:${value}`);
  }
  return value;
}

export function assertDraftId(id) {
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
    throw new Error('invalid_report_draft_id');
  }
  return id;
}

export function normalizeLocationSnapshot(snapshot) {
  const value = requirePlainObject(snapshot, 'location_snapshot');
  const longitude = finiteNumber(value.longitude, 'longitude');
  const latitude = finiteNumber(value.latitude, 'latitude');
  const accuracyMeters = finiteNumber(
    value.accuracy_meters ?? value.accuracyMeters,
    'accuracy_meters',
  );
  const capturedAt = iso(value.captured_at ?? value.timestamp ?? Date.now());
  const mockedByProvider = Boolean(value.mocked_by_provider ?? value.mocked);
  const mockDetectorSuspected = Boolean(value.mock_detector_suspected);
  const explicitMock = value.mock_suspected ?? value.mockSuspected;
  const mockSuspected = Boolean(
    explicitMock || mockedByProvider || mockDetectorSuspected,
  );

  if (
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90 ||
    accuracyMeters <= 0 ||
    accuracyMeters > 99999.99
  ) {
    throw new Error('invalid_location_snapshot');
  }

  return {
    longitude,
    latitude,
    accuracy_meters: accuracyMeters,
    mock_suspected: mockSuspected,
    mocked_by_provider: mockedByProvider,
    mock_detector_suspected: mockDetectorSuspected,
    captured_at: capturedAt,
  };
}

export function locationForReportPayload(locationSnapshot) {
  const snapshot = normalizeLocationSnapshot(locationSnapshot);
  return {
    longitude: snapshot.longitude,
    latitude: snapshot.latitude,
    accuracy_meters: snapshot.accuracy_meters,
    mock_suspected: snapshot.mock_suspected,
  };
}

export function clientCreatedAtForReportPayload(locationSnapshot) {
  return normalizeLocationSnapshot(locationSnapshot).captured_at;
}

export function createLocalReportDraft({
  id,
  now = new Date(),
  photo = null,
  locationSnapshot,
}) {
  const createdAt = iso(now);
  const normalizedLocation = normalizeLocationSnapshot(locationSnapshot);
  const photoUri = photo?.photoUri ?? photo?.uri ?? null;

  return {
    id: assertDraftId(id),
    local_state: REPORT_DRAFT_STATE.DRAFT,
    created_at: createdAt,
    updated_at: createdAt,
    queued_at: null,
    payload_json: null,
    photo_file_uri: typeof photoUri === 'string' && photoUri ? photoUri : null,
    photo_validation: normalizeValidation(photo?.validation),
    location_snapshot: normalizedLocation,
    client_created_at: normalizedLocation.captured_at,
    retry_count: 0,
    next_retry_at: null,
    last_error: null,
    receipt: null,
    photo_status: null,
  };
}

export function freezeReportPayload(payload) {
  requirePlainObject(payload, 'payload');
  return JSON.stringify(payload);
}

export function thawReportPayload(payloadJson) {
  if (typeof payloadJson !== 'string' || !payloadJson) {
    throw new Error('missing_frozen_report_payload');
  }
  return JSON.parse(payloadJson);
}

export function queueReportDraft(draft, options) {
  requirePlainObject(draft, 'draft');
  if (draft.local_state !== REPORT_DRAFT_STATE.DRAFT) {
    throw new Error('only_draft_can_be_queued');
  }
  const now = iso(options?.now ?? new Date());
  const payload = buildReportPayload({
    draft,
    reportFields: options?.reportFields,
    deviceFingerprint: options?.deviceFingerprint,
    honeypotFilled: options?.honeypotFilled,
  });

  return {
    ...draft,
    local_state: REPORT_DRAFT_STATE.QUEUED,
    updated_at: now,
    queued_at: now,
    payload_json: freezeReportPayload(payload),
    retry_count: 0,
    next_retry_at: null,
    last_error: null,
  };
}

export function transitionReportDraft(draft, localState, { now = new Date(), ...updates } = {}) {
  requirePlainObject(draft, 'draft');
  assertReportDraftState(localState);
  return {
    ...draft,
    ...updates,
    local_state: localState,
    updated_at: iso(now),
  };
}

export function serializeSyncError(error) {
  return {
    code: error?.code ?? 'request_failed',
    message: error?.message ?? 'Request failed',
    status: Number.isInteger(error?.status) ? error.status : null,
    request_id: error?.requestId ?? null,
  };
}

export function isRetryableSyncError(error) {
  const status = error?.status;
  if (!Number.isInteger(status)) return true;
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

export function retryDelayMs({
  retryCount = 0,
  retryAfterSeconds = null,
  baseMs = DEFAULT_RETRY_BASE_MS,
  maxMs = DEFAULT_RETRY_MAX_MS,
} = {}) {
  const retryAfterMs = Number(retryAfterSeconds) * 1000;
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return Math.min(retryAfterMs, maxMs);
  }
  return Math.min(baseMs * 2 ** Math.max(0, retryCount), maxMs);
}

export function markDraftForRetry(draft, error, {
  now = new Date(),
  retryAfterSeconds = error?.retryAfterSeconds,
} = {}) {
  const currentRetryCount = Number.isInteger(draft.retry_count)
    ? draft.retry_count
    : 0;
  const currentTime = new Date(now).getTime();
  const delayMs = retryDelayMs({ retryCount: currentRetryCount, retryAfterSeconds });
  return transitionReportDraft(draft, REPORT_DRAFT_STATE.RETRY_WAIT, {
    now,
    retry_count: currentRetryCount + 1,
    next_retry_at: new Date(currentTime + delayMs).toISOString(),
    last_error: serializeSyncError(error),
  });
}

export function markDraftTerminalError(draft, error, { now = new Date() } = {}) {
  return transitionReportDraft(draft, REPORT_DRAFT_STATE.TERMINAL_ERROR, {
    now,
    next_retry_at: null,
    last_error: serializeSyncError(error),
  });
}

export function applySyncErrorToDraft(draft, error, options = {}) {
  return isRetryableSyncError(error)
    ? markDraftForRetry(draft, error, options)
    : markDraftTerminalError(draft, error, options);
}

export function photoStatusIsPending(status) {
  return Boolean(status?.photo_expected && !status?.processing_complete);
}

export function photoStatusAllowsLocalCompletion(status) {
  return Boolean(status?.local_cleanup_allowed);
}

export function draftSyncIsDue(draft, now = new Date()) {
  if (!draft || draft.local_state === REPORT_DRAFT_STATE.DRAFT) return false;
  if (
    draft.local_state === REPORT_DRAFT_STATE.SYNCED ||
    draft.local_state === REPORT_DRAFT_STATE.TERMINAL_ERROR
  ) {
    return false;
  }
  if (!draft.next_retry_at) return true;
  return new Date(draft.next_retry_at).getTime() <= new Date(now).getTime();
}
