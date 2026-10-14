/**
 * @module components/DraftQueueBanner
 * Presentational banner for the offline report draft queue: terminal errors, syncing, pending
 * (with an optional retry action), scheduled retries and a transient "synced" notice.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fontFamily, layout, radius, spacing } from '../theme/index.js';

/** Chooses the banner tone, texts and optional action label; `null` when nothing should show. */
function queueBannerContent(t, summary = {}, synced = false) {
  const safeSummary = summary ?? {};
  if (safeSummary.terminalCount > 0) {
    return {
      tone: 'danger',
      title: t('camera.queue.terminalTitle'),
      body: t('camera.queue.terminalBody', { count: safeSummary.terminalCount }),
      action: null,
    };
  }
  if (safeSummary.isSyncing) {
    return {
      tone: 'pending',
      title: t('camera.queue.syncingTitle'),
      body: t('camera.queue.syncingBody'),
      action: null,
    };
  }
  if (safeSummary.pendingCount > 0) {
    if (safeSummary.canRetryNow) {
      return {
        tone: 'pending',
        title: t('camera.queue.pendingTitle'),
        body: t('camera.queue.pendingBody', { count: safeSummary.pendingCount }),
        action: t('camera.queue.retryNow'),
      };
    }
    return {
      tone: 'pending',
      title: t('camera.queue.scheduledTitle'),
      body: t('camera.queue.scheduledBody', { count: safeSummary.pendingCount }),
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

/**
 * @param {object} props
 * @param {ReturnType<typeof import('../models/reportDraft.js').summarizeReportDraftQueue> | null} [props.summary=null]
 *   Queue summary (`pendingCount`, `terminalCount`, `isSyncing`, `canRetryNow`, ...).
 * @param {boolean} [props.synced=false] - Shows the "synced" notice when nothing else applies.
 * @param {() => void} [props.onRetry] - Retry action; enabled only when `summary.canRetryNow` and not syncing.
 * @param {*} [props.style] - Extra container style.
 * @returns {JSX.Element | null} `null` when there is nothing to show.
 */
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
      style={[styles.slot, style]}
    >
      <View style={styles.banner}>
        <View style={styles.text}>
          <Text style={[styles.title, content.tone === 'danger' && styles.titleDanger, content.tone === 'success' && styles.titleSuccess]}>
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
            hitSlop={8}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Text style={styles.retryText}>{content.action}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { alignItems: 'center' },
  banner: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.lg, borderRadius: radius.lg, backgroundColor: 'rgba(0,0,0,0.66)', paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  text: { flexShrink: 1, gap: 1 },
  title: { color: colors.onPrimary, fontFamily: fontFamily.label, fontSize: 14, lineHeight: 19 },
  titleDanger: { color: '#ffb4ab' },
  titleSuccess: { color: colors.primaryFixed },
  body: { color: colors.onForest, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
  retryButton: { minHeight: layout.minTouch, justifyContent: 'center' },
  retryText: { color: colors.signal, fontFamily: fontFamily.displayMedium, fontSize: 15 },
  pressed: { opacity: 0.7 },
});
