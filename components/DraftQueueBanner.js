import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

const colors = {
  ink: '#191d17',
  primary: '#00450d',
  primarySoft: '#d9f2d4',
  warning: '#8a5700',
  warningSoft: '#fff0c2',
  danger: '#ba1a1a',
  dangerSoft: '#ffdad6',
};

function queueBannerContent(t, summary = {}, synced = false) {
  if (summary.terminalCount > 0) {
    return {
      tone: 'danger',
      title: t('camera.queue.terminalTitle'),
      body: t('camera.queue.terminalBody', { count: summary.terminalCount }),
      action: null,
    };
  }
  if (summary.isSyncing) {
    return {
      tone: 'pending',
      title: t('camera.queue.syncingTitle'),
      body: t('camera.queue.syncingBody'),
      action: null,
    };
  }
  if (summary.pendingCount > 0) {
    if (summary.canRetryNow) {
      return {
        tone: 'pending',
        title: t('camera.queue.pendingTitle'),
        body: t('camera.queue.pendingBody', { count: summary.pendingCount }),
        action: t('camera.queue.retryNow'),
      };
    }
    return {
      tone: 'pending',
      title: t('camera.queue.scheduledTitle'),
      body: t('camera.queue.scheduledBody', { count: summary.pendingCount }),
      action: null,
    };
  }
  if (synced) {
    return {
      tone: 'success',
      title: t('camera.queue.syncedTitle'),
      body: t('camera.queue.syncedBody'),
      action: null,
    };
  }
  return null;
}

export default function DraftQueueBanner({
  summary = null,
  synced = false,
  onRetry,
  style,
}) {
  const { t } = useTranslation();
  const content = queueBannerContent(t, summary, synced);
  if (!content) return null;

  return (
    <View
      testID="draft-queue-banner"
      accessibilityLiveRegion="polite"
      style={[
        styles.banner,
        content.tone === 'danger' && styles.bannerDanger,
        content.tone === 'success' && styles.bannerSuccess,
        style,
      ]}
    >
      <View style={styles.text}>
        <Text style={[
          styles.title,
          content.tone === 'danger' && styles.titleDanger,
          content.tone === 'success' && styles.titleSuccess,
        ]}>
          {content.title}
        </Text>
        <Text style={styles.body}>{content.body}</Text>
      </View>
      {content.action ? (
        <Pressable
          testID="draft-queue-retry"
          accessibilityRole="button"
          accessibilityState={{ disabled: !summary?.canRetryNow || summary?.isSyncing }}
          disabled={!summary?.canRetryNow || summary?.isSyncing}
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.retryText}>{content.action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { minHeight: 72, borderRadius: 14, borderWidth: 1, borderColor: '#e2cf83', backgroundColor: colors.warningSoft, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  bannerDanger: { borderColor: '#eeaaa2', backgroundColor: colors.dangerSoft },
  bannerSuccess: { borderColor: '#b9dcb3', backgroundColor: colors.primarySoft },
  text: { flex: 1, gap: 3 },
  title: { color: colors.warning, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 19 },
  titleDanger: { color: colors.danger },
  titleSuccess: { color: colors.primary },
  body: { color: colors.ink, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 17 },
  retryButton: { minHeight: 40, justifyContent: 'center', borderRadius: 999, backgroundColor: colors.primary, paddingHorizontal: 12 },
  retryText: { color: '#ffffff', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, textAlign: 'center' },
  pressed: { opacity: 0.75 },
});
