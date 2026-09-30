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

async function cleanupLocalPhoto(draft, deleteLocalPhoto) {
  if (draft.photo_file_uri) {
    await deleteLocalPhoto(draft.photo_file_uri);
  }
  return { ...draft, photo_file_uri: null };
}

export function createReportDraftQueueController({
  repository,
  createId,
  getLocationSnapshot,
  submitReport,
  uploadPhoto,
  getPhotoStatus,
  deleteLocalPhoto = async () => {},
  createDraftRecord,
  now = () => new Date(),
}) {
  if (!repository) throw new Error('repository_required');
  if (typeof createId !== 'function') throw new Error('create_id_required');
  if (typeof getLocationSnapshot !== 'function') throw new Error('location_provider_required');
  if (typeof submitReport !== 'function') throw new Error('submit_report_required');
  if (typeof uploadPhoto !== 'function') throw new Error('upload_photo_required');
  if (typeof getPhotoStatus !== 'function') throw new Error('photo_status_required');
  if (typeof deleteLocalPhoto !== 'function') throw new Error('delete_local_photo_required');
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
        draft = await cleanupLocalPhoto(draft, deleteLocalPhoto);
        return persist(
          repository,
          transitionReportDraft(draft, REPORT_DRAFT_STATE.SYNCED, {
            now: now(),
            next_retry_at: null,
          }),
        );
      }

      if (draft.local_state !== REPORT_DRAFT_STATE.AWAITING_PROCESSING) {
        const uploaded = await uploadPhoto({
          reportId: draft.id,
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
        photoStatus = await getPhotoStatus({
          reportId: draft.id,
          deviceFingerprint,
        });
      }

      if (photoStatusIsPending(photoStatus)) {
        return persist(
          repository,
          transitionReportDraft(draft, REPORT_DRAFT_STATE.AWAITING_PROCESSING, {
            now: now(),
            photo_status: photoStatus,
            next_retry_at: new Date(new Date(now()).getTime() + 30_000).toISOString(),
          }),
        );
      }

      if (photoStatusAllowsLocalCompletion(photoStatus)) {
        draft = await cleanupLocalPhoto(draft, deleteLocalPhoto);
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
