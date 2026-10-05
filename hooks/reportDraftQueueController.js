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
const PHOTO_PROCESSING_RETRY_MS = 30_000;

function fingerprintFromPayload(payload) {
  return payload?.anti_abuse?.device_fingerprint;
}

function reportReceiptIsAccepted(receipt) {
  return typeof receipt?.report_id === 'string';
}

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

function createSingleStatusPoller(getPhotoStatus) {
  return async function pollPhotoStatus({ reportId, deviceFingerprint, initialStatus }) {
    if (!photoStatusIsPending(initialStatus)) return initialStatus;
    return getPhotoStatus({ reportId, deviceFingerprint });
  };
}

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
