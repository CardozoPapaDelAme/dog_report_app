/**
 * @module hooks/useReportDraftFlow
 * Container hook that opens a new report draft from a captured photo (with on-device dog color
 * detection) and exposes the draft queue actions used by `App.js` and the report form.
 */
import { useCallback, useMemo, useState } from 'react';

import { detectDogColorFromPhoto } from '../services/dogColorRuntime.js';
import { attachDetectedColor } from '../services/photoColorFlow.js';
import { useReportDraftQueue } from './useReportDraftQueue.js';

/**
 * @param {object} [options]
 * @param {() => void} [options.onOpenReportForm] - Called before the draft is created.
 * @param {typeof detectDogColorFromPhoto} [options.detectColor=detectDogColorFromPhoto]
 * @returns {{activeDraft: import('../models/reportDraft.js').ReportDraft | null, loading: boolean,
 *   error: Error | null, queueDraft: Function, syncDraft: Function, syncDueDrafts: Function,
 *   isSyncBusy: () => boolean, queueReady: boolean,
 *   drafts: import('../models/reportDraft.js').ReportDraft[],
 *   openReportDraft: (photo: object | null) => Promise<void>}} Queue actions come from
 *   `useReportDraftQueue`; `openReportDraft(null)` creates a draft without a photo.
 */
export function useReportDraftFlow({ onOpenReportForm, detectColor = detectDogColorFromPhoto } = {}) {
  const [draftId, setDraftId] = useState(null);
  const [draftError, setDraftError] = useState(null);
  const {
    drafts,
    loading: queueLoading,
    error: queueError,
    createDraft,
    queueDraft,
    syncDraft,
    syncDueDrafts,
    isSyncBusy,
    ready,
  } = useReportDraftQueue();

  const activeDraft = useMemo(
    () => drafts.find((draft) => draft.id === draftId) ?? null,
    [drafts, draftId],
  );

  const openReportDraft = useCallback(async (photo) => {
    onOpenReportForm?.();
    setDraftId(null);
    setDraftError(null);
    try {
      const created = await createDraft({ photo: await attachDetectedColor(photo, detectColor) });
      setDraftId(created.id);
    } catch (error) {
      setDraftError(error);
    }
  }, [createDraft, detectColor, onOpenReportForm]);

  return {
    activeDraft,
    loading: queueLoading || (!activeDraft && !draftError),
    error: draftError ?? queueError,
    queueDraft,
    syncDraft,
    syncDueDrafts,
    isSyncBusy,
    queueReady: ready,
    drafts,
    openReportDraft,
  };
}
