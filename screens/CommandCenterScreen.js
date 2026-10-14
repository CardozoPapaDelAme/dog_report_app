/**
 * @module screens/CommandCenterScreen
 * Container screen for moderation by an authenticated staff session: paginated moderation queue
 * with summary metrics, approve/hide/restore/delete commands (all but approve require a note), and
 * navigation to configuration, zone sets and duplicate management.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useModerationQueue } from '../hooks/useModerationQueue.js';
import { formatObservedAt, summarizeModerationPage } from '../models/moderation.js';
import { AppButton, AppTextField, Chip, Icon, Sheet } from '../components/ui/index.js';
import { colors, fontFamily, layout, radius, spacing, type } from '../theme/index.js';

// Commands that require a written reason (docs/API.md: note is required except for approve).
const NOTE_COMMANDS = {
  delete: {
    eyebrow: 'moderation.deleteEyebrow',
    title: 'moderation.deleteTitle',
    body: 'moderation.deleteBody',
    label: 'moderation.noteLabel',
    placeholder: 'moderation.notePlaceholder',
    confirm: 'moderation.confirmDelete',
    tone: colors.danger,
  },
  hide: {
    eyebrow: 'moderation.hideEyebrow',
    title: 'moderation.hideTitle',
    body: 'moderation.hideBody',
    label: 'moderation.hideNoteLabel',
    placeholder: 'moderation.hideNotePlaceholder',
    confirm: 'moderation.confirmHide',
    tone: colors.warning,
  },
  restore: {
    eyebrow: 'moderation.restoreEyebrow',
    title: 'moderation.restoreTitle',
    body: 'moderation.restoreBody',
    label: 'moderation.restoreNoteLabel',
    placeholder: 'moderation.restoreNotePlaceholder',
    confirm: 'moderation.confirmRestore',
    tone: colors.primary,
  },
};

/** Summary metric: only the value and its label (the label and number are the tile's whole content). `alert` colors a non-zero value. */
function Metric({ label, value, alert }) {
  const hot = alert && value > 0;
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, hot && styles.metricValueHot]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

/** Tool entry in the header: icon over a label, one per destination. */
function Tool({ icon, label, onPress }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.tool, pressed && styles.pressed]}>
      <Icon name={icon} size={22} color={colors.signal} />
      <Text style={styles.toolText}>{label}</Text>
    </Pressable>
  );
}

/** Moderation queue entry as an inbox row: severity bar, plain-text signals, and a flat action bar with only the allowed commands. */
function ReportCard({ report, busy, onApprove, onHide, onRestore, onDelete, t }) {
  const can = (command) => report.allowed_commands?.includes(command);
  const incident = t(`moderation.incidents.${report.incident_type}`, report.incident_type);
  const suspicious = report.location.mock_suspected || report.honeypot_suspected;
  const hidden = report.status === 'hidden';
  const actions = [
    can('approve') && { key: 'approve', label: t('moderation.approve'), color: colors.primary, onPress: () => onApprove(report.id), busy },
    can('hide') && { key: 'hide', label: t('moderation.hide'), color: colors.warning, onPress: () => onHide(report) },
    can('restore') && { key: 'restore', label: t('moderation.restore'), color: colors.primary, onPress: () => onRestore(report) },
    can('delete') && { key: 'delete', label: t('moderation.delete'), color: colors.danger, onPress: () => onDelete(report) },
  ].filter(Boolean);
  return (
    <View style={styles.item}>
      <View style={[styles.stripe, report.isHighSeverity && styles.stripeSevere]} />
      <View style={styles.itemBody}>
        <View style={styles.itemTop}>
          <View style={styles.itemTitleBlock}>
            <Text style={styles.incident}>{incident}</Text>
            <Text style={styles.timestamp}>{formatObservedAt(report.client_created_at)}</Text>
          </View>
          <Text style={[styles.status, hidden && styles.statusHidden]}>{t(`moderation.status.${report.status}`)}</Text>
        </View>

        {report.description ? <Text style={styles.description}>{report.description}</Text> : null}
        <View style={styles.meta}>
          <Text style={styles.metaText}>{t('moderation.trust')}: {report.trust?.tier ?? '-'}</Text>
          <Text style={styles.metaBar}>|</Text>
          <Text style={[styles.metaText, report.flagCount > 0 && styles.metaHot]}>{`${t('moderation.flags')}: ${report.flagCount}`}</Text>
          <Text style={styles.metaBar}>|</Text>
          <Text style={styles.metaText}>{`${t('moderation.photo')}: ${report.photo_available ? t('common.yes') : t('common.no')}`}</Text>
        </View>
        <View style={styles.place}>
          <Text style={styles.placeLabel}>{t('moderation.exactLocation')}</Text>
          <Text style={styles.coordinates}>{report.location.latitude.toFixed(5)}, {report.location.longitude.toFixed(5)}</Text>
        </View>
        {suspicious ? <Text style={styles.warningText}>{t('moderation.suspiciousSignals')}</Text> : null}
      </View>

      <View style={styles.actionBar}>
        {actions.map((action, index) => (
          <Pressable
            key={action.key}
            accessibilityRole="button"
            disabled={busy}
            onPress={action.onPress}
            style={({ pressed }) => [styles.actionCell, index > 0 && styles.actionDivider, pressed && styles.pressed, busy && styles.disabled]}
          >
            {action.busy ? <ActivityIndicator accessibilityLabel={t('common.loading')} color={action.color} /> : <Text style={[styles.actionText, { color: action.color }]}>{action.label}</Text>}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * @param {object} props
 * @param {string} props.accessToken - Session access token.
 * @param {() => void} props.onOpenConfiguration
 * @param {() => void} props.onOpenZoneSets
 * @param {() => void} props.onOpenDuplicates
 * @param {() => void} props.onLogout
 * @param {boolean} [props.logoutPending=false]
 * @returns {JSX.Element}
 */
export default function CommandCenterScreen({ accessToken, onOpenConfiguration, onOpenZoneSets, onOpenDuplicates, onLogout, logoutPending = false }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const queue = useModerationQueue(accessToken);
  const [noteTarget, setNoteTarget] = useState(null);
  const [note, setNote] = useState('');
  const columns = width >= 820 ? 2 : 1;
  const summary = summarizeModerationPage(queue.reports);
  const noteCopy = noteTarget ? NOTE_COMMANDS[noteTarget.command] : null;
  const canConfirm = Boolean(note.trim()) && !queue.pendingReportId;

  function closeNoteModal() {
    setNoteTarget(null);
    setNote('');
  }

  async function confirmNote() {
    if (!noteTarget || !note.trim()) return;
    const succeeded = await queue.execute(noteTarget.report.id, noteTarget.command, note.trim());
    if (succeeded) closeNoteModal();
  }

  const header = (
    <View>
      <View style={styles.hero}>
        <View pointerEvents="none" accessible={false} aria-hidden importantForAccessibility="no" style={styles.bigPaw}><Icon name="dog" size={210} color={colors.onPrimary} strokeWidth={1.4} /></View>
        <View style={styles.heroInner}>
          <View style={styles.titleRow}>
            <Text accessibilityRole="header" style={styles.title}>{t('commandCenter.title')}</Text>
            {onLogout ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('login.logout')} disabled={logoutPending} onPress={onLogout} hitSlop={6} style={({ pressed }) => [styles.logout, pressed && styles.pressed, logoutPending && styles.disabled]}>
                <Icon name="logout" size={22} color={colors.onPrimary} />
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.subtitle}>{t('commandCenter.subtitle')}</Text>
          {onOpenDuplicates || onOpenZoneSets || onOpenConfiguration ? (
            <View style={styles.tools}>
              {onOpenDuplicates ? <Tool icon="copy" label={t('duplicates.open')} onPress={onOpenDuplicates} /> : null}
              {onOpenZoneSets ? <Tool icon="map" label={t('zoneSets.open')} onPress={onOpenZoneSets} /> : null}
              {onOpenConfiguration ? <Tool icon="gauge" label={t('configuration.open')} onPress={onOpenConfiguration} /> : null}
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.metricsRow}>
        <Metric label={t('moderation.onPage')} value={summary.total} />
        <Metric label={t('moderation.flagged')} value={summary.flagged} alert />
        <Metric label={t('moderation.urgent')} value={summary.urgent} alert />
      </View>
      <View style={styles.queueIntro}>
        <Text accessibilityRole="header" style={styles.queueTitle}>{t('moderation.title')}</Text>
        <Text style={styles.pageScope}>{t('moderation.pageScope')}</Text>
      </View>
      {queue.error ? (
        <Pressable accessibilityRole="button" onPress={queue.refresh} style={styles.errorBanner}>
          <Icon name="alert" size={20} color={colors.onDangerSoft} />
          <View style={styles.errorText}>
            <Text style={styles.errorTitle}>{t('moderation.errorTitle')}</Text>
            <Text style={styles.errorBody}>{t('moderation.retry')}</Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );

  if (!accessToken) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.authState}>
          <View style={styles.lockMark}><Icon name="shield" size={30} color={colors.onPrimary} /></View>
          <Text style={styles.authTitle}>{t('moderation.sessionRequired')}</Text>
          <Text style={styles.authBody}>{t('moderation.sessionRequiredBody')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <FlatList
        key={columns}
        style={styles.list}
        data={queue.reports}
        numColumns={columns}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={columns === 2 ? styles.gridItem : null}>
            <ReportCard
              report={item}
              busy={queue.pendingReportId === item.id}
              onApprove={(id) => queue.execute(id, 'approve')}
              onHide={(report) => setNoteTarget({ report, command: 'hide' })}
              onRestore={(report) => setNoteTarget({ report, command: 'restore' })}
              onDelete={(report) => setNoteTarget({ report, command: 'delete' })}
              t={t}
            />
          </View>
        )}
        ListEmptyComponent={!queue.loading ? <Text style={styles.empty}>{t('moderation.empty')}</Text> : null}
        ListFooterComponent={queue.loading ? <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} style={styles.loader} /> : queue.nextCursor ? (
          <Pressable accessibilityRole="button" disabled={queue.loadingMore} onPress={queue.loadMore} style={styles.moreButton}>
            {queue.loadingMore ? <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} /> : <Text style={styles.moreText}>{t('moderation.loadMore')}</Text>}
          </Pressable>
        ) : <View style={styles.footerSpace} />}
        refreshControl={<RefreshControl refreshing={queue.refreshing} onRefresh={queue.refresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
        columnWrapperStyle={columns === 2 ? styles.gridRow : undefined}
      />

      {noteCopy ? (
        <Sheet keyboardAware onClose={closeNoteModal} maxHeight="90%">
          <Text accessibilityRole="header" style={styles.modalTitle}>{t(noteCopy.title)}</Text>
          <Text style={styles.modalBody}>{t(noteCopy.body)}</Text>
          <AppTextField
            label={t(noteCopy.label)}
            accessibilityLabel={t(noteCopy.label)}
            multiline
            maxLength={1000}
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            value={note}
            onChangeText={setNote}
            placeholder={t(noteCopy.placeholder)}
          />
          <View style={styles.modalActions}>
            <AppButton title={t('common.cancel')} variant="secondary" onPress={closeNoteModal} style={styles.modalCancel} />
            <AppButton title={t(noteCopy.confirm)} disabled={!canConfirm} onPress={confirmNote} style={[styles.modalConfirm, canConfirm && { backgroundColor: noteCopy.tone, borderColor: noteCopy.tone }]} />
          </View>
        </Sheet>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.primary },
  list: { backgroundColor: colors.background },
  content: { flexGrow: 1, backgroundColor: colors.background, paddingBottom: 32 },
  hero: { backgroundColor: colors.primary, overflow: 'hidden' },
  bigPaw: { position: 'absolute', right: -44, top: 56, opacity: 0.1, transform: [{ rotate: '-18deg' }] },
  heroInner: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: layout.margin, paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.lg },
  logout: { width: layout.minTouch, height: layout.minTouch, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(201,230,196,0.45)' },
  title: { flex: 1, fontFamily: fontFamily.display, fontSize: 35, lineHeight: 42, letterSpacing: -0.4, color: colors.onPrimary },
  subtitle: { ...type.body, fontSize: 15, lineHeight: 22, color: colors.onForest, maxWidth: 520 },
  tools: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  tool: { flex: 1, minHeight: 84, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(201,230,196,0.4)', backgroundColor: colors.forestField, padding: spacing.md, gap: spacing.sm, justifyContent: 'space-between' },
  toolText: { fontFamily: fontFamily.label, fontSize: 13, lineHeight: 17, color: colors.onPrimary },
  metricsRow: { flexDirection: 'row', width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: layout.margin, paddingVertical: spacing.xl, gap: spacing.lg },
  metric: { flex: 1, gap: 2 },
  metricValue: { fontFamily: fontFamily.number, fontVariant: ['tabular-nums'], fontSize: 34, lineHeight: 40, color: colors.primary },
  metricValueHot: { color: colors.danger },
  metricLabel: { fontFamily: fontFamily.label, fontSize: 13, lineHeight: 17, color: colors.inkMuted },
  queueIntro: { marginHorizontal: layout.margin, marginBottom: spacing.lg, gap: spacing.xs },
  queueTitle: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 32, color: colors.primary },
  pageScope: { ...type.caption, color: colors.inkMuted },
  gridRow: { gap: 1 },
  gridItem: { flex: 1, maxWidth: '50%' },
  item: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.outlineSoft },
  stripeSevere: { backgroundColor: colors.dangerAlert },
  itemBody: { paddingHorizontal: layout.margin, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  itemTitleBlock: { flex: 1, gap: 2 },
  incident: { fontFamily: fontFamily.displayMedium, fontSize: 21, lineHeight: 27, color: colors.ink },
  timestamp: { ...type.caption, color: colors.inkMuted, fontVariant: ['tabular-nums'] },
  status: { fontFamily: fontFamily.label, fontSize: 14, color: colors.warning, marginTop: 2 }, statusHidden: { color: colors.danger },
  description: { ...type.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  metaText: { fontFamily: fontFamily.labelMedium, fontSize: 13, color: colors.inkMuted }, metaHot: { fontFamily: fontFamily.label, color: colors.danger },
  metaBar: { fontSize: 13, color: colors.outlineSoft },
  place: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  placeLabel: { fontFamily: fontFamily.label, fontSize: 13, color: colors.inkMuted },
  coordinates: { fontFamily: fontFamily.labelMedium, fontVariant: ['tabular-nums'], fontSize: 14, color: colors.ink },
  warningText: { ...type.caption, fontSize: 13, color: colors.danger },
  actionBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border },
  actionCell: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center' }, actionDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
  actionText: { fontFamily: fontFamily.displayMedium, fontSize: 17 },
  pressed: { opacity: 0.78 }, disabled: { opacity: 0.42 },
  loader: { padding: 30 }, empty: { ...type.body, color: colors.inkMuted, textAlign: 'center', padding: 40 },
  moreButton: { alignSelf: 'center', borderColor: colors.primary, borderWidth: 1, borderRadius: 12, minWidth: 160, minHeight: layout.minTouch, padding: spacing.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  moreText: { ...type.button, fontSize: 15, color: colors.primary }, footerSpace: { height: 18 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.dangerSoft, borderRadius: radius.md, marginHorizontal: layout.margin, marginBottom: spacing.lg, padding: spacing.lg },
  errorText: { flex: 1 }, errorTitle: { fontFamily: fontFamily.label, fontSize: 15, color: colors.onDangerSoft }, errorBody: { ...type.caption, color: colors.onDangerSoft },
  authState: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 28 },
  lockMark: { width: 64, height: 64, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  authTitle: { fontFamily: fontFamily.display, fontSize: 28, lineHeight: 34, color: colors.primary, marginTop: spacing.xl, textAlign: 'center' },
  authBody: { ...type.body, fontSize: 15, lineHeight: 22, color: colors.inkMuted, marginTop: spacing.sm, maxWidth: 420, textAlign: 'center' },
  modalTitle: { fontFamily: fontFamily.display, fontSize: 28, lineHeight: 34, color: colors.ink },
  modalBody: { ...type.body, fontSize: 15, lineHeight: 22, color: colors.inkMuted },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  modalCancel: { flex: 1, borderRadius: 12 }, modalConfirm: { flex: 1.4, borderRadius: 12 },
});
