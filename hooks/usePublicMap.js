/**
 * @module hooks/usePublicMap
 * React binding for the public map loader state machine (`hooks/publicMapLoader.js`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPublicMapLoader } from './publicMapLoader.js';

/**
 * Creates one loader per mount (disposed on unmount) and mirrors its state.
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
    const current = createPublicMapLoader({ ...options, onChange: setState });
    loader.current = current;
    return () => {
      current.dispose();
      if (loader.current === current) loader.current = null;
    };
  }, []);

  const setRegion = useCallback((region) => loader.current?.setRegion(region), []);
  const retry = useCallback(() => loader.current?.retry(), []);
  return { ...state, setRegion, retry };
}
