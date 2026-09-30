import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, Platform } from 'react-native';
import { useEffect, useState } from 'react';

import './i18n';
import { createLoginController } from './controllers/loginController.js';
import { useLogin } from './hooks/useLogin.js';
import { useReportDraftQueue } from './hooks/useReportDraftQueue.js';
import AssociationDashboardScreen from './screens/associationDashboardScreen.js';
import CameraScreen from './screens/CameraScreen.js';
import CommandCenterScreen from './screens/CommandCenterScreen.js';
import ConfigurationScreen from './screens/ConfigurationScreen.js';
import LoginScreen from './screens/loginScreen.js';
import ReportDraftScreen from './screens/ReportDraftScreen.js';
import ZoneSetScreen from './screens/ZoneSetScreen.js';
import { createAuthService } from './services/authService.js';
import { supabase } from './services/supabaseClient.js';

const loginController = createLoginController({ authService: createAuthService({ supabase }) });

export default function App() {
  const [screen, setScreen] = useState('camera');
  const [draftId, setDraftId] = useState(null);
  const [draftError, setDraftError] = useState(null);
  const draftQueue = useReportDraftQueue();
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
  const activeDraft = draftQueue.drafts.find((draft) => draft.id === draftId) ?? null;

  async function openReportDraft(photo) {
    setScreen('reportDraft');
    setDraftId(null);
    setDraftError(null);
    try {
      const created = await draftQueue.createDraft({ photo });
      setDraftId(created.id);
    } catch (error) {
      setDraftError(error);
    }
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
  } else if (login.session && screen === 'zoneSets') {
    content = <ZoneSetScreen accessToken={login.session.accessToken} onBack={() => setScreen('moderation')} />;
  } else if (login.session) {
    content = (
      <CommandCenterScreen
        accessToken={login.session.accessToken}
        onOpenConfiguration={() => setScreen('configuration')}
        onOpenZoneSets={() => setScreen('zoneSets')}
        onLogout={login.logout}
        logoutPending={login.pending}
      />
    );
  } else if (screen === 'reportDraft') {
    content = (
      <ReportDraftScreen
        draft={activeDraft}
        loading={draftQueue.loading || (!activeDraft && !draftError)}
        error={draftError ?? draftQueue.error}
        onBackToCamera={() => setScreen('camera')}
      />
    );
  } else {
    content = (
      <CameraScreen
        onOpenLogin={() => setScreen('login')}
        onReportWithoutPhoto={() => { void openReportDraft(null); }}
        onPhotoAccepted={(photo) => { void openReportDraft(photo); }}
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
