/**
 * @module App
 * Root container: loads fonts and translations, owns the session (`useLogin`), the offline report
 * draft flow and its auto-sync, the Supabase token auto-refresh, and screen selection. Association
 * users get the association dashboard; other authenticated staff get the command center and its
 * configuration, zone set and duplicate screens; anonymous users get the camera, map and report form.
 */
import { fontAssets } from './theme/index.js';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { AppState, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import './i18n';
import { createLoginController } from './controllers/loginController.js';
import { useDraftAutoSync } from './hooks/useDraftAutoSync.js';
import { useLogin } from './hooks/useLogin.js';
import { useReportDraftFlow } from './hooks/useReportDraftFlow.js';
import AssociationDashboardScreen from './screens/associationDashboardScreen.js';
import CameraScreen from './screens/CameraScreen.js';
import CommandCenterScreen from './screens/CommandCenterScreen.js';
import ConfigurationScreen from './screens/ConfigurationScreen.js';
import DuplicateManagementScreen from './screens/DuplicateManagementScreen.js';
import LoginScreen from './screens/loginScreen.js';
import PublicMapScreen from './screens/PublicMapScreen.js';
import ReportFormScreen from './screens/ReportFormScreen.js';
import ZoneSetScreen from './screens/ZoneSetScreen.js';
import { summarizeReportDraftQueue } from './models/reportDraft.js';
import { createAuthService } from './services/authService.js';
import { supabase } from './services/supabaseClient.js';

/** Single login controller for the app lifetime. */
const loginController = createLoginController({ authService: createAuthService({ supabase }) });

/**
 * @returns {JSX.Element | null} `null` while fonts are loading.
 */
export default function App() {
  const [screen, setScreen] = useState('camera');
  const [draftQueueSyncing, setDraftQueueSyncing] = useState(false);
  const [draftQueueSyncedNotice, setDraftQueueSyncedNotice] = useState(false);
  const draftQueueSyncingRef = useRef(false);
  const previousDraftQueueRef = useRef(null);
  const openReportForm = useCallback(() => setScreen('reportDraft'), []);
  const reportDraftFlow = useReportDraftFlow({ onOpenReportForm: openReportForm });
  const syncDueDrafts = useCallback(async () => {
    if (draftQueueSyncingRef.current) return [];
    draftQueueSyncingRef.current = true;
    setDraftQueueSyncing(true);
    try {
      return await reportDraftFlow.syncDueDrafts();
    } finally {
      draftQueueSyncingRef.current = false;
      setDraftQueueSyncing(false);
    }
  }, [reportDraftFlow.syncDueDrafts]);
  const isDraftQueueBusy = useCallback(
    () => draftQueueSyncingRef.current || Boolean(reportDraftFlow.isSyncBusy?.()),
    [reportDraftFlow.isSyncBusy],
  );
  useDraftAutoSync({
    ready: reportDraftFlow.queueReady,
    syncDueDrafts,
    isSyncBusy: isDraftQueueBusy,
    drafts: reportDraftFlow.drafts,
  });
  const draftQueueSummary = useMemo(
    () => summarizeReportDraftQueue(reportDraftFlow.drafts, { isSyncing: draftQueueSyncing }),
    [draftQueueSyncing, reportDraftFlow.drafts],
  );
  const login = useLogin(loginController);
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => {
      subscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    const previous = previousDraftQueueRef.current;
    const hasOpenQueue = draftQueueSummary.pendingCount > 0 || draftQueueSummary.terminalCount > 0;
    if (hasOpenQueue) {
      setDraftQueueSyncedNotice(false);
    } else if (previous?.pendingCount > 0 && previous.terminalCount === 0) {
      setDraftQueueSyncedNotice(true);
    }
    previousDraftQueueRef.current = {
      pendingCount: draftQueueSummary.pendingCount,
      terminalCount: draftQueueSummary.terminalCount,
    };
  }, [draftQueueSummary.pendingCount, draftQueueSummary.terminalCount]);

  useEffect(() => {
    if (!draftQueueSyncedNotice) return undefined;
    const timeout = setTimeout(() => setDraftQueueSyncedNotice(false), 4000);
    return () => clearTimeout(timeout);
  }, [draftQueueSyncedNotice]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  let content;
  if (login.loading) {
    content = <LoginScreen loading onLogin={login.login} error={login.error} pending={login.pending} />;
  } else if (!login.session && screen === 'login') {
    content = <LoginScreen onLogin={login.login} onBack={() => setScreen('camera')} error={login.error} pending={login.pending} loading={false} />;
  } else if (login.session?.profile.role === 'association') {
    content = (
      <AssociationDashboardScreen
        accessToken={login.session.accessToken}
        displayName={login.session.profile.displayName}
        onLogout={login.logout}
        pending={login.pending}
      />
    );
  } else if (login.session && screen === 'configuration') {
    content = (
      <ConfigurationScreen
        accessToken={login.session.accessToken}
        onBack={() => setScreen('moderation')}
        onLogout={login.logout}
        logoutPending={login.pending}
      />
    );
  } else if (login.session && screen === 'duplicates') {
    content = <DuplicateManagementScreen accessToken={login.session.accessToken} onBack={() => setScreen('moderation')} />;
  } else if (login.session && screen === 'zoneSets') {
    content = <ZoneSetScreen accessToken={login.session.accessToken} onBack={() => setScreen('moderation')} />;
  } else if (login.session) {
    content = (
      <CommandCenterScreen
        accessToken={login.session.accessToken}
        onOpenConfiguration={() => setScreen('configuration')}
        onOpenZoneSets={() => setScreen('zoneSets')}
        onOpenDuplicates={() => setScreen('duplicates')}
        onLogout={login.logout}
        logoutPending={login.pending}
      />
    );
  } else if (screen === 'map') {
    content = <PublicMapScreen onBack={() => setScreen('camera')} />;
  } else if (screen === 'reportDraft') {
    content = (
      <ReportFormScreen
        draft={reportDraftFlow.activeDraft}
        loading={reportDraftFlow.loading}
        error={reportDraftFlow.error}
        queueDraft={reportDraftFlow.queueDraft}
        syncDraft={reportDraftFlow.syncDraft}
        onBackToCamera={() => setScreen('camera')}
      />
    );
  } else {
    content = (
      <CameraScreen
        onOpenLogin={() => setScreen('login')}
        onOpenMap={() => setScreen('map')}
        draftQueueSummary={draftQueueSummary}
        draftQueueSynced={draftQueueSyncedNotice}
        onRetryDraftQueue={() => {
          void syncDueDrafts();
        }}
        onReportWithoutPhoto={() => {
          void reportDraftFlow.openReportDraft(null);
        }}
        onPhotoAccepted={(photo) => {
          void reportDraftFlow.openReportDraft(photo);
        }}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {content}
    </SafeAreaProvider>
  );
}
