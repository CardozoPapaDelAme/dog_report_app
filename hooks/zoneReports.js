import { reportsInCluster } from '../models/publicMap.js';
import { getPublicReports } from '../services/publicMapApi.js';

export const ZONE_REPORTS_LIMIT = 1000;

// Zone detail (ERI-10): no endpoint lists cluster members, so load the public projection and filter locally.
// Resolves to { phase: 'ready' | 'empty' | 'offline' | 'error', reports } and never throws.
export async function loadZoneReports({ cluster, zoom }, { fetchReports = getPublicReports } = {}) {
  try {
    const all = await fetchReports({ limit: ZONE_REPORTS_LIMIT });
    const reports = reportsInCluster(all, cluster, zoom);
    return { phase: reports.length ? 'ready' : 'empty', reports };
  } catch (error) {
    const offline = error?.code === 'network_unavailable' || error?.code === 'request_timeout';
    return { phase: offline ? 'offline' : 'error', reports: [] };
  }
}

export const RECENT_REPORTS_LIMIT = 100;

// Expo Go fallback list: newest public reports without a map. Same result shape as loadZoneReports.
export async function loadRecentReports({ limit = RECENT_REPORTS_LIMIT } = {}, { fetchReports = getPublicReports } = {}) {
  try {
    const reports = [...await fetchReports({ limit })]
      .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
    return { phase: reports.length ? 'ready' : 'empty', reports };
  } catch (error) {
    const offline = error?.code === 'network_unavailable' || error?.code === 'request_timeout';
    return { phase: offline ? 'offline' : 'error', reports: [] };
  }
}
