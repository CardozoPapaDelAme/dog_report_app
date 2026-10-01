import { useCallback, useEffect, useRef, useState } from 'react';
import { validateAssociationDateRange } from '../models/associationReport.js';
import { getAssociationReportsPage } from '../services/associationReportApi.js';
import { loadAssociationReportRange } from './associationReportLoader.js';

const initial = (token) => ({ token, phase: token ? 'idle' : 'session', rows: [], range: null,
  dates: null, errors: {}, error: null });

export function useAssociationReports(accessToken, getPage = getAssociationReportsPage) {
  const [state, setState] = useState(() => initial(accessToken));
  const generation = useRef(0);
  const token = useRef(accessToken);
  token.current = accessToken;
  const visible = state.token === accessToken ? state : initial(accessToken);

  useEffect(() => {
    generation.current += 1;
    setState(initial(accessToken));
    return () => { generation.current += 1; };
  }, [accessToken]);

  const loadRange = useCallback(async (fromDay, toDay) => {
    const epoch = ++generation.current;
    const { range, errors } = validateAssociationDateRange(fromDay, toDay);
    const dates = { fromDay, toDay };
    if (!range) {
      setState({ ...initial(accessToken), phase: 'invalid', dates, errors });
      return false;
    }
    if (!accessToken) {
      setState({ ...initial(accessToken), dates });
      return false;
    }
    setState({ ...initial(accessToken), phase: 'loading', range, dates });
    try {
      const rows = await loadAssociationReportRange({ accessToken, range, getPage });
      if (generation.current !== epoch || token.current !== accessToken) return false;
      setState({ ...initial(accessToken), phase: rows.length ? 'ready' : 'empty', rows, range, dates });
      return true;
    } catch (error) {
      if (generation.current !== epoch || token.current !== accessToken) return false;
      setState({ ...initial(accessToken), phase: error.status === 401 ? 'session' : error.status === 403 ? 'forbidden' : 'error',
        range, dates, error });
      return false;
    }
  }, [accessToken, getPage]);

  return { ...visible, loadRange, reload: () => visible.dates && loadRange(visible.dates.fromDay, visible.dates.toDay) };
}
