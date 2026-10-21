/**
 * @module hooks/publicMapLoader
 * Framework-free state machine behind the public map: debounced region loads, cluster/pin mode
 * switching by zoom, stale-response protection and retry.
 */
import { normalizeZoom, queryModeForZoom, viewportFromBounds, isInViewport } from '../models/publicMap.js';
import { getPublicClusters, getPublicReports } from '../services/publicMapApi.js';

/** Delay in milliseconds between the last region change and the request. */
export const PUBLIC_MAP_DEBOUNCE_MS = 300;

/** Interval of the silent auto refresh used by the map screen, so new reports appear without reopening it. */
export const PUBLIC_MAP_REFRESH_MS = 5000;

const initialState = Object.freeze({
  phase: 'idle', // idle | loading | ready | empty | error | offline
  // `mode` follows the zoom; `dataMode` is what `clusters`/`reports` currently hold, so the previous markers stay
  // on screen until the new mode's data arrives instead of leaving an empty map.
  mode: 'clusters', dataMode: 'clusters', region: null, clusters: [], reports: [], error: null,
});

// Plain state machine: debounced region loads, mode switch, stale-response protection, retry.
/**
 * @param {object} [options]
 * @param {typeof getPublicClusters} [options.getClusters=getPublicClusters] - Cluster request (network call).
 * @param {typeof getPublicReports} [options.getReports=getPublicReports] - Report request (network call).
 * @param {typeof setTimeout} [options.schedule=setTimeout]
 * @param {typeof clearTimeout} [options.cancel=clearTimeout]
 * @param {number} [options.debounceMs=PUBLIC_MAP_DEBOUNCE_MS]
 * @param {number} [options.refreshMs=0] - Silent reload of the current region every `refreshMs`; `0` disables it.
 *   A refresh never shows `loading`, keeps the markers when it fails and loses against a newer region.
 * @param {(state: object) => void} [options.onChange] - Receives every new state until disposed.
 * @returns {{setRegion: (region: {zoom: number, bounds: *}) => boolean, retry: () => boolean,
 *   pause: () => void, resume: () => boolean,
 *   dispose: () => void, getState: () => {phase: 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'offline',
 *   mode: 'clusters' | 'pins', dataMode: 'clusters' | 'pins', region: {zoom: number, viewport: import('../models/publicMap.js').Viewport} | null,
 *   clusters: import('../models/publicMap.js').MapCluster[],
 *   reports: import('../models/publicMap.js').PublicReport[], error: Error | null}}}
 *   `setRegion` returns `false` for an invalid zoom or bounds; `retry` returns `false` before any region.
 *   `pause` stops the auto refresh (app in background); `resume` refreshes at once and returns `false` when not paused.
 *   In pin mode all reports are loaded once and filtered locally per viewport.
 */
export function createPublicMapLoader({
  getClusters = getPublicClusters, getReports = getPublicReports,
  schedule = setTimeout, cancel = clearTimeout, debounceMs = PUBLIC_MAP_DEBOUNCE_MS, refreshMs = 0, onChange = () => {},
} = {}) {
  let state = initialState;
  let timer = null;
  let refreshTimer = null;
  let epoch = 0;
  let disposed = false;
  let paused = false;
  let pinsLoaded = false;

  const set = (patch) => { state = { ...state, ...patch }; if (!disposed) onChange(state); };
  const clearTimer = () => { if (timer !== null) { cancel(timer); timer = null; } };
  const clearRefresh = () => { if (refreshTimer !== null) { cancel(refreshTimer); refreshTimer = null; } };

  function scheduleRefresh() {
    clearRefresh();
    if (!refreshMs || disposed || paused || !state.region) return;
    refreshTimer = schedule(() => { refreshTimer = null; fetchRegion({ silent: true }); }, refreshMs);
  }

  // One request for the current region. `silent` (auto refresh) skips the loading state and keeps the markers on failure.
  async function fetchRegion({ silent }) {
    const current = ++epoch;
    const { mode, region } = state;
    if (!silent) set({ phase: 'loading', error: null });
    try {
      if (mode === 'pins') {
        const reports = await getReports({});
        if (current !== epoch || disposed) return;
        pinsLoaded = true;
        const visible = reports.filter((report) => isInViewport(report.approximate_location, region.viewport));
        set({ reports, clusters: [], dataMode: 'pins', phase: visible.length ? 'ready' : 'empty', error: null });
      } else {
        const clusters = await getClusters({ zoom: region.zoom, viewport: region.viewport });
        if (current !== epoch || disposed) return;
        set({ clusters, reports: [], dataMode: 'clusters', phase: clusters.length ? 'ready' : 'empty', error: null });
      }
    } catch (error) {
      if (current !== epoch || disposed) return;
      if (!silent) {
        set({ clusters: [], reports: [], dataMode: mode, phase: error?.code === 'network_unavailable' ? 'offline' : 'error', error });
      }
    }
    if (current === epoch) scheduleRefresh();
  }

  const load = () => fetchRegion({ silent: false });

  function setRegion({ zoom, bounds }) {
    const level = normalizeZoom(zoom);
    const viewport = viewportFromBounds(bounds);
    if (level === null || !viewport) return false;
    const mode = queryModeForZoom(level);
    const previous = state;
    const modeChanged = mode !== previous.mode;
    state = { ...state, mode, region: { zoom: level, viewport } };
    if (modeChanged) pinsLoaded = false; // keep the previous markers until the new mode's data arrives
    clearTimer();
    clearRefresh();
    if (mode === 'pins' && pinsLoaded && state.phase !== 'offline' && state.phase !== 'error') {
      // Reports are not viewport-scoped: re-filter locally instead of refetching on pan.
      epoch += 1;
      const visible = state.reports.filter((report) => isInViewport(report.approximate_location, viewport));
      set({ phase: visible.length ? 'ready' : 'empty' });
      scheduleRefresh();
      return true;
    }
    epoch += 1; // invalidate any in-flight response for the previous region
    set({ phase: 'loading', error: null });
    timer = schedule(() => { timer = null; load(); }, debounceMs);
    return true;
  }

  function retry() {
    if (!state.region) return false;
    clearTimer();
    clearRefresh();
    pinsLoaded = false;
    load();
    return true;
  }

  function pause() { paused = true; clearRefresh(); }

  function resume() {
    if (!paused) return false;
    paused = false;
    if (state.region && timer === null && state.phase !== 'loading') fetchRegion({ silent: true });
    return true;
  }

  function dispose() { disposed = true; epoch += 1; clearTimer(); clearRefresh(); }

  return { setRegion, retry, pause, resume, dispose, getState: () => state };
}
