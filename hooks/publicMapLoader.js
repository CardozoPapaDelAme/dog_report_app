import { normalizeZoom, queryModeForZoom, viewportFromBounds, isInViewport } from '../models/publicMap.js';
import { getPublicClusters, getPublicReports } from '../services/publicMapApi.js';

export const PUBLIC_MAP_DEBOUNCE_MS = 300;

const initialState = Object.freeze({
  phase: 'idle', // idle | loading | ready | empty | error | offline
  mode: 'clusters', region: null, clusters: [], reports: [], error: null,
});

// Plain state machine: debounced region loads, mode switch, stale-response protection, retry.
export function createPublicMapLoader({
  getClusters = getPublicClusters, getReports = getPublicReports,
  schedule = setTimeout, cancel = clearTimeout, debounceMs = PUBLIC_MAP_DEBOUNCE_MS, onChange = () => {},
} = {}) {
  let state = initialState;
  let timer = null;
  let epoch = 0;
  let disposed = false;
  let pinsLoaded = false;

  const set = (patch) => { state = { ...state, ...patch }; if (!disposed) onChange(state); };
  const clearTimer = () => { if (timer !== null) { cancel(timer); timer = null; } };

  async function load() {
    const current = ++epoch;
    const { mode, region } = state;
    set({ phase: 'loading', error: null });
    try {
      if (mode === 'pins') {
        const reports = await getReports({});
        if (current !== epoch || disposed) return;
        pinsLoaded = true;
        const visible = reports.filter((report) => isInViewport(report.approximate_location, region.viewport));
        set({ reports, clusters: [], phase: visible.length ? 'ready' : 'empty' });
      } else {
        const clusters = await getClusters({ zoom: region.zoom, viewport: region.viewport });
        if (current !== epoch || disposed) return;
        set({ clusters, reports: [], phase: clusters.length ? 'ready' : 'empty' });
      }
    } catch (error) {
      if (current !== epoch || disposed) return;
      set({ phase: error?.code === 'network_unavailable' ? 'offline' : 'error', error });
    }
  }

  function setRegion({ zoom, bounds }) {
    const level = normalizeZoom(zoom);
    const viewport = viewportFromBounds(bounds);
    if (level === null || !viewport) return false;
    const mode = queryModeForZoom(level);
    const previous = state;
    const modeChanged = mode !== previous.mode;
    state = { ...state, mode, region: { zoom: level, viewport } };
    if (modeChanged) { pinsLoaded = false; state = { ...state, clusters: [], reports: [] }; }
    clearTimer();
    if (mode === 'pins' && pinsLoaded && state.phase !== 'offline' && state.phase !== 'error') {
      // Reports are not viewport-scoped: re-filter locally instead of refetching on pan.
      epoch += 1;
      const visible = state.reports.filter((report) => isInViewport(report.approximate_location, viewport));
      set({ phase: visible.length ? 'ready' : 'empty' });
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
    pinsLoaded = false;
    load();
    return true;
  }

  function dispose() { disposed = true; epoch += 1; clearTimer(); }

  return { setRegion, retry, dispose, getState: () => state };
}
