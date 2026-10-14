/**
 * @module screens/CameraScreen
 * Container screen for the public reporting entry point: camera preview with capture and on-device
 * photo validation (`useCameraCapture`), rejection feedback, the draft queue banner, and shortcuts to
 * the map, staff login and reporting without a photo.
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import { useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DraftQueueBanner from '../components/DraftQueueBanner.js';
import { Icon, Scrim } from '../components/ui/index.js';
import { useCameraCapture } from '../hooks/useCameraCapture.js';
import { colors, fontFamily, layout, radius, spacing, type } from '../theme/index.js';

/** Two-finger pinch that drives the camera zoom (0 to 1); one-finger touches fall through to the controls. */
function usePinchZoom() {
  const [zoom, setZoom] = useState(0);
  const zoomRef = useRef(0);
  const gesture = useRef({ distance: 0, start: 0 });
  const distanceOf = (touches) => Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: (event) => event.nativeEvent.touches.length === 2,
    onMoveShouldSetPanResponder: (event) => event.nativeEvent.touches.length === 2,
    onPanResponderGrant: (event) => {
      const { touches } = event.nativeEvent;
      gesture.current = { distance: touches.length === 2 ? distanceOf(touches) : 0, start: zoomRef.current };
    },
    onPanResponderMove: (event) => {
      const { touches } = event.nativeEvent;
      if (touches.length !== 2) return;
      if (!gesture.current.distance) gesture.current = { distance: distanceOf(touches), start: zoomRef.current };
      const next = Math.min(1, Math.max(0, gesture.current.start + (distanceOf(touches) / gesture.current.distance - 1) * 0.6));
      zoomRef.current = next;
      setZoom(next);
    },
  })).current;
  return { zoom, handlers: responder.panHandlers };
}

/** Text control with an icon, readable over the camera scrim. */
function CameraLink({ icon, label, onPress, testID, disabled }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" disabled={disabled} onPress={onPress} hitSlop={6}
      style={({ pressed }) => [styles.link, pressed && styles.pressed, disabled && styles.disabled]}>
      {icon ? <Icon name={icon} size={20} color={colors.onPrimary} /> : null}
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

/** Joins translated rejection reasons, or returns a capture error message; `null` when none. */
function reasonText(t, state) {
  if (state.error) return t('camera.errors.capture');
  if (!state.reasons?.length) return null;
  return state.reasons.map((reason) => t(`camera.rejections.${reason}`)).join(' ');
}

/**
 * @param {object} props
 * @param {(photo: {photoUri: string, validation: object, validationSkipped: string | null}) => void} [props.onPhotoAccepted]
 *   Receives each accepted, persisted photo.
 * @param {() => void} [props.onReportWithoutPhoto]
 * @param {() => void} [props.onOpenModeration] - Used by the moderation shortcut.
 * @param {() => void} [props.onOpenLogin] - Shows the staff login shortcut when given.
 * @param {() => void} [props.onOpenMap] - Shows the map shortcut when given.
 * @param {boolean} [props.showModerationShortcut=false] - Shown only with camera permission.
 * @param {ReturnType<typeof import('../models/reportDraft.js').summarizeReportDraftQueue> | null} [props.draftQueueSummary=null]
 * @param {boolean} [props.draftQueueSynced=false]
 * @param {() => void} [props.onRetryDraftQueue]
 * @returns {JSX.Element}
 */
export default function CameraScreen({
  onPhotoAccepted,
  onReportWithoutPhoto,
  onOpenModeration,
  onOpenLogin,
  onOpenMap,
  showModerationShortcut = false,
  draftQueueSummary = null,
  draftQueueSynced = false,
  onRetryDraftQueue,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const pinch = usePinchZoom();
  const [permission, requestPermission] = useCameraPermissions();
  const capture = useCameraCapture({ onPhotoAccepted });
  const feedback = reasonText(t, capture.captureState);
  const hasPermission = Boolean(permission?.granted);
  const validating = capture.captureState.phase === 'validating';
  const busy = capture.captureState.phase === 'capturing' || validating;
  const captureDisabled = busy || !capture.cameraReady || !hasPermission;

  return (
    <View testID="camera-screen" style={styles.root}>
      {hasPermission ? (
        <CameraView
          testID="camera-preview"
          ref={capture.cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="picture"
          zoom={pinch.zoom}
          onCameraReady={() => capture.setCameraReady(true)}
        />
      ) : (
        <View style={styles.cameraFallback} />
      )}

      {hasPermission ? <View style={StyleSheet.absoluteFill} {...pinch.handlers} /> : null}

      {hasPermission ? (
        <>
          <Scrim edge="top" height={130 + insets.top} strength={0.55} />
          <Scrim edge="bottom" height={280 + insets.bottom} strength={0.72} />
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            {onOpenMap ? <CameraLink icon="map" label={t('camera.openMap')} onPress={onOpenMap} /> : <View />}
            <View style={styles.topBarRight}>
              {onOpenLogin ? <CameraLink icon="shield" label={t('camera.staffLogin')} onPress={onOpenLogin} /> : null}
              {showModerationShortcut ? <CameraLink icon="settings" label={t('camera.admin')} onPress={onOpenModeration} /> : null}
            </View>
          </View>
        </>
      ) : null}

      <DraftQueueBanner
        summary={draftQueueSummary}
        synced={draftQueueSynced}
        onRetry={onRetryDraftQueue}
        style={[styles.queueBannerPosition, { top: insets.top + 64 }]}
      />

      {!hasPermission ? (
        <View style={[styles.permission, { paddingTop: insets.top + spacing.xxl, paddingBottom: Math.max(insets.bottom, spacing.xxl) }]}>
          <View pointerEvents="none" accessible={false} aria-hidden importantForAccessibility="no" style={styles.permissionPaw}>
            <Icon name="dog" size={260} color={colors.onPrimary} strokeWidth={1.3} />
          </View>
          {!permission ? (
            <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.signal} />
          ) : (
            <>
              <View style={styles.permissionText}>
                <Icon name="camera" size={40} color={colors.signal} />
                <Text accessibilityRole="header" style={styles.permissionTitle}>{t('camera.permissionTitle')}</Text>
                <Text style={styles.permissionBody}>{t('camera.permissionBody')}</Text>
              </View>
              <View style={styles.permissionActions}>
                <Pressable accessibilityRole="button" onPress={requestPermission} style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}>
                  <Text style={styles.permissionButtonText}>{t('camera.permissionButton')}</Text>
                </Pressable>
                <View style={styles.permissionLinks}>
                  {onOpenMap ? <CameraLink icon="map" label={t('camera.openMap')} onPress={onOpenMap} /> : null}
                  {onOpenLogin ? <CameraLink icon="shield" label={t('camera.staffLogin')} onPress={onOpenLogin} /> : null}
                </View>
              </View>
            </>
          )}
        </View>
      ) : null}

      {feedback && hasPermission ? (
        <View pointerEvents="box-none" style={styles.noticeSlot}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t('camera.retryTitle')}. ${feedback}`} onPress={capture.clearFeedback} style={styles.notice}>
            <Icon name="alert" size={18} color={colors.warningAmber} />
            <Text style={styles.noticeText}>{feedback}</Text>
          </Pressable>
        </View>
      ) : null}

      {validating ? (
        <View pointerEvents="none" style={styles.noticeSlot}>
          <View style={styles.notice}>
            <ActivityIndicator accessibilityLabel={t('camera.validating')} color={colors.onPrimary} />
            <Text style={styles.noticeText}>{t('camera.validating')}</Text>
          </View>
        </View>
      ) : null}

      {hasPermission ? (
        <View style={[styles.bottomPanel, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
          <Text style={styles.helper}>{t('camera.helper')}</Text>
          <Pressable
            testID="camera-capture"
            accessibilityRole="button"
            accessibilityLabel={t('camera.capture')}
            accessibilityState={{ busy, disabled: captureDisabled }}
            disabled={captureDisabled}
            onPress={capture.capture}
            style={({ pressed }) => [styles.captureButton, pressed && styles.captureActive, captureDisabled && styles.captureDisabled]}
          >
            {busy ? <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.onPrimary} /> : null}
          </Pressable>
          <CameraLink testID="camera-without-photo" icon="pencil" label={t('camera.withoutPhoto')} disabled={busy} onPress={onReportWithoutPhoto} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  cameraFallback: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.primary },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: layout.margin },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: layout.minTouch },
  linkText: { fontFamily: fontFamily.label, fontSize: 14, color: colors.onPrimary, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  permission: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.primary, paddingHorizontal: layout.margin, justifyContent: 'space-between', overflow: 'hidden' },
  permissionPaw: { position: 'absolute', right: -60, top: 140, opacity: 0.1, transform: [{ rotate: '-18deg' }] },
  permissionText: { gap: spacing.lg, marginTop: spacing.xxl },
  permissionTitle: { fontFamily: fontFamily.display, fontSize: 40, lineHeight: 46, letterSpacing: -0.4, color: colors.onPrimary },
  permissionBody: { ...type.body, fontSize: 16, lineHeight: 24, color: colors.onForest, maxWidth: 420 },
  permissionActions: { gap: spacing.md },
  permissionButton: { minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.signal },
  permissionButtonText: { fontFamily: fontFamily.displayMedium, fontSize: 19, color: colors.forestDeep },
  permissionLinks: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl },
  noticeSlot: { position: 'absolute', top: '17%', left: layout.margin, right: layout.margin, alignItems: 'center' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, maxWidth: '100%', borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.66)', paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg },
  noticeText: { flexShrink: 1, fontFamily: fontFamily.label, fontSize: 14, lineHeight: 19, color: colors.onPrimary },
  bottomPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: spacing.md, paddingHorizontal: layout.margin },
  helper: { fontFamily: fontFamily.label, fontSize: 14, textAlign: 'center', color: colors.onPrimary, textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  captureButton: { width: 78, height: 78, borderRadius: 39, borderWidth: 5, borderColor: colors.onPrimary, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  queueBannerPosition: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  captureDisabled: { opacity: 0.62 }, captureActive: { transform: [{ scale: 0.94 }], backgroundColor: 'rgba(255,255,255,0.28)' },
  pressed: { opacity: 0.7 }, disabled: { opacity: 0.5 },
});
