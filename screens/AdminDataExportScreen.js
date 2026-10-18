/**
 * @module screens/AdminDataExportScreen
 * Administrator page for querying the accepted canonical projection and downloading it as CSV/XLSX
 * (clarification #27). Opened from the Command Center; it reuses the association query hook, the
 * export models and the report card, but is its own screen with the Command Center look.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createAssociationCsv, getAssociationQuickRange } from '../models/associationReport.js';
import { createAssociationXlsx } from '../models/associationWorkbook.js';
import { useAssociationReports } from '../hooks/useAssociationReports.js';
import { saveAssociationCsv, saveAssociationXlsx } from '../services/associationExport';
import AssociationDatePicker from '../components/associationDatePicker.js';
import AssociationReportCard from '../components/associationReportCard.js';
import { AssociationTotal } from '../components/associationSummaryCard.js';
import { AppButton, Icon, Pager, StateView } from '../components/ui/index.js';
import { colors, fontFamily, layout, radius, spacing, type } from '../theme/index.js';

/** Reports shown per page in the list. */
const PAGE_SIZE = 5;

/**
 * @param {object} props
 * @param {string} props.accessToken - Administrator session access token.
 * @param {() => void} props.onBack - Returns to the Command Center.
 * @param {boolean} [props.logoutPending=false] - Disables export while the session is closing.
 * @param {Function} [props.getPage] - Page request override for `useAssociationReports`.
 * @param {(file: {filename: string, content: string}) => Promise<void>} [props.saveCsv=saveAssociationCsv]
 * @param {(file: {filename: string, content: Uint8Array}) => Promise<void>} [props.saveXlsx=saveAssociationXlsx]
 * @returns {JSX.Element}
 */
export default function AdminDataExportScreen({ accessToken, onBack, logoutPending = false, getPage, saveCsv = saveAssociationCsv, saveXlsx = saveAssociationXlsx }) {
  const { t, i18n } = useTranslation();
  const initialRange = getAssociationQuickRange('last30Days');
  const [fromDay, setFromDay] = useState(initialRange.fromDay);
  const [toDay, setToDay] = useState(initialRange.toDay);
  const [activePreset, setActivePreset] = useState('last30Days');
  const [calendarField, setCalendarField] = useState(null);
  const [exportingFormat, setExportingFormat] = useState(null);
  const [exportError, setExportError] = useState(null);
  const [page, setPage] = useState(0);
  const listRef = useRef(null);
  const reports = useAssociationReports(accessToken, getPage);
  const { loadRange } = reports;
  useEffect(() => { loadRange(fromDay, toDay); }, [loadRange]);

  const rows = reports.rows;
  const applied = reports.dates?.fromDay === fromDay && reports.dates?.toDay === toDay;
  const resolvedRange = applied && (reports.phase === 'ready' || reports.phase === 'empty');
  const dateErrors = applied ? reports.errors : {};
  const loadingPhase = reports.phase === 'loading';
  const canExport = reports.phase === 'ready' && applied && !exportingFormat && !logoutPending;
  const showReports = reports.phase === 'ready' && applied;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  useEffect(() => { setPage(0); }, [rows]);

  function applyPreset(preset) {
    const range = getAssociationQuickRange(preset);
    setFromDay(range.fromDay);
    setToDay(range.toDay);
    setActivePreset(preset);
    setExportError(null);
    loadRange(range.fromDay, range.toDay);
  }

  function selectCustomDate(day) {
    const choosingStart = calendarField === 'from';
    if (choosingStart) setFromDay(day);
    else if (calendarField === 'to') setToDay(day);
    setActivePreset('custom');
    setExportError(null);
    setCalendarField(choosingStart ? 'to' : null);
  }

  function displayDay(day) {
    return new Date(`${day}T12:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async function exportReports(format) {
    if (!canExport) return;
    setExportingFormat(format);
    setExportError(null);
    try {
      const filename = `reportes-aceptados_${reports.dates.fromDay}_${reports.dates.toDay}.${format}`;
      if (format === 'xlsx') await saveXlsx({ filename, content: createAssociationXlsx(rows) });
      else await saveCsv({ filename, content: createAssociationCsv(rows) });
    } catch (error) { setExportError(error); }
    finally { setExportingFormat(null); }
  }

  const status = loadingPhase ? t('associationDashboard.loading')
    : (reports.phase === 'ready' || reports.phase === 'empty') && !applied ? t('associationDashboard.applyFilters')
    : reports.phase === 'empty' ? t('associationDashboard.empty')
    : reports.phase === 'invalid' ? t('associationDashboard.invalid')
    : reports.phase === 'session' ? t('associationDashboard.session')
    : reports.phase === 'forbidden' ? t('adminExport.forbidden')
    : reports.phase === 'error' ? t('associationDashboard.error')
    : reports.phase === 'idle' ? t('associationDashboard.idle') : null;

  const header = <View style={styles.hero}>
    <View pointerEvents="none" accessible={false} aria-hidden importantForAccessibility="no" style={styles.bigPaw}><Icon name="dog" size={240} color={colors.onPrimary} strokeWidth={1.3} /></View>
    <View style={styles.heroInner}>
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={8} style={styles.back}>
        <Icon name="back" size={20} color={colors.onPrimary} /><Text style={styles.backText}>{t('configuration.back')}</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>{t('adminExport.title')}</Text>
      <Text style={styles.subtitle}>{t('adminExport.subtitle')}</Text>
      {resolvedRange ? <AssociationTotal total={rows.length} /> : null}
    </View>
  </View>;

  const controls = <View style={styles.controls}>
    <Text accessibilityRole="header" style={styles.sectionTitle}>{t('associationDashboard.filterTitle')}</Text>
    <View style={styles.tabs}>
      {['last7Days', 'last30Days', 'thisMonth'].map((preset) => <Pressable key={preset} accessibilityRole="button"
        accessibilityState={{ selected: activePreset === preset }} disabled={loadingPhase} onPress={() => applyPreset(preset)}
        style={[styles.tab, activePreset === preset && styles.tabActive, loadingPhase && styles.disabled]}>
        <Text style={[styles.tabText, activePreset === preset && styles.tabTextActive]}>{t(`associationDashboard.presets.${preset}`)}</Text>
      </Pressable>)}
    </View>
    <Pressable accessibilityRole="button" accessibilityState={{ selected: activePreset === 'custom' }} disabled={loadingPhase}
      onPress={() => { setActivePreset('custom'); setCalendarField('from'); }}
      style={[styles.customButton, activePreset === 'custom' && styles.customButtonActive, loadingPhase && styles.disabled]}>
      <Icon name="calendar" size={20} color={colors.primary} />
      <Text style={styles.customButtonText}>{t('associationDashboard.presets.custom')}</Text>
    </Pressable>
    {activePreset === 'custom' ? <View style={styles.customRange}>
      <View style={styles.dates}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${t('associationDashboard.from')}: ${displayDay(fromDay)}`}
          onPress={() => setCalendarField('from')} style={styles.dateField}>
          <Text style={styles.dateLabel}>{t('associationDashboard.from')}</Text><Text style={styles.dateValue}>{displayDay(fromDay)}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${t('associationDashboard.to')}: ${displayDay(toDay)}`}
          onPress={() => setCalendarField('to')} style={styles.dateField}>
          <Text style={styles.dateLabel}>{t('associationDashboard.to')}</Text><Text style={styles.dateValue}>{displayDay(toDay)}</Text>
        </Pressable>
      </View>
      <AppButton variant="signal" size="lg" title={t('associationDashboard.search')} disabled={loadingPhase} onPress={() => { setExportError(null); loadRange(fromDay, toDay); }} style={styles.search} />
      {dateErrors.from || dateErrors.to ? <Text style={styles.fieldError}>{t(dateErrors.to === 'before_from' ? 'associationDashboard.reversedDate' : 'associationDashboard.invalidDate')}</Text> : null}
    </View> : null}
    <Text style={styles.hint}>{t('associationDashboard.dateHint')}</Text>

    <AssociationDatePicker visible={Boolean(calendarField)} value={calendarField === 'to' ? toDay : fromDay}
      title={t(calendarField === 'to' ? 'associationDashboard.selectTo' : 'associationDashboard.selectFrom')}
      locale={i18n.language} previousMonthLabel={t('associationDashboard.previousMonth')} nextMonthLabel={t('associationDashboard.nextMonth')}
      cancelLabel={t('common.cancel')} onSelect={selectCustomDate} onClose={() => setCalendarField(null)} />

    <View style={styles.exportBar}>
      <View style={styles.exportText}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{t('adminExport.exportTitle')}</Text>
        {resolvedRange ? <>
          <Text style={styles.count}>{t('associationDashboard.count', { count: rows.length })}</Text>
          <Text style={styles.hint}>{t('associationDashboard.appliedPeriod', { from: displayDay(fromDay), to: displayDay(toDay) })}</Text>
        </> : null}
      </View>
      <View style={styles.exportActions}>
        {['csv', 'xlsx'].map((format) => <AppButton key={format} variant="secondary" disabled={!canExport}
          accessibilityHint={t('associationDashboard.exportHint')}
          title={exportingFormat === format ? t('associationDashboard.exporting') : t(`associationDashboard.export${format.toUpperCase()}`)}
          accessibilityLabel={t(`associationDashboard.export${format.toUpperCase()}`)}
          onPress={() => exportReports(format)} style={styles.exportButton} />)}
      </View>
    </View>
    {exportError ? <Text accessibilityRole="alert" style={styles.error}>{t('associationDashboard.exportError')}</Text> : null}

    {status ? <StateView kind={loadingPhase ? 'loading' : reports.phase === 'error' ? 'error' : 'empty'} title={status} style={styles.status}>
      {reports.phase === 'error' ? <AppButton variant="secondary" title={t('associationDashboard.retry')} onPress={reports.reload} /> : null}
    </StateView> : null}
  </View>;

  return <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
    <FlatList ref={listRef} testID="admin-export-list" style={styles.list} contentContainerStyle={styles.content}
      data={showReports ? pageRows : []} keyExtractor={(item) => item.id}
      ListHeaderComponent={<View>{header}{controls}</View>}
      ListFooterComponent={showReports ? <Pager page={currentPage} pageCount={pageCount} onChange={setPage}
        previousLabel={t('associationDashboard.pagePrev')} nextLabel={t('associationDashboard.pageNext')}
        pageLabel={t('associationDashboard.pageOf', { page: currentPage + 1, total: pageCount })} style={styles.pager} /> : null}
      renderItem={({ item }) => <AssociationReportCard report={item} />} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.primary },
  list: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingBottom: spacing.xxxl },
  hero: { backgroundColor: colors.primary, overflow: 'hidden' },
  bigPaw: { position: 'absolute', right: -48, top: 40, opacity: 0.1, transform: [{ rotate: '-18deg' }] },
  heroInner: { paddingHorizontal: layout.margin, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: layout.minTouch },
  backText: { ...type.button, fontSize: 15, color: colors.onPrimary },
  title: { fontFamily: fontFamily.display, fontSize: 30, lineHeight: 38, letterSpacing: -0.3, color: colors.onPrimary },
  subtitle: { fontFamily: fontFamily.label, fontSize: 14, lineHeight: 20, color: colors.onForest },
  controls: { paddingHorizontal: layout.margin, paddingTop: spacing.xxl, gap: spacing.md },
  sectionTitle: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 32, color: colors.primary },
  tabs: { flexDirection: 'row', gap: spacing.sm },
  tab: { flex: 1, minHeight: layout.minTouch + 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs, borderBottomWidth: 3, borderBottomColor: colors.border },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontFamily: fontFamily.label, fontSize: 14, lineHeight: 18, textAlign: 'center', color: colors.inkMuted }, tabTextActive: { color: colors.primary },
  customButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: layout.minTouch, borderRadius: 12, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surface },
  customButtonActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  customButtonText: { fontFamily: fontFamily.label, fontSize: 15, color: colors.primary },
  customRange: { gap: spacing.md },
  dates: { flexDirection: 'row', gap: spacing.md },
  dateField: { flex: 1, minHeight: 56, borderWidth: 1, borderColor: colors.outline, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface, justifyContent: 'center' },
  dateLabel: { fontFamily: fontFamily.label, fontSize: 12, color: colors.inkMuted }, dateValue: { fontFamily: fontFamily.labelMedium, fontVariant: ['tabular-nums'], fontSize: 15, color: colors.ink },
  search: { borderRadius: 12 },
  fieldError: { ...type.caption, fontSize: 13, color: colors.danger },
  hint: { ...type.caption, color: colors.inkMuted },
  exportBar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.md, marginTop: spacing.xl },
  exportText: { gap: 2, flexShrink: 1 },
  count: { fontFamily: fontFamily.label, fontVariant: ['tabular-nums'], fontSize: 15, color: colors.ink },
  exportActions: { flexDirection: 'row', gap: spacing.sm },
  exportButton: { minWidth: 72, borderRadius: 12 }, disabled: { opacity: 0.45 },
  status: { alignItems: 'center', paddingVertical: spacing.xxl },
  error: { ...type.caption, fontSize: 14, color: colors.danger },
  pager: { paddingVertical: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
