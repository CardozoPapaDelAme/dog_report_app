import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useState } from 'react';

import './i18n';
import CameraScreen from './screens/CameraScreen.js';
import CommandCenterScreen from './screens/CommandCenterScreen.js';
import ConfigurationScreen from './screens/ConfigurationScreen.js';
import ReportDraftScreen from './screens/ReportDraftScreen.js';

export default function App({ accessToken = null }) {
  const [screen, setScreen] = useState('camera');
  const [draft, setDraft] = useState(null);
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {screen === 'configuration' ? (
        <ConfigurationScreen accessToken={accessToken} onBack={() => setScreen('moderation')} />
      ) : screen === 'moderation' ? (
        <CommandCenterScreen
          accessToken={accessToken}
          onOpenConfiguration={() => setScreen('configuration')}
        />
      ) : screen === 'reportDraft' ? (
        <ReportDraftScreen
          draft={draft}
          onBackToCamera={() => setScreen('camera')}
        />
      ) : (
        <CameraScreen
          showModerationShortcut={Boolean(accessToken)}
          onOpenModeration={() => setScreen('moderation')}
          onReportWithoutPhoto={() => {
            setDraft({ photo: null });
            setScreen('reportDraft');
          }}
          onPhotoAccepted={(photo) => {
            setDraft({ photo });
            setScreen('reportDraft');
          }}
        />
      )}
    </SafeAreaProvider>
  );
}
