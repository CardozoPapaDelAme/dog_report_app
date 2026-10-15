/**
 * @module hooks/usePublicHeatmapReports
 * Loads the individual public reports (stable 50 m approximation) that feed the heatmap, once per
 * activation. Not viewport-scoped, like the pin mode of `hooks/publicMapLoader.js`.
 */
import { useCallback, useEffect, useState } from 'react';
import { getPublicReports } from '../services/publicMapApi.js';

const REPORT_LIMIT = 1000;

/**
 * @param {boolean} enabled - Fetches when it becomes true and the reports are not loaded yet.
 * @returns {{reports: import('../models/publicMap.js').PublicReport[], phase: 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'offline', retry: () => void}}
 */
export function usePublicHeatmapReports(enabled) {
  const [state, setState] = useState({ reports: [], phase: 'idle' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setState((previous) => ({ ...previous, phase: 'loading' }));
    getPublicReports({ limit: REPORT_LIMIT })
      .then((reports) => { if (!cancelled) setState({ reports, phase: reports.length ? 'ready' : 'empty' }); })
      .catch((error) => { if (!cancelled) setState({ reports: [], phase: error?.code === 'network_unavailable' ? 'offline' : 'error' }); });
    return () => { cancelled = true; };
  }, [enabled, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, retry };
}
