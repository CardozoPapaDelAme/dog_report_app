import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Network from 'expo-network';

import { createDraftAutoSync, createNetworkTrigger, createRetryWakeup, networkIsOnline } from './draftAutoSync.js';

// Wires RNF12 auto-sync once at app level. Degrades to a no-op where a signal
// is unavailable (never throws).
export function useDraftAutoSync({ ready, syncDueDrafts, isSyncBusy, drafts }) {
  const syncRef = useRef(syncDueDrafts);
  const busyRef = useRef(isSyncBusy);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  syncRef.current = syncDueDrafts;
  busyRef.current = isSyncBusy;

  const wakeupRef = useRef(null);
  useEffect(() => { wakeupRef.current?.setDrafts(drafts); }, [drafts, ready]);

  useEffect(() => {
    if (!ready) return undefined;
    const wakeup = createRetryWakeup({ trigger: () => scheduler.trigger() });
    wakeupRef.current = wakeup;
    wakeup.setDrafts(draftsRef.current);
    let online = false;
    let foreground = AppState.currentState == null || AppState.currentState === 'active';
    const refreshWakeup = () => wakeup.setActive(online && foreground);
    const scheduler = createDraftAutoSync({
      syncDueDrafts: () => syncRef.current(),
      isBusy: () => Boolean(busyRef.current?.()),
      onPassSettled: () => wakeup.rearm(),
      onError: (error) => console.warn('Draft auto-sync failed:', error?.message ?? error),
    });
    const onReconnect = createNetworkTrigger(scheduler.trigger);
    const onNetwork = (state) => {
      online = networkIsOnline(state);
      refreshWakeup();
      onReconnect(state);
    };
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
      foreground = state === 'active';
      refreshWakeup();
      if (foreground) scheduler.trigger();
    });
    cleanups.push(() => appState.remove());

    return () => {
      scheduler.dispose();
      wakeup.dispose();
      wakeupRef.current = null;
      cleanups.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
    };
  }, [ready]);
}
