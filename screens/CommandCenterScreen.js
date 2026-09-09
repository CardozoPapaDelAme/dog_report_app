import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useModerationQueue } from '../hooks/useModerationQueue.js';
import { formatObservedAt, summarizeModerationPage } from '../models/moderation.js';

const colors = {
  background: '#f7fbf1', surface: '#ffffff', ink: '#191d17', muted: '#5d6859',
  outline: '#c0c9bb', primary: '#00450d', primarySoft: '#d9f2d4', warning: '#8a5700',
  warningSoft: '#fff0c2', danger: '#ba1a1a', dangerSoft: '#ffdad6', sky: '#e3f2fd',
};

function Metric({ label, value, tone }) {
  return (
    <View style={[styles.metric, tone === 'danger' && styles.metricDanger]}>
      <Text style={[styles.metricValue, tone === 'danger' && styles.metricValueDanger]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ReportCard({ report, busy, onApprove, onDelete, t }) {
  const canApprove = report.allowed_commands?.includes('approve');
  const canDelete = report.allowed_commands?.includes('delete');
  const incident = t(`moderation.incidents.${report.incident_type}`, report.incident_type);
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.incidentMark, report.isHighSeverity && styles.incidentMarkDanger]}>
          <Text style={styles.incidentMarkText}>{report.isHighSeverity ? '!' : 'R'}</Text>
        </View>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.incident}>{incident}</Text>
          <Text style={styles.timestamp}>{formatObservedAt(report.client_created_at)}</Text>
        </View>
        <View style={[styles.statusChip, report.status === 'hidden' && styles.hiddenChip]}>
          <Text style={styles.statusText}>{t(`moderation.status.${report.status}`)}</Text>
        </View>
      </View>

      {report.description ? <Text style={styles.description}>{report.description}</Text> : null}
      <View style={styles.signalRow}>
        <Text style={styles.signal}>{t('moderation.trust')}: {report.trust?.tier ?? '-'}</Text>
        <Text style={styles.signal}>{t('moderation.flags')}: {report.flagCount}</Text>
        <Text style={styles.signal}>{t('moderation.photo')}: {report.photo_available ? t('common.yes') : t('common.no')}</Text>
      </View>
      <View style={styles.locationBox}>
        <Text style={styles.locationLabel}>{t('moderation.exactLocation')}</Text>
        <Text style={styles.locationText}>
          {report.location.latitude.toFixed(5)}, {report.location.longitude.toFixed(5)}
        </Text>
        {report.location.mock_suspected || report.honeypot_suspected ? (
          <Text style={styles.warningText}>{t('moderation.suspiciousSignals')}</Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={!canApprove || busy}
          onPress={() => onApprove(report.id)}
          style={({ pressed }) => [styles.approveButton, pressed && styles.pressed, (!canApprove || busy) && styles.disabled]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.approveText}>{t('moderation.approve')}</Text>}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!canDelete || busy}
          onPress={() => onDelete(report)}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed, (!canDelete || busy) && styles.disabled]}
        >
          <Text style={styles.deleteText}>{t('moderation.delete')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function CommandCenterScreen({ accessToken }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const queue = useModerationQueue(accessToken);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [note, setNote] = useState('');
  const columns = width >= 820 ? 2 : 1;
  const summary = summarizeModerationPage(queue.reports);

  async function confirmDelete() {
    if (!deleteTarget || !note.trim()) return;
    const succeeded = await queue.execute(deleteTarget.id, 'delete', note.trim());
    if (succeeded) {
      setDeleteTarget(null);
      setNote('');
    }
  }

  const header = (
    <View>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{t('commandCenter.eyebrow')}</Text>
        <Text style={styles.title}>{t('commandCenter.title')}</Text>
        <Text style={styles.subtitle}>{t('commandCenter.subtitle')}</Text>
      </View>
      <View style={styles.metricsRow}>
        <Metric label={t('moderation.onPage')} value={summary.total} />
        <Metric label={t('moderation.flagged')} value={summary.flagged} tone="danger" />
        <Metric label={t('moderation.urgent')} value={summary.urgent} tone="danger" />
      </View>
      <View style={styles.queueIntro}>
        <Text style={styles.queueTitle}>{t('moderation.title')}</Text>
        <Text style={styles.pageScope}>{t('moderation.pageScope')}</Text>
      </View>
      {queue.error ? (
        <Pressable accessibilityRole="button" onPress={queue.refresh} style={styles.errorBanner}>
          <Text style={styles.errorTitle}>{t('moderation.errorTitle')}</Text>
          <Text style={styles.errorBody}>{t('moderation.retry')}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  if (!accessToken) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.authState}>
          <View style={styles.lockMark}><Text style={styles.lockText}>A</Text></View>
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
              onDelete={(report) => setDeleteTarget(report)}
              t={t}
            />
          </View>
        )}
        ListEmptyComponent={!queue.loading ? <Text style={styles.empty}>{t('moderation.empty')}</Text> : null}
        ListFooterComponent={queue.loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : queue.nextCursor ? (
          <Pressable accessibilityRole="button" disabled={queue.loadingMore} onPress={queue.loadMore} style={styles.moreButton}>
            {queue.loadingMore ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.moreText}>{t('moderation.loadMore')}</Text>}
          </Pressable>
        ) : <View style={styles.footerSpace} />}
        refreshControl={<RefreshControl refreshing={queue.refreshing} onRefresh={queue.refresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
        columnWrapperStyle={columns === 2 ? styles.gridRow : undefined}
      />

      <Modal transparent animationType="fade" visible={Boolean(deleteTarget)} onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>{t('moderation.deleteEyebrow')}</Text>
            <Text style={styles.modalTitle}>{t('moderation.deleteTitle')}</Text>
            <Text style={styles.modalBody}>{t('moderation.deleteBody')}</Text>
            <TextInput
              accessibilityLabel={t('moderation.noteLabel')}
              multiline
              maxLength={1000}
              value={note}
              onChangeText={setNote}
              placeholder={t('moderation.notePlaceholder')}
              placeholderTextColor={colors.muted}
              style={styles.noteInput}
            />
            <View style={styles.modalActions}>
              <Pressable accessibilityRole="button" onPress={() => { setDeleteTarget(null); setNote(''); }} style={styles.cancelButton}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={!note.trim()} onPress={confirmDelete} style={[styles.confirmDelete, !note.trim() && styles.disabled]}>
                <Text style={styles.confirmDeleteText}>{t('moderation.confirmDelete')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.primary },
  list: { backgroundColor: colors.background },
  content: { flexGrow: 1, backgroundColor: colors.background, paddingBottom: 32 },
  hero: { backgroundColor: colors.primary, paddingHorizontal: 22, paddingTop: 28, paddingBottom: 34 },
  eyebrow: { color: '#90d689', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: '#fff', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 28, lineHeight: 34, marginTop: 8 },
  subtitle: { color: '#d9f2d4', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 560 },
  metricsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: -18, marginBottom: 18 },
  metric: { flex: 1, minHeight: 72, backgroundColor: colors.surface, borderColor: colors.outline, borderWidth: 1, borderRadius: 16, padding: 12 },
  metricDanger: { backgroundColor: colors.dangerSoft, borderColor: '#ffb4ab' },
  metricValue: { color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 21 },
  metricValueDanger: { color: colors.danger },
  metricLabel: { color: colors.muted, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, marginTop: 3 },
  queueIntro: { marginHorizontal: 20, marginBottom: 16 },
  queueTitle: { color: colors.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 19 },
  pageScope: { color: colors.muted, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 18, marginTop: 3 },
  gridRow: { paddingHorizontal: 14, gap: 14 },
  gridItem: { flex: 1, maxWidth: '50%' },
  card: { backgroundColor: colors.surface, borderColor: '#dfe6da', borderWidth: 1, borderRadius: 18, marginHorizontal: 20, marginBottom: 14, padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  incidentMark: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  incidentMarkDanger: { backgroundColor: colors.dangerSoft },
  incidentMarkText: { color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17 },
  cardTitleBlock: { flex: 1, paddingHorizontal: 10 },
  incident: { color: colors.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16 },
  timestamp: { color: colors.muted, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, marginTop: 2 },
  statusChip: { borderRadius: 999, backgroundColor: colors.warningSoft, paddingHorizontal: 9, paddingVertical: 5 },
  hiddenChip: { backgroundColor: colors.dangerSoft },
  statusText: { color: colors.warning, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, textTransform: 'uppercase' },
  description: { color: colors.ink, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 21, marginTop: 14 },
  signalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  signal: { color: colors.muted, backgroundColor: '#f2f5ec', borderRadius: 8, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, paddingHorizontal: 8, paddingVertical: 5 },
  locationBox: { backgroundColor: colors.sky, borderRadius: 12, marginTop: 12, padding: 11 },
  locationLabel: { color: colors.muted, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, textTransform: 'uppercase' },
  locationText: { color: colors.ink, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, marginTop: 3 },
  warningText: { color: colors.danger, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  approveButton: { flex: 1.4, minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 14 },
  approveText: { color: '#fff', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  deleteButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderColor: colors.danger, borderWidth: 1, borderRadius: 14 },
  deleteText: { color: colors.danger, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  pressed: { opacity: 0.78 }, disabled: { opacity: 0.42 },
  loader: { padding: 30 }, empty: { color: colors.muted, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', padding: 40 },
  moreButton: { alignSelf: 'center', borderColor: colors.primary, borderWidth: 1, borderRadius: 999, minWidth: 150, padding: 13, alignItems: 'center', marginTop: 4 },
  moreText: { color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold' }, footerSpace: { height: 18 },
  errorBanner: { backgroundColor: colors.dangerSoft, borderColor: '#ffb4ab', borderWidth: 1, borderRadius: 14, marginHorizontal: 20, marginBottom: 16, padding: 13 },
  errorTitle: { color: colors.danger, fontFamily: 'PlusJakartaSans_700Bold' }, errorBody: { color: '#5f1715', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, marginTop: 2 },
  authState: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 28 },
  lockMark: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  lockText: { color: '#fff', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 24 },
  authTitle: { color: colors.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 23, marginTop: 20, textAlign: 'center' },
  authBody: { color: colors.muted, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 420, textAlign: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17, 25, 15, 0.58)' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 34 },
  modalEyebrow: { color: colors.danger, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  modalTitle: { color: colors.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, marginTop: 7 },
  modalBody: { color: colors.muted, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 21, marginTop: 7 },
  noteInput: { minHeight: 108, color: colors.ink, backgroundColor: '#f2f5ec', borderColor: colors.outline, borderWidth: 1, borderRadius: 12, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 16, padding: 12, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  cancelText: { color: colors.muted, fontFamily: 'PlusJakartaSans_700Bold' },
  confirmDelete: { flex: 1.4, alignItems: 'center', justifyContent: 'center', minHeight: 48, backgroundColor: colors.danger, borderRadius: 14 },
  confirmDeleteText: { color: '#fff', fontFamily: 'PlusJakartaSans_700Bold' },
});
