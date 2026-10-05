import { useCallback, useRef, useState } from 'react';

import { REPORT_DRAFT_STATE, thawReportPayload } from '../models/reportDraft.js';
import {
  honeypotFilledFromForm,
  validateReportFormDraft,
} from '../models/reportPayload.js';
import {
  photoStatusIsTerminal,
  photoStatusSucceeded,
} from '../models/photoState.js';
import { getOrCreateDeviceFingerprint } from './deviceFingerprint';

function serializedError(error) {
  return {
    code: error?.code ?? 'request_failed',
    message: error?.message ?? 'Request failed',
    status: Number.isInteger(error?.status) ? error.status : null,
    request_id: error?.requestId ?? error?.request_id ?? null,
  };
}

export { getOrCreateDeviceFingerprint } from './deviceFingerprint';

function draftHasPhotoPending(draft) {
  if (!draft?.receipt) return false;
  if (!draft.photo_file_uri) return false;
  const payload = draft.payload_json ? thawReportPayload(draft.payload_json) : null;
  return payload?.photo?.expected === true;
}

function draftExpectedPhoto(draft) {
  if (!draft?.receipt) return false;
  if (draft.photo_status?.photo_expected === true) return true;
  const payload = draft.payload_json ? thawReportPayload(draft.payload_json) : null;
  return payload?.photo?.expected === true;
}

function draftHasRejectedPhoto(draft) {
  return (
    draftExpectedPhoto(draft) &&
    photoStatusIsTerminal(draft.photo_status) &&
    !photoStatusSucceeded(draft.photo_status)
  );
}

function outcomeForDraft(draft) {
  if (!draft) return { phase: 'idle', error: null };
  if (draft.local_state === REPORT_DRAFT_STATE.SYNCED) {
    if (draftHasRejectedPhoto(draft)) {
      return { phase: 'photo_rejected', error: null };
    }
    return { phase: 'success', error: null };
  }
  if (draft.local_state === REPORT_DRAFT_STATE.TERMINAL_ERROR) {
    return { phase: 'terminal_error', error: draft.last_error };
  }
  if (draft.local_state === REPORT_DRAFT_STATE.RETRY_WAIT) {
    return { phase: 'retry_wait', error: draft.last_error };
  }
  if (draftHasPhotoPending(draft)) {
    return { phase: 'photo_pending', error: null };
  }
  if (
    draft.local_state === REPORT_DRAFT_STATE.SUBMITTING ||
    draft.local_state === REPORT_DRAFT_STATE.UPLOADING ||
    draft.local_state === REPORT_DRAFT_STATE.AWAITING_PROCESSING
  ) {
    return { phase: 'syncing', error: null };
  }
  return { phase: 'idle', error: null };
}

export async function submitReportDraft({
  draft,
  formDraft,
  queueDraft,
  syncDraft,
  getDeviceFingerprint = getOrCreateDeviceFingerprint,
}) {
  if (!draft) {
    throw Object.assign(new Error('draft_not_ready'), { code: 'draft_not_ready' });
  }
  if (typeof syncDraft !== 'function') {
    throw new Error('sync_draft_required');
  }
  if (draft.local_state === REPORT_DRAFT_STATE.SYNCED) {
    return { draft, fieldErrors: {}, outcome: outcomeForDraft(draft) };
  }
  if (draft.local_state === REPORT_DRAFT_STATE.TERMINAL_ERROR) {
    return { draft, fieldErrors: {}, outcome: outcomeForDraft(draft) };
  }

  let workingDraft = draft;
  if (draft.local_state === REPORT_DRAFT_STATE.DRAFT) {
    if (typeof queueDraft !== 'function') {
      throw new Error('queue_draft_required');
    }
    const { reportFields, errors } = validateReportFormDraft(formDraft);
    if (!reportFields) {
      return { draft, fieldErrors: errors, outcome: { phase: 'invalid', error: null } };
    }
    const deviceFingerprint = await getDeviceFingerprint();
    workingDraft = await queueDraft(draft.id, {
      reportFields,
      deviceFingerprint,
      honeypotFilled: honeypotFilledFromForm(formDraft),
    });
  }

  const synced = await syncDraft(workingDraft.id);
  return {
    draft: synced ?? workingDraft,
    fieldErrors: {},
    outcome: outcomeForDraft(synced ?? workingDraft),
  };
}

export function useSubmitReport({
  draft,
  queueDraft,
  syncDraft,
  getDeviceFingerprint,
  onPhotoPending,
} = {}) {
  const busy = useRef(false);
  const [state, setState] = useState({
    submitting: false,
    fieldErrors: {},
    error: null,
    phase: 'idle',
    submittedDraft: null,
  });

  const submit = useCallback(async (formDraft) => {
    if (busy.current) return false;
    busy.current = true;
    setState((current) => ({
      ...current,
      submitting: true,
      fieldErrors: {},
      error: null,
      phase: 'submitting',
    }));

    try {
      const result = await submitReportDraft({
        draft,
        formDraft,
        queueDraft,
        syncDraft,
        getDeviceFingerprint,
      });
      const nextState = {
        submitting: false,
        fieldErrors: result.fieldErrors,
        error: result.outcome.error,
        phase: result.outcome.phase,
        submittedDraft: result.draft,
      };
      setState(nextState);
      if (result.outcome.phase === 'photo_pending') {
        onPhotoPending?.(result.draft);
      }
      return result.outcome.phase !== 'invalid' && !result.outcome.error;
    } catch (error) {
      setState({
        submitting: false,
        fieldErrors: {},
        error: serializedError(error),
        phase: 'error',
        submittedDraft: null,
      });
      return false;
    } finally {
      busy.current = false;
    }
  }, [draft, getDeviceFingerprint, onPhotoPending, queueDraft, syncDraft]);

  function clearFieldError(field) {
    setState((current) => {
      if (!current.fieldErrors[field]) return current;
      const fieldErrors = { ...current.fieldErrors };
      delete fieldErrors[field];
      return { ...current, fieldErrors };
    });
  }

  return {
    ...state,
    submit,
    clearFieldError,
  };
}
