import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCameraCapture } from '../hooks/useCameraCapture.js';

const colors = {
  ink: '#191d17',
  inverse: '#eff2e9',
  primary: '#00450d',
  primarySoft: '#d9f2d4',
  warning: '#8a5700',
  warningSoft: '#fff0c2',
  danger: '#ba1a1a',
  dangerSoft: '#ffdad6',
  glass: 'rgba(18, 18, 18, 0.56)',
  line: 'rgba(255, 255, 255, 0.36)',
};

function reasonText(t, state) {
  if (state.error) return t('camera.errors.capture');
  if (!state.rejection) return null;
  return t(`camera.rejections.${state.rejection}`);
}

export default function CameraScreen({
  onPhotoAccepted,
  onReportWithoutPhoto,
  onOpenModeration,
  showModerationShortcut = false,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const capture = useCameraCapture({ onPhotoAccepted });
  const feedback = reasonText(t, capture.captureState);
  const busy = capture.captureState.phase === 'capturing';
  const captureDisabled = busy || !capture.cameraReady;

  if (!permission) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>{t('camera.permissionTitle')}</Text>
          <Text style={styles.permissionBody}>{t('camera.permissionBody')}</Text>
          <Pressable accessibilityRole="button" onPress={requestPermission} style={styles.permissionButton}>
            <Text style={styles.permissionButtonText}>{t('camera.permissionButton')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={capture.cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="picture"
        onCameraReady={() => capture.setCameraReady(true)}
      />
      <View pointerEvents="none" style={styles.vignette} />

      {showModerationShortcut ? (
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <View style={styles.topBarSpacer} />
          <Pressable accessibilityRole="button" onPress={onOpenModeration} style={styles.adminButton}>
            <Text style={styles.adminText}>{t('camera.admin')}</Text>
          </Pressable>
        </View>
      ) : null}

      {feedback ? (
        <Pressable accessibilityRole="button" onPress={capture.clearFeedback} style={styles.toast}>
          <Text style={styles.toastTitle}>{t('camera.retryTitle')}</Text>
          <Text style={styles.toastBody}>{feedback}</Text>
        </Pressable>
      ) : null}

      <View style={[styles.bottomPanel, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onReportWithoutPhoto}
          style={({ pressed }) => [styles.noPhotoButton, pressed && styles.pressed, busy && styles.disabled]}
        >
          <Text style={styles.noPhotoText}>{t('camera.withoutPhoto')}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy, disabled: captureDisabled }}
          disabled={captureDisabled}
          onPress={capture.capture}
          style={({ pressed }) => [
            styles.captureButton,
            pressed && styles.pressed,
            captureDisabled && styles.captureDisabled,
          ]}
        >
          {busy ? <ActivityIndicator color={colors.primary} /> : <View style={styles.captureInner} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  vignette: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.12)' },
  stateScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7fbf1', padding: 24 },
  permissionCard: { width: '100%', maxWidth: 420, borderRadius: 16, backgroundColor: '#ffffff', padding: 20, gap: 12 },
  permissionTitle: { color: colors.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, lineHeight: 29 },
  permissionBody: { color: '#5d6859', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 21 },
  permissionButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primary },
  permissionButtonText: { color: '#ffffff', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingHorizontal: 20 },
  topBarSpacer: { flex: 1 },
  adminButton: { minHeight: 42, justifyContent: 'center', borderRadius: 999, backgroundColor: colors.glass, borderColor: colors.line, borderWidth: 1, paddingHorizontal: 14 },
  adminText: { color: colors.inverse, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12 },
  toast: { position: 'absolute', top: '18%', left: 20, right: 20, borderRadius: 14, borderColor: '#ffa000', borderWidth: 1, backgroundColor: colors.warningSoft, padding: 14 },
  toastTitle: { color: colors.warning, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  toastBody: { color: '#4a3510', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 19, marginTop: 3 },
  bottomPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 16 },
  noPhotoButton: { minHeight: 46, minWidth: 178, justifyContent: 'center', borderRadius: 999, backgroundColor: colors.glass, borderColor: colors.line, borderWidth: 1, paddingHorizontal: 18 },
  noPhotoText: { color: colors.inverse, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, textAlign: 'center' },
  captureButton: { width: 82, height: 82, borderRadius: 999, borderWidth: 5, borderColor: colors.primary, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  captureInner: { width: 57, height: 57, borderRadius: 999, backgroundColor: '#ffffff', borderColor: '#d8dbd2', borderWidth: 1 },
  captureDisabled: { opacity: 0.62 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
});
