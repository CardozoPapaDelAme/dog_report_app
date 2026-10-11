/**
 * @module hooks/reportDraftQueueController
 * Framework-free controller for the offline report draft queue: creates drafts with a location
 * snapshot, queues them with a frozen payload, and synchronizes them (submit report, upload photo,
 * poll photo status, clean up local files), persisting every state transition and applying retry
 * backoff on failure.
 */
import {
  REPORT_DRAFT_STATE,
  applySyncErrorToDraft,
  draftSyncIsDue,
  photoStatusAllowsLocalCompletion,
  photoStatusIsPending,
  queueReportDraft,
  thawReportPayload,
  transitionReportDraft,
} from '../models/reportDraft.js';

const SYNCABLE_STATES = Object.freeze([
  REPORT_DRAFT_STATE.QUEUED,
  REPORT_DRAFT_STATE.SUBMITTING,
  REPORT_DRAFT_STATE.UPLOADING,
  REPORT_DRAFT_STATE.AWAITING_PROCESSING,
  REPORT_DRAFT_STATE.RETRY_WAIT,
]);
/** Delay before re-checking a photo that is still processing. */
const PHOTO_PROCESSING_RETRY_MS = 30_000;

function fingerprintFromPayload(payload) {
  return payload?.anti_abuse?.device_fingerprint;
}

function reportReceiptIsAccepted(receipt) {
  return typeof receipt?.report_id === 'string';
}

/** @throws {Error} `invalid_response` when the receipt has no string `report_id`. */
function normalizeAcceptedReceipt(receipt, fallbackReportId) {
  if (!reportReceiptIsAccepted(receipt)) {
    throw Object.assign(new Error('invalid_report_receipt'), {
      code: 'invalid_response',
      status: 500,
    });
  }
  return {
    ...receipt,
    report_id: receipt.report_id ?? fallbackReportId,
  };
}

async function persist(repository, draft) {
  await repository.update(draft);
  return draft;
}

function reportIdFromReceipt(draft) {
  const reportId = draft?.receipt?.report_id;
  if (typeof reportId !== 'string' || !reportId) {
    throw Object.assign(new Error('report_required_before_photo_upload'), {
      code: 'invalid_report_receipt',
      status: 500,
    });
  }
  return reportId;
}

/** Deletes the local and prepared photo files and clears `photo_file_uri`. */
async function cleanupLocalPhoto(draft, deleteLocalPhoto, deletePreparedPhoto) {
  const reportId = draft?.receipt?.report_id ?? draft?.id;
  if (draft.photo_file_uri) {
    await deleteLocalPhoto(draft.photo_file_uri);
  }
  if (reportId) {
    await deletePreparedPhoto({ reportId });
  }
  return { ...draft, photo_file_uri: null };
}

/** Fallback poller that performs at most one status request for a pending photo. */
function createSingleStatusPoller(getPhotoStatus) {
  return async function pollPhotoStatus({ reportId, deviceFingerprint, initialStatus }) {
    if (!photoStatusIsPending(initialStatus)) return initialStatus;
    return getPhotoStatus({ reportId, deviceFingerprint });
  };
}

/**
 * @param {object} options
 * @param {{insert: Function, update: Function, getById: Function, list: Function}} options.repository
 *   Draft repository (see `dao/reportDraftDao.js`).
 * @param {() => string} options.createId - Lowercase UUID generator.
 * @param {() => Promise<object>} options.getLocationSnapshot
 * @param {(input: {payload: object}) => Promise<object>} options.submitReport - Report submission (network call).
 * @param {(input: {reportId: string, deviceFingerprint: string, photoUri: string}) =>
 *   Promise<import('../models/photoState.js').PhotoStatus>} options.uploadPhoto - Photo upload (network call).
 * @param {Function} [options.getPhotoStatus] - Required when `pollPhotoStatus` is not given.
 * @param {(input: {reportId: string, deviceFingerprint: string,
 *   initialStatus: import('../models/photoState.js').PhotoStatus}) =>
 *   Promise<import('../models/photoState.js').PhotoStatus>} [options.pollPhotoStatus]
 * @param {(uri: string) => Promise<void>} [options.deleteLocalPhoto]
 * @param {(input: {reportId: string}) => Promise<void>} [options.deletePreparedPhoto]
 * @param {Function} options.createDraftRecord - Usually `createLocalReportDraft`.
 * @param {() => Date} [options.now]
 * @returns {{
 *   createDraft: (input?: {photo?: object | null}) => Promise<import('../models/reportDraft.js').ReportDraft>,
 *   queueDraft: (id: string, options: object) => Promise<import('../models/reportDraft.js').ReportDraft>,
 *   syncDraft: (id: string) => Promise<import('../models/reportDraft.js').ReportDraft | null>,
 *   syncDueDrafts: () => Promise<Array<import('../models/reportDraft.js').ReportDraft | null>>}}
 *   `syncDraft` returns the draft unchanged when it is missing or not due, and never rejects for
 *   sync failures: they are persisted on the draft via `applySyncErrorToDraft`.
 * @throws {Error} A `*_required` code when a dependency is missing.
 */
export function createReportDraftQueueController({
  repository,
  createId,
  getLocationSnapshot,
  submitReport,
  uploadPhoto,
  getPhotoStatus,
  pollPhotoStatus,
  deleteLocalPhoto = async () => {},
  deletePreparedPhoto = async () => {},
  createDraftRecord,
  now = () => new Date(),
}) {
  if (!repository) throw new Error('repository_required');
  if (typeof createId !== 'function') throw new Error('create_id_required');
  if (typeof getLocationSnapshot !== 'function') throw new Error('location_provider_required');
  if (typeof submitReport !== 'function') throw new Error('submit_report_required');
  if (typeof uploadPhoto !== 'function') throw new Error('upload_photo_required');
  if (typeof getPhotoStatus !== 'function' && typeof pollPhotoStatus !== 'function') {
    throw new Error('photo_status_required');
  }
  const statusPoller = pollPhotoStatus ?? createSingleStatusPoller(getPhotoStatus);
  if (typeof statusPoller !== 'function') throw new Error('photo_status_required');
  if (typeof deleteLocalPhoto !== 'function') throw new Error('delete_local_photo_required');
  if (typeof deletePreparedPhoto !== 'function') throw new Error('delete_prepared_photo_required');
  if (typeof createDraftRecord !== 'function') throw new Error('draft_factory_required');

  async function createDraft({ photo = null } = {}) {
    const draft = createDraftRecord({
      id: createId(),
      now: now(),
      photo,
      locationSnapshot: await getLocationSnapshot(),
    });
    await repository.insert(draft);
    return draft;
  }

  async function queueDraft(id, options) {
    const draft = await repository.getById(id);
    if (!draft) throw new Error('draft_not_found');
    const queued = queueReportDraft(draft, { ...options, now: now() });
    await repository.update(queued);
    return queued;
  }

  async function syncDraft(id) {
    let draft = await repository.getById(id);
    if (!draft || !draftSyncIsDue(draft, now())) {
      return draft;
    }

    const payload = thawReportPayload(draft.payload_json);
    const deviceFingerprint = fingerprintFromPayload(payload);

    try {
      if (!draft.receipt) {
        draft = await persist(
          repository,
          transitionReportDraft(draft, REPORT_DRAFT_STATE.SUBMITTING, { now: now() }),
        );
        const receipt = normalizeAcceptedReceipt(
          await submitReport({ payload }),
          draft.id,
        );
        draft = await persist(
          repository,
          transitionReportDraft(draft, REPORT_DRAFT_STATE.UPLOADING, {
            now: now(),
            receipt,
            retry_count: 0,
            next_retry_at: null,
            last_error: null,
          }),
        );
      }

      if (!draft.photo_file_uri || payload.photo?.expected !== true) {
        draft = await cleanupLocalPhoto(draft, deleteLocalPhoto, deletePreparedPhoto);
        return persist(
          repository,
          transitionReportDraft(draft, REPORT_DRAFT_STATE.SYNCED, {
            now: now(),
            next_retry_at: null,
          }),
        );
      }

      const reportId = reportIdFromReceipt(draft);
      if (draft.local_state !== REPORT_DRAFT_STATE.AWAITING_PROCESSING) {
        const uploaded = await uploadPhoto({
          reportId,
          deviceFingerprint,
          photoUri: draft.photo_file_uri,
        });
        draft = await persist(
          repository,
          transitionReportDraft(draft, REPORT_DRAFT_STATE.AWAITING_PROCESSING, {
            now: now(),
            photo_status: uploaded,
            retry_count: 0,
            next_retry_at: null,
            last_error: null,
          }),
        );
      }

      let photoStatus = draft.photo_status;
      if (photoStatusIsPending(photoStatus)) {
        photoStatus = await statusPoller({
          reportId,
          deviceFingerprint,
          initialStatus: photoStatus,
        });
      }

      if (photoStatusIsPending(photoStatus)) {
        return persist(
          repository,
          transitionReportDraft(draft, REPORT_DRAFT_STATE.AWAITING_PROCESSING, {
            now: now(),
            photo_status: photoStatus,
            next_retry_at: new Date(new Date(now()).getTime() + PHOTO_PROCESSING_RETRY_MS).toISOString(),
          }),
        );
      }

      if (photoStatusAllowsLocalCompletion(photoStatus)) {
        draft = await cleanupLocalPhoto(draft, deleteLocalPhoto, deletePreparedPhoto);
        return persist(
          repository,
          transitionReportDraft(draft, REPORT_DRAFT_STATE.SYNCED, {
            now: now(),
            photo_status: photoStatus,
            next_retry_at: null,
          }),
        );
      }

      throw Object.assign(new Error('photo_status_not_completable'), {
        code: 'invalid_response',
        status: 500,
      });
    } catch (error) {
      return persist(repository, applySyncErrorToDraft(draft, error, { now: now() }));
    }
  }

  async function syncDueDrafts() {
    const drafts = await repository.list({ states: SYNCABLE_STATES });
    const results = [];
    for (const draft of drafts) {
      if (draftSyncIsDue(draft, now())) {
        results.push(await syncDraft(draft.id));
      }
    }
    return results;
  }

  return {
    createDraft,
    queueDraft,
    syncDraft,
    syncDueDrafts,
  };
}
