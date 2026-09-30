import { useCallback, useMemo, useState } from 'react';

import { useReportDraftQueue } from './useReportDraftQueue.js';

export function useReportDraftFlow({ onOpenReportForm } = {}) {
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
      const created = await createDraft({ photo });
      setDraftId(created.id);
    } catch (error) {
      setDraftError(error);
    }
  }, [createDraft, onOpenReportForm]);

  return {
    activeDraft,
    loading: queueLoading || (!activeDraft && !draftError),
    error: draftError ?? queueError,
    queueDraft,
    syncDraft,
    openReportDraft,
  };
}
