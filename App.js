import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { AppState, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';

import './i18n';
import { createLoginController } from './controllers/loginController.js';
import { useLogin } from './hooks/useLogin.js';
import { useReportDraftFlow } from './hooks/useReportDraftFlow.js';
import AssociationDashboardScreen from './screens/associationDashboardScreen.js';
import CameraScreen from './screens/CameraScreen.js';
import CommandCenterScreen from './screens/CommandCenterScreen.js';
import ConfigurationScreen from './screens/ConfigurationScreen.js';
import DuplicateManagementScreen from './screens/DuplicateManagementScreen.js';
import LoginScreen from './screens/loginScreen.js';
import ReportFormScreen from './screens/ReportFormScreen.js';
import ZoneSetScreen from './screens/ZoneSetScreen.js';
import { createAuthService } from './services/authService.js';
import { supabase } from './services/supabaseClient.js';

const loginController = createLoginController({ authService: createAuthService({ supabase }) });

export default function App() {
  const [screen, setScreen] = useState('camera');
  const openReportForm = useCallback(() => setScreen('reportDraft'), []);
  const reportDraftFlow = useReportDraftFlow({ onOpenReportForm: openReportForm });
  const login = useLogin(loginController);
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

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

  if (!fontsLoaded && !fontError) {
    return null;
  }

  let content;
  if (login.loading) {
    content = <LoginScreen loading onLogin={login.login} error={login.error} pending={login.pending} />;
  } else if (!login.session && screen === 'login') {
    content = <LoginScreen onLogin={login.login} error={login.error} pending={login.pending} loading={false} />;
  } else if (login.session?.profile.role === 'association') {
    content = (
      <AssociationDashboardScreen
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