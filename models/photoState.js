/**
 * @module models/photoState
 * Interpretation of the server photo status (`GET /reports/{id}/photo-status`) for upload polling and
 * local cleanup.
 */
export const PHOTO_UPLOAD_STATES = Object.freeze([
  'processing',
  'approved',
  'rejected',
  'purge_pending',
  'purged',
]);

export const PHOTO_UPLOAD_STATE = Object.freeze({
  PROCESSING: 'processing',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PURGE_PENDING: 'purge_pending',
  PURGED: 'purged',
});

export const PHOTO_TERMINAL_STATES = Object.freeze([
  PHOTO_UPLOAD_STATE.APPROVED,
  PHOTO_UPLOAD_STATE.REJECTED,
  PHOTO_UPLOAD_STATE.PURGE_PENDING,
  PHOTO_UPLOAD_STATE.PURGED,
]);

export const DEFAULT_PHOTO_POLL_INTERVAL_MS = 2500;
export const DEFAULT_PHOTO_POLL_ATTEMPTS = 20;

const TERMINAL_STATE_SET = new Set(PHOTO_TERMINAL_STATES);

/**
 * @typedef {object} PhotoStatus
 * @property {boolean} photo_expected
 * @property {boolean} processing_complete
 * @property {string} [state] - One of {@link PHOTO_UPLOAD_STATES}.
 * @property {boolean} [local_cleanup_allowed]
 * @property {boolean} [upload_succeeded]
 */
/**
 * @param {PhotoStatus | null | undefined} status
 * @returns {boolean} Processing is complete (in a terminal state when a photo was expected).
 */
export function photoStatusIsTerminal(status) {
  if (!status || typeof status !== 'object') return false;
  if (status.photo_expected === false) {
    return status.processing_complete === true;
  }
  return (
    status.photo_expected === true &&
    status.processing_complete === true &&
    TERMINAL_STATE_SET.has(status.state)
  );
}

/**
 * @param {PhotoStatus | null | undefined} status
 * @returns {boolean} A photo is expected and still being processed.
 */
export function photoStatusIsPending(status) {
  if (!status || typeof status !== 'object') return false;
  if (photoStatusIsTerminal(status)) return false;
  return status.photo_expected === true && status.processing_complete !== true;
}

/**
 * @param {PhotoStatus | null | undefined} status
 * @returns {boolean} Terminal and the server allows deleting the local copy.
 */
export function photoStatusAllowsLocalCompletion(status) {
  return photoStatusIsTerminal(status) && status.local_cleanup_allowed === true;
}

/**
 * @param {PhotoStatus | null | undefined} status
 * @returns {boolean} Terminal, approved and uploaded.
 */
export function photoStatusSucceeded(status) {
  return (
    photoStatusIsTerminal(status) &&
    status.state === PHOTO_UPLOAD_STATE.APPROVED &&
    status.upload_succeeded === true
  );
}
