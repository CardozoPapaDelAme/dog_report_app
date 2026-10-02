import { useCallback, useMemo, useState } from 'react';

import { detectDogColorFromPhoto } from '../services/dogColorRuntime.js';
import { attachDetectedColor } from '../services/photoColorFlow.js';
import { useReportDraftQueue } from './useReportDraftQueue.js';

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
    openReportDraft,
  };
}
