/**
 * @module hooks/zoneReports
 * Loaders for public report lists shown outside the map: zone (cluster) detail and the Expo Go
 * recent-reports fallback.
 */
import { reportsInCluster } from '../models/publicMap.js';
import { getPublicReports } from '../services/publicMapApi.js';

/** Maximum public reports fetched to resolve the members of one cluster. */
export const ZONE_REPORTS_LIMIT = 1000;

// Zone detail (ERI-10): no endpoint lists cluster members, so load the public projection and filter locally.
// Resolves to { phase: 'ready' | 'empty' | 'offline' | 'error', reports } and never throws.
/**
 * @param {object} query
 * @param {import('../models/publicMap.js').MapCluster} query.cluster
 * @param {number} query.zoom - Current map zoom.
 * @param {object} [dependencies]
 * @param {typeof getPublicReports} [dependencies.fetchReports=getPublicReports] - Network call.
 * @returns {Promise<{phase: 'ready' | 'empty' | 'offline' | 'error',
 *   reports: import('../models/publicMap.js').PublicReport[]}>}
 */
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

// "New report on the map" target: the most recent public report inside a cluster. Never throws.
/**
 * @param {object} query
 * @param {import('../models/publicMap.js').MapCluster} query.cluster
 * @param {number} query.zoom - Map zoom at which the cluster was drawn.
 * @param {object} [dependencies]
 * @param {typeof getPublicReports} [dependencies.fetchReports=getPublicReports] - Network call.
 * @returns {Promise<import('../models/publicMap.js').PublicReport | null>} `null` when empty or on failure.
 */
export async function loadNewestZoneReport({ cluster, zoom }, dependencies = {}) {
  const { phase, reports } = await loadZoneReports({ cluster, zoom }, dependencies);
  return phase === 'ready' ? reports[0] : null;
}

/** Default number of reports in the recent-reports fallback list. */
export const RECENT_REPORTS_LIMIT = 100;

// Expo Go fallback list: newest public reports without a map. Same result shape as loadZoneReports.
/**
 * @param {object} [query]
 * @param {number} [query.limit=RECENT_REPORTS_LIMIT]
 * @param {object} [dependencies]
 * @param {typeof getPublicReports} [dependencies.fetchReports=getPublicReports] - Network call.
 * @returns {Promise<{phase: 'ready' | 'empty' | 'offline' | 'error',
 *   reports: import('../models/publicMap.js').PublicReport[]}>} Sorted by `occurred_at`, newest first.
 */
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
