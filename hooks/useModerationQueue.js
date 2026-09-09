import { startTransition, useEffect, useEffectEvent, useRef, useState } from 'react';

import { applyModerationResult, normalizeModerationReport } from '../models/moderation.js';
import { getModerationQueue, runModerationCommand } from '../services/moderationApi.js';

export function useModerationQueue(accessToken) {
  const [reports, setReports] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(Boolean(accessToken));
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [pendingReportId, setPendingReportId] = useState(null);
  const requestVersion = useRef(0);

  async function loadPage({ cursor = null, mode = 'replace' } = {}) {
    if (!accessToken) {
      setReports([]);
      setNextCursor(null);
      setLoading(false);
      return;
    }
    const version = ++requestVersion.current;
    setError(null);
    mode === 'refresh' ? setRefreshing(true) : cursor ? setLoadingMore(true) : setLoading(true);
    try {
      const page = await getModerationQueue({ accessToken, cursor });
      if (version !== requestVersion.current) return;
      const items = page.items.map(normalizeModerationReport);
      startTransition(() => {
        setReports((current) => (mode === 'append' ? [...current, ...items] : items));
        setNextCursor(page.next_cursor);
      });
    } catch (requestError) {
      if (version === requestVersion.current) setError(requestError);
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }

  const loadInitial = useEffectEvent(() => loadPage());
  useEffect(() => {
    loadInitial();
    return () => {
      requestVersion.current += 1;
    };
  }, [accessToken]);

  async function execute(reportId, command, note) {
    if (!accessToken || pendingReportId) return false;
    setPendingReportId(reportId);
    setError(null);
    try {
      const result = await runModerationCommand({ accessToken, reportId, command, note });
      startTransition(() => setReports((current) => applyModerationResult(current, reportId, result)));
      return true;
    } catch (requestError) {
      setError(requestError);
      return false;
    } finally {
      setPendingReportId(null);
    }
  }

  return {
    reports,
    nextCursor,
    loading,
    refreshing,
    loadingMore,
    error,
    pendingReportId,
    refresh: () => loadPage({ mode: 'refresh' }),
    loadMore: () => nextCursor && loadPage({ cursor: nextCursor, mode: 'append' }),
    execute,
  };
}
