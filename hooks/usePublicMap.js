import { useCallback, useEffect, useRef, useState } from 'react';
import { createPublicMapLoader } from './publicMapLoader.js';

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
