/**
 * @module hooks/usePublicMap
 * React binding for the public map loader state machine (`hooks/publicMapLoader.js`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createPublicMapLoader, PUBLIC_MAP_REFRESH_MS } from './publicMapLoader.js';

/**
 * Creates one loader per mount (disposed on unmount) and mirrors its state.
 * The map refreshes silently every `PUBLIC_MAP_REFRESH_MS` while the screen is mounted and the app is in the
 * foreground, so reports published elsewhere appear without reopening the map.
 * @param {Parameters<typeof createPublicMapLoader>[0]} [options] - Loader options; read only on mount.
 * @returns {ReturnType<ReturnType<typeof createPublicMapLoader>['getState']> & {
 *   setRegion: (region: {zoom: number, bounds: *}) => (boolean | undefined),
 *   retry: () => (boolean | undefined)}} Loader state plus actions; actions return `undefined` before mount.
 */
export function usePublicMap(options = {}) {
  const [state, setState] = useState(() => createPublicMapLoader().getState());
  const loader = useRef(null);

  // Create the loader inside the effect so a StrictMode remount gets a live
  // loader instead of one that the first cleanup already disposed.
  useEffect(() => {
    const current = createPublicMapLoader({ refreshMs: PUBLIC_MAP_REFRESH_MS, ...options, onChange: setState });
    loader.current = current;
    // Pause the auto refresh in the background so a forgotten open map spends no requests.
    const subscription = AppState.addEventListener?.('change', (status) => {
      if (status === 'active') current.resume();
      else current.pause();
    });
    return () => {
      subscription?.remove?.();
      current.dispose();
      if (loader.current === current) loader.current = null;
    };
  }, []);

  const setRegion = useCallback((region) => loader.current?.setRegion(region), []);
  const retry = useCallback(() => loader.current?.retry(), []);
  return { ...state, setRegion, retry };
}
