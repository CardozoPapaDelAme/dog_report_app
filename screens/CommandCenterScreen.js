/**
 * @module screens/CommandCenterScreen
 * Container screen for moderation by an authenticated staff session: paginated moderation queue
 * with summary metrics, approve/hide/restore/delete commands (all but approve require a note), and
 * navigation to configuration, zone sets and duplicate management.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useModerationQueue } from '../hooks/useModerationQueue.js';
import { formatObservedAt, summarizeModerationPage } from '../models/moderation.js';
import { severityLevel } from '../models/publicMap.js';
import { AppButton, AppTextField, Icon, PinGlyph, Sheet } from '../components/ui/index.js';
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

/** Summary metric: only the value and its label. `lead` (the page total) is the big one; the others share one smaller size. `alert` colors a non-zero value. */
function Metric({ label, value, alert, lead }) {
  const hot = alert && value > 0;
  return (
    <View style={styles.metric}>
      <Text style={[lead ? styles.metricLeadValue : styles.metricValue, hot && styles.metricValueHot]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

/** Destination in the header toolbar: white icon and label, separated from its neighbours by a hairline. */
function Tool({ icon, label, onPress, last }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.tool, !last && styles.toolDivider, pressed && styles.pressed]}>
      <Icon name={icon} size={20} color={colors.onPrimary} />
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
    can('hide') && { key: 'hide', label: t('moderation.hide'), color: colors.ink, onPress: () => onHide(report) },
    can('restore') && { key: 'restore', label: t('moderation.restore'), color: colors.primary, onPress: () => onRestore(report) },
    can('delete') && { key: 'delete', label: t('moderation.delete'), color: colors.danger, onPress: () => onDelete(report) },
  ].filter(Boolean);
  return (
    <View style={styles.item}>
      <View style={styles.itemBody}>
        <View style={styles.itemTop}>
          <PinGlyph scale={0.72} color={hidden ? colors.outline : colors.severity[severityLevel(report.incident_type)]} flagged={report.flagCount > 0} style={styles.pin} />
          <View style={styles.itemTitleBlock}>
            <Text style={styles.incident}>{incident}</Text>
            <View style={styles.timeRow}>
              <Text style={styles.timestamp}>{formatObservedAt(report.client_created_at)}</Text>
            </View>
          </View>
          <Text style={[styles.status, hidden && styles.statusHidden]}>{t(`moderation.status.${report.status}`)}</Text>
        </View>
        {report.description ? <Text style={styles.description}>{report.description}</Text> : null}
        <View style={styles.meta}>
          <Text style={styles.metaText}>{t('moderation.trust')}: {t(`moderation.tier.${report.trust?.tier}`, report.trust?.tier ?? '-')}</Text>
          {report.flagCount > 0 ? <Text style={[styles.metaText, styles.metaHot]}>{`${t('moderation.flags')}: ${report.flagCount}`}</Text> : null}
          {report.photo_available ? <Text style={styles.metaText}>{`${t('moderation.photo')}: ${t('common.yes')}`}</Text> : null}
        </View>
        <View style={styles.place} accessible accessibilityLabel={`${t('moderation.exactLocation')}: ${report.location.latitude.toFixed(5)}, ${report.location.longitude.toFixed(5)}`}>
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

/** Placeholder rows with the shape of a report while the first page loads. */
function QueueSkeleton({ label }) {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      {[0, 1].map((key) => (
        <View key={key} style={styles.item}>
          <View style={styles.itemBody}>
            <View style={styles.itemTop}>
              <View style={styles.skelPin} />
              <View style={styles.itemTitleBlock}>
                <View style={[styles.skelLine, { width: '60%', height: 18 }]} />
                <View style={[styles.skelLine, { width: '40%' }]} />
              </View>
            </View>
            <View style={[styles.skelLine, { width: '90%' }]} />
            <View style={[styles.skelLine, { width: '55%' }]} />
          </View>
          <View style={[styles.actionBar, styles.skelBar]} />
        </View>
      ))}
    </View>
  );
}

/**
 * @param {object} props
 * @param {string} props.accessToken - Session access token.
 * @param {() => void} props.onOpenConfiguration
 * @param {() => void} props.onOpenZoneSets
 * @param {() => void} props.onOpenDuplicates
 * @param {() => void} [props.onOpenDataExport] - Opens the accepted-report query and CSV/XLSX export (clarification #27).
 * @param {() => void} props.onLogout
 * @param {boolean} [props.logoutPending=false]
 * @returns {JSX.Element}
 */
export default function CommandCenterScreen({ accessToken, onOpenConfiguration, onOpenZoneSets, onOpenDuplicates, onOpenDataExport, onLogout, logoutPending = false }) {
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

  const toolItems = [
    onOpenDuplicates && { icon: 'copy', label: t('duplicates.open'), onPress: onOpenDuplicates },
    onOpenZoneSets && { icon: 'map', label: t('zoneSets.open'), onPress: onOpenZoneSets },
    onOpenDataExport && { icon: 'download', label: t('commandCenter.exportData'), onPress: onOpenDataExport },
    onOpenConfiguration && { icon: 'gauge', label: t('configuration.open'), onPress: onOpenConfiguration },
  ].filter(Boolean);

  const header = (
    <View>
      <View style={styles.hero}>
        <View pointerEvents="none" accessible={false} aria-hidden importantForAccessibility="no" style={styles.bigPaw}><Icon name="dog" size={260} color={colors.onPrimary} strokeWidth={1.3} /></View>
        <View style={styles.heroInner}>
          <View style={styles.titleRow}>
            <Text accessibilityRole="header" style={styles.title}>{t('commandCenter.title')}</Text>
            {onLogout ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('login.logout')} disabled={logoutPending} onPress={onLogout} hitSlop={6} style={({ pressed }) => [styles.logout, pressed && styles.pressed, logoutPending && styles.disabled]}>
                <Icon name="logout" size={20} color={colors.onPrimary} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.metricsRow}>
            <Metric lead label={t('moderation.onPage')} value={summary.total} />
            <View style={styles.metricStack}>
              <Metric label={t('moderation.urgent')} value={summary.urgent} alert />
              <Metric label={t('moderation.flagged')} value={summary.flagged} alert />
            </View>
          </View>
        </View>
        {toolItems.length ? (
          <View style={styles.tools}>
            {toolItems.map((tool, index) => <Tool key={tool.icon} {...tool} last={index === toolItems.length - 1} />)}
          </View>
        ) : null}
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
        ListFooterComponent={queue.loading ? <QueueSkeleton label={t('common.loading')} /> : queue.nextCursor ? (
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
  bigPaw: { position: 'absolute', right: -64, top: 4, opacity: 0.1, transform: [{ rotate: '-18deg' }] },
  heroInner: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: layout.margin },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  logout: { width: layout.minTouch, height: layout.minTouch, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: fontFamily.display, fontSize: 32, lineHeight: 38, color: colors.onPrimary },
  tools: { flexDirection: 'row', borderTopWidth: 1, borderColor: colors.forestLine, backgroundColor: colors.forestShade },
  tool: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  toolText: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16, color: colors.onForest, textAlign: 'center' }, toolDivider: { borderRightWidth: 1, borderRightColor: colors.forestLine },
  metricsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  metric: { gap: 0 },
  metricLeadValue: { fontFamily: fontFamily.display, fontVariant: ['tabular-nums'], fontSize: 76, lineHeight: 80, color: colors.onPrimary },
  metricStack: { gap: spacing.md },
  metricValue: { fontFamily: fontFamily.display, fontVariant: ['tabular-nums'], fontSize: 28, lineHeight: 32, color: colors.onPrimary },
  metricValueHot: { color: colors.onForestAlert },
  metricLabel: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16, color: colors.onForest },
  queueIntro: { marginHorizontal: layout.margin, marginTop: spacing.xl, marginBottom: spacing.md, gap: 2 },
  queueTitle: { fontFamily: fontFamily.display, fontSize: 22, lineHeight: 28, color: colors.ink },
  pageScope: { ...type.caption, fontSize: 12, color: colors.inkMuted },
  gridRow: { gap: spacing.md },
  gridItem: { flex: 1, maxWidth: '50%' },
  item: { backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.outlineSoft, marginBottom: spacing.md },
  itemBody: { paddingHorizontal: layout.margin, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  pin: { marginTop: 2, marginLeft: -4, marginRight: -2 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  itemTitleBlock: { flex: 1, gap: 2 },
  incident: { fontFamily: fontFamily.display, fontSize: 20, lineHeight: 26, color: colors.ink },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  timestamp: { ...type.caption, color: colors.inkMuted, fontVariant: ['tabular-nums'] },
  status: { fontFamily: fontFamily.label, fontSize: 13, color: colors.inkMuted, marginTop: 2 }, statusHidden: { color: colors.inkSubtle },
  description: { ...type.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  metaText: { fontFamily: fontFamily.labelMedium, fontSize: 13, color: colors.inkMuted }, metaHot: { fontFamily: fontFamily.label, color: colors.danger },
  
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  coordinates: { fontFamily: fontFamily.labelMedium, fontVariant: ['tabular-nums'], fontSize: 14, color: colors.ink },
  warningText: { ...type.caption, fontSize: 13, color: colors.danger },
  actionBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  actionCell: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center' }, actionDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
  skelPin: { width: 34, height: 43, borderRadius: radius.pill, backgroundColor: colors.surfaceHigh },
  skelLine: { height: 12, borderRadius: radius.xs, backgroundColor: colors.surfaceContainer },
  skelBar: { minHeight: 52 },
  actionText: { fontFamily: fontFamily.semibold, fontSize: 15 },
  pressed: { opacity: 0.78 }, disabled: { opacity: 0.42 },
  empty: { ...type.body, color: colors.inkMuted, textAlign: 'center', padding: 40 },
  moreButton: { alignSelf: 'center', borderColor: colors.primary, borderWidth: 1, borderRadius: radius.md, minWidth: 160, minHeight: layout.minTouch, padding: spacing.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
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
  modalCancel: { flex: 1, borderRadius: radius.md }, modalConfirm: { flex: 1.4, borderRadius: radius.md },
});
