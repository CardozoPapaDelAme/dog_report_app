/**
 * @module models/reportDraft
 * Offline report draft queue model: local states, location snapshot normalization, draft creation,
 * payload freezing, state transitions, retry backoff and queue summary. Persisted by
 * `dao/reportDraftDao.js`. Local queue states are distinct from server moderation states.
 */
import { buildReportPayload } from './reportPayload.js';

/** Local sync states of a draft, in lifecycle order. */
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

/** States that still need synchronization with the server. */
export const REPORT_DRAFT_PENDING_STATES = Object.freeze([
  REPORT_DRAFT_STATE.QUEUED,
  REPORT_DRAFT_STATE.SUBMITTING,
  REPORT_DRAFT_STATE.UPLOADING,
  REPORT_DRAFT_STATE.AWAITING_PROCESSING,
  REPORT_DRAFT_STATE.RETRY_WAIT,
]);

/** Server report statuses; never valid as a local queue state. */
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
export {
  photoStatusAllowsLocalCompletion,
  photoStatusIsPending,
  photoStatusIsTerminal,
} from './photoState.js';

/** Converts a Date, date string, timestamp or nullish (now) to an ISO 8601 string. */
function iso(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return new Date(value).toISOString();
  return new Date(value ?? Date.now()).toISOString();
}

/** Throws `<name>_must_be_object` unless `value` is a non-array object. */
function requirePlainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name}_must_be_object`);
  }
  return value;
}

/** Throws `<name>_must_be_number` unless `value` is a finite number. */
function finiteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name}_must_be_number`);
  }
  return value;
}

/** Returns `null` for nullish validation, otherwise requires a plain object. */
function normalizeValidation(validation) {
  if (validation == null) return null;
  return requirePlainObject(validation, 'photo_validation');
}

/**
 * @param {unknown} value
 * @returns {boolean} Whether `value` is one of {@link REPORT_DRAFT_STATES}.
 */
export function isReportDraftState(value) {
  return LOCAL_STATE_SET.has(value);
}

/**
 * @param {unknown} value
 * @returns {string} The valid local state.
 * @throws {Error} `server_moderation_state_is_not_local_queue_state:<value>` or `invalid_report_draft_state:<value>`.
 */
export function assertReportDraftState(value) {
  if (MODERATION_STATE_SET.has(value)) {
    throw new Error(`server_moderation_state_is_not_local_queue_state:${value}`);
  }
  if (!isReportDraftState(value)) {
    throw new Error(`invalid_report_draft_state:${value}`);
  }
  return value;
}

/**
 * @param {unknown} id
 * @returns {string} The id when it is a lowercase UUID.
 * @throws {Error} `invalid_report_draft_id`.
 */
export function assertDraftId(id) {
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
    throw new Error('invalid_report_draft_id');
  }
  return id;
}

/**
 * @typedef {object} LocationSnapshot
 * @property {number} longitude
 * @property {number} latitude
 * @property {number} accuracy_meters - Greater than 0 and at most 99999.99.
 * @property {boolean} mock_suspected - Explicit flag, provider mock or detector suspicion.
 * @property {boolean} mocked_by_provider
 * @property {boolean} mock_detector_suspected
 * @property {string} captured_at - ISO 8601.
 */
/**
 * Normalizes a device location (snake_case or camelCase fields) into a stored snapshot.
 * @param {object} snapshot
 * @returns {LocationSnapshot}
 * @throws {Error} `location_snapshot_must_be_object`, `<field>_must_be_number` or `invalid_location_snapshot`.
 */
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

/**
 * @param {object} locationSnapshot
 * @returns {{longitude: number, latitude: number, accuracy_meters: number, mock_suspected: boolean}}
 * @throws {Error} See {@link normalizeLocationSnapshot}.
 */
export function locationForReportPayload(locationSnapshot) {
  const snapshot = normalizeLocationSnapshot(locationSnapshot);
  return {
    longitude: snapshot.longitude,
    latitude: snapshot.latitude,
    accuracy_meters: snapshot.accuracy_meters,
    mock_suspected: snapshot.mock_suspected,
  };
}

/**
 * @param {object} locationSnapshot
 * @returns {string} Capture time as ISO 8601.
 * @throws {Error} See {@link normalizeLocationSnapshot}.
 */
export function clientCreatedAtForReportPayload(locationSnapshot) {
  return normalizeLocationSnapshot(locationSnapshot).captured_at;
}

/**
 * @typedef {object} ReportDraft
 * @property {string} id - Client-generated UUID, reused as the report id.
 * @property {string} local_state - One of {@link REPORT_DRAFT_STATES}.
 * @property {string} created_at
 * @property {string} updated_at
 * @property {string | null} queued_at
 * @property {string | null} payload_json - Frozen report payload, set when queued.
 * @property {string | null} photo_file_uri
 * @property {object | null} photo_validation - On-device validation result (may include `dog_color`).
 * @property {LocationSnapshot} location_snapshot
 * @property {string} client_created_at
 * @property {number} retry_count
 * @property {string | null} next_retry_at
 * @property {{code: string, message: string, status: number | null, request_id: string | null} | null} last_error
 * @property {object | null} receipt - Server submission result.
 * @property {object | null} photo_status - Last server photo status.
 */
/**
 * @param {object} options
 * @param {string} options.id - Lowercase UUID.
 * @param {Date | string | number} [options.now=new Date()]
 * @param {{photoUri?: string, uri?: string, validation?: object} | null} [options.photo=null]
 * @param {object} options.locationSnapshot
 * @returns {ReportDraft} A draft in state `draft`.
 * @throws {Error} `invalid_report_draft_id`, location errors, or `photo_validation_must_be_object`.
 */
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

/**
 * @param {object} payload
 * @returns {string} JSON text.
 * @throws {Error} `payload_must_be_object`.
 */
export function freezeReportPayload(payload) {
  requirePlainObject(payload, 'payload');
  return JSON.stringify(payload);
}

/**
 * @param {string} payloadJson
 * @returns {object}
 * @throws {Error} `missing_frozen_report_payload`, or a SyntaxError for invalid JSON.
 */
export function thawReportPayload(payloadJson) {
  if (typeof payloadJson !== 'string' || !payloadJson) {
    throw new Error('missing_frozen_report_payload');
  }
  return JSON.parse(payloadJson);
}

/**
 * Builds and freezes the report payload and moves the draft to `queued`.
 * @param {ReportDraft} draft - Must be in state `draft`.
 * @param {object} options
 * @param {object} options.reportFields - From `validateReportFormDraft`.
 * @param {string} options.deviceFingerprint
 * @param {boolean} [options.honeypotFilled]
 * @param {Date | string | number} [options.now]
 * @returns {ReportDraft}
 * @throws {Error} `only_draft_can_be_queued`, or payload errors from `buildReportPayload`.
 */
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

/**
 * @param {ReportDraft} draft
 * @param {string} localState - Target local state.
 * @param {object} [updates] - Extra fields to merge; `now` sets `updated_at`.
 * @returns {ReportDraft}
 * @throws {Error} `draft_must_be_object` or an invalid state error.
 */
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

/**
 * @param {unknown} error
 * @returns {{code: string, message: string, status: number | null, request_id: string | null}}
 */
export function serializeSyncError(error) {
  return {
    code: error?.code ?? 'request_failed',
    message: error?.message ?? 'Request failed',
    status: Number.isInteger(error?.status) ? error.status : null,
    request_id: error?.requestId ?? null,
  };
}

/**
 * @param {unknown} error
 * @returns {boolean} `true` without an HTTP status (transport failure), for 408, 429 and 5xx.
 */
export function isRetryableSyncError(error) {
  const status = error?.status;
  if (!Number.isInteger(status)) return true;
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

/**
 * Exponential backoff, or `Retry-After` when provided, capped at `maxMs`.
 * @param {object} [options]
 * @param {number} [options.retryCount=0]
 * @param {number | null} [options.retryAfterSeconds=null]
 * @param {number} [options.baseMs=30000]
 * @param {number} [options.maxMs=900000]
 * @returns {number}
 */
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

/**
 * Moves the draft to `retry_wait`, increments `retry_count` and schedules `next_retry_at`.
 * @param {ReportDraft} draft
 * @param {unknown} error
 * @param {{now?: Date | string | number, retryAfterSeconds?: number}} [options]
 * @returns {ReportDraft}
 */
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

/**
 * @param {ReportDraft} draft
 * @param {unknown} error
 * @param {{now?: Date | string | number}} [options]
 * @returns {ReportDraft} The draft in `terminal_error`.
 */
export function markDraftTerminalError(draft, error, { now = new Date() } = {}) {
  return transitionReportDraft(draft, REPORT_DRAFT_STATE.TERMINAL_ERROR, {
    now,
    next_retry_at: null,
    last_error: serializeSyncError(error),
  });
}

/**
 * Schedules a retry for retryable errors, otherwise marks a terminal error.
 * @param {ReportDraft} draft
 * @param {unknown} error
 * @param {object} [options]
 * @returns {ReportDraft}
 */
export function applySyncErrorToDraft(draft, error, options = {}) {
  return isRetryableSyncError(error)
    ? markDraftForRetry(draft, error, options)
    : markDraftTerminalError(draft, error, options);
}

/**
 * @param {ReportDraft | null | undefined} draft
 * @param {Date | string | number} [now=new Date()]
 * @returns {boolean} Whether a queued, non-final draft may be synced now.
 */
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

/**
 * @param {ReportDraft[]} [drafts=[]]
 * @param {{now?: Date | string | number, isSyncing?: boolean}} [options]
 * @returns {{pendingCount: number, dueCount: number, terminalCount: number, nextRetryAt: string | null,
 *   isSyncing: boolean, canRetryNow: boolean}}
 */
export function summarizeReportDraftQueue(drafts = [], {
  now = new Date(),
  isSyncing = false,
} = {}) {
  const currentTime = new Date(now).getTime();
  let pendingCount = 0;
  let dueCount = 0;
  let terminalCount = 0;
  let nextRetryAt = null;

  for (const draft of drafts ?? []) {
    if (!draft) continue;
    if (draft.local_state === REPORT_DRAFT_STATE.TERMINAL_ERROR) {
      terminalCount += 1;
      continue;
    }
    if (!REPORT_DRAFT_PENDING_STATES.includes(draft.local_state)) continue;

    pendingCount += 1;
    if (draftSyncIsDue(draft, now)) dueCount += 1;

    if (draft.next_retry_at) {
      const retryTime = new Date(draft.next_retry_at).getTime();
      if (Number.isFinite(retryTime) && retryTime > currentTime) {
        if (!nextRetryAt || retryTime < new Date(nextRetryAt).getTime()) {
          nextRetryAt = new Date(retryTime).toISOString();
        }
      }
    }
  }

  const syncing = Boolean(isSyncing);
  return {
    pendingCount,
    dueCount,
    terminalCount,
    nextRetryAt,
    isSyncing: syncing,
    canRetryNow: pendingCount > 0 && dueCount > 0 && !syncing,
  };
}
