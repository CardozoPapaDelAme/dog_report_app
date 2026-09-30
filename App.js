import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useCallback, useState } from 'react';

import './i18n';
import CameraScreen from './screens/CameraScreen.js';
import CommandCenterScreen from './screens/CommandCenterScreen.js';
import ConfigurationScreen from './screens/ConfigurationScreen.js';
import ZoneSetScreen from './screens/ZoneSetScreen.js';
import ReportFormScreen from './screens/ReportFormScreen.js';
import { useReportDraftFlow } from './hooks/useReportDraftFlow.js';

export default function App({ accessToken = null }) {
  const [screen, setScreen] = useState('camera');
  const openReportForm = useCallback(() => setScreen('reportDraft'), []);
  const reportDraftFlow = useReportDraftFlow({ onOpenReportForm: openReportForm });
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
      {screen === 'zoneSets' ? (
        <ZoneSetScreen accessToken={accessToken} onBack={() => setScreen('moderation')} />
      ) : screen === 'configuration' ? (
        <ConfigurationScreen accessToken={accessToken} onBack={() => setScreen('moderation')} />
      ) : screen === 'moderation' ? (
        <CommandCenterScreen
          accessToken={accessToken}
          onOpenConfiguration={() => setScreen('configuration')}
          onOpenZoneSets={() => setScreen('zoneSets')}
        />
      ) : screen === 'reportDraft' ? (
        <ReportFormScreen
          draft={reportDraftFlow.activeDraft}
          loading={reportDraftFlow.loading}
          error={reportDraftFlow.error}
          queueDraft={reportDraftFlow.queueDraft}
          syncDraft={reportDraftFlow.syncDraft}
          onBackToCamera={() => setScreen('camera')}
        />
      ) : (
        <CameraScreen
          showModerationShortcut={Boolean(accessToken)}
          onOpenModeration={() => setScreen('moderation')}
          onReportWithoutPhoto={() => {
            void reportDraftFlow.openReportDraft(null);
          }}
          onPhotoAccepted={(photo) => {
            void reportDraftFlow.openReportDraft(photo);
          }}
        />
      )}
    </SafeAreaProvider>
  );
}
