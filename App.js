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
import AssociationDashboardScreen from './screens/associationDashboardScreen.js';
import CommandCenterScreen from './screens/CommandCenterScreen.js';
import ConfigurationScreen from './screens/ConfigurationScreen.js';
import LoginScreen from './screens/loginScreen.js';
import { createAuthService } from './services/authService.js';
import { supabase } from './services/supabaseClient.js';

const loginController = createLoginController({ authService: createAuthService({ supabase }) });

export default function App() {
  const [screen, setScreen] = useState('moderation');
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

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {!login.session ? (
        <LoginScreen onLogin={login.login} error={login.error} pending={login.pending} loading={login.loading} />
      ) : login.destination === 'associationDashboard' ? (
        <AssociationDashboardScreen
          displayName={login.session.profile.displayName}
          onLogout={login.logout}
          pending={login.pending}
        />
      ) : screen === 'configuration' ? (
        <ConfigurationScreen
          accessToken={login.session.accessToken}
          onBack={() => setScreen('moderation')}
          onLogout={login.logout}
          logoutPending={login.pending}
        />
      ) : (
        <CommandCenterScreen
          accessToken={login.session.accessToken}
          onOpenConfiguration={() => setScreen('configuration')}
          onLogout={login.logout}
          logoutPending={login.pending}
        />
      )}
    </SafeAreaProvider>
  );
}
