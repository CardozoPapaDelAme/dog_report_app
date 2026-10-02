import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Network from 'expo-network';

import { createDraftAutoSync, createNetworkTrigger } from './draftAutoSync.js';

// Wires RNF12 auto-sync once at app level. Degrades to a no-op where a signal
// is unavailable (never throws).
export function useDraftAutoSync({ ready, syncDueDrafts, isSyncBusy }) {
  const syncRef = useRef(syncDueDrafts);
  const busyRef = useRef(isSyncBusy);
  syncRef.current = syncDueDrafts;
  busyRef.current = isSyncBusy;

  useEffect(() => {
    if (!ready) return undefined;
    const scheduler = createDraftAutoSync({
      syncDueDrafts: () => syncRef.current(),
      isBusy: () => Boolean(busyRef.current?.()),
      onError: (error) => console.warn('Draft auto-sync failed:', error?.message ?? error),
    });
    const onNetwork = createNetworkTrigger(scheduler.trigger);
    const cleanups = [];

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.addEventListener) {
        const online = () => onNetwork({ isConnected: true, isInternetReachable: true });
        const offline = () => onNetwork({ isConnected: false, isInternetReachable: false });
        window.addEventListener('online', online);
        window.addEventListener('offline', offline);
        cleanups.push(() => {
          window.removeEventListener('online', online);
          window.removeEventListener('offline', offline);
        });
        if (typeof navigator === 'undefined' || navigator.onLine !== false) online();
      } else {
        const subscription = Network.addNetworkStateListener(onNetwork);
        cleanups.push(() => subscription.remove());
        Network.getNetworkStateAsync().then(onNetwork).catch(() => {});
      }
    } catch (error) {
      console.warn('Network monitoring unavailable:', error?.message ?? error);
    }

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') scheduler.trigger();
    });
    cleanups.push(() => appState.remove());

    return () => {
      scheduler.dispose();
      cleanups.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
    };
  }, [ready]);
}
