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
import ZoneSetScreen from './screens/ZoneSetScreen.js';
import ReportDraftScreen from './screens/ReportDraftScreen.js';
import { useReportDraftQueue } from './hooks/useReportDraftQueue.js';

export default function App({ accessToken = null }) {
  const [screen, setScreen] = useState('camera');
  const [draftId, setDraftId] = useState(null);
  const [draftError, setDraftError] = useState(null);
  const draftQueue = useReportDraftQueue();
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

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
        <ReportDraftScreen
          draft={activeDraft}
          loading={draftQueue.loading || (!activeDraft && !draftError)}
          error={draftError ?? draftQueue.error}
          onBackToCamera={() => setScreen('camera')}
        />
      ) : (
        <CameraScreen
          showModerationShortcut={Boolean(accessToken)}
          onOpenModeration={() => setScreen('moderation')}
          onReportWithoutPhoto={() => {
            void openReportDraft(null);
          }}
          onPhotoAccepted={(photo) => {
            void openReportDraft(photo);
          }}
        />
      )}
    </SafeAreaProvider>
  );
}
