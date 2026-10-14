/**
 * @module screens/associationDashboardScreen
 * Container screen for users with the `association` role: date range presets and custom dates,
 * accepted report summary, report cards (narrow) or table (wide, at least 900 px), and CSV/XLSX export.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ASSOCIATION_REPORT_COLUMNS, createAssociationCsv, getAssociationQuickRange } from '../models/associationReport.js';
import { useAssociationReports } from '../hooks/useAssociationReports.js';
import { saveAssociationCsv, saveAssociationXlsx } from '../services/associationExport';
import { createAssociationXlsx } from '../models/associationWorkbook.js';
import AssociationDatePicker from '../components/associationDatePicker.js';
import AssociationSummaryCard from '../components/associationSummaryCard.js';
import AssociationReportCard from '../components/associationReportCard.js';
import { buildAssociationSummary } from '../models/associationSummary.js';
import { associationDisplayValues, presentAssociationReport } from '../presenters/associationDisplay.js';
import { AppButton, Icon, Pager, StateView } from '../components/ui/index.js';
import { colors, fontFamily, layout, radius, spacing, type } from '../theme/index.js';

/** Reports shown per page in the mobile list. */
const PAGE_SIZE = 10;
/** Table column widths in pixels, in `ASSOCIATION_REPORT_COLUMNS` order. */
const WIDTHS = [210, 190, 190, 175, 130, 290, 150, 100, 105, 120, 120, 105];
const TABLE_WIDTH = WIDTHS.reduce((sum, width) => sum + width, 0);
function Cell({ value, width, header = false }) {
  return <Text numberOfLines={header ? 2 : 3} selectable={!header} style={[styles.cell, { width }, header && styles.headerCell]}>{value == null ? '—' : String(value)}</Text>;
}

/**
 * Loads the last 30 days on mount through `useAssociationReports`.
 * @param {object} props
 * @param {string} props.accessToken - Session access token.
 * @param {string} props.displayName - Shown in the header.
 * @param {() => void} props.onLogout
 * @param {boolean} props.pending - Logout in progress; disables export.
 * @param {Function} [props.getPage] - Page request override for `useAssociationReports`.
 * @param {(file: {filename: string, content: string}) => Promise<void>} [props.saveCsv=saveAssociationCsv]
 * @param {(file: {filename: string, content: Uint8Array}) => Promise<void>} [props.saveXlsx=saveAssociationXlsx]
 * @returns {JSX.Element}
 */
export default function AssociationDashboardScreen({ accessToken, displayName, onLogout, pending, getPage, saveCsv = saveAssociationCsv, saveXlsx = saveAssociationXlsx }) {
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const initialRange = getAssociationQuickRange('last30Days');
  const [fromDay, setFromDay] = useState(initialRange.fromDay);
  const [toDay, setToDay] = useState(initialRange.toDay);
  const [activePreset, setActivePreset] = useState('last30Days');
  const [calendarField, setCalendarField] = useState(null);
  const [exportingFormat, setExportingFormat] = useState(null);
  const [exportError, setExportError] = useState(null);
  const reports = useAssociationReports(accessToken, getPage);
  const [page, setPage] = useState(0);
  const listRef = useRef(null);
  const heroHeight = useRef(0);
  const resultsY = useRef(0);
  const { loadRange } = reports;
  useEffect(() => { loadRange(fromDay, toDay); }, [loadRange]);

  const rows = reports.rows;
  const applied = reports.dates?.fromDay === fromDay && reports.dates?.toDay === toDay;
  const resolvedRange = applied && (reports.phase === 'ready' || reports.phase === 'empty');
  const dateErrors = applied ? reports.errors : {};
  const canExport = reports.phase === 'ready' && applied && !exportingFormat && !pending;
  const summary = useMemo(() => resolvedRange
    ? buildAssociationSummary(rows, fromDay, toDay) : null, [resolvedRange, rows, fromDay, toDay]);

  function applyPreset(preset) {
    const range = getAssociationQuickRange(preset);
    setFromDay(range.fromDay);
    setToDay(range.toDay);
    setActivePreset(preset);
    setExportError(null);
    loadRange(range.fromDay, range.toDay);
  }

  function selectCustomDate(day) {
    if (calendarField === 'from') setFromDay(day);
    else if (calendarField === 'to') setToDay(day);
    setActivePreset('custom');
    setExportError(null);
    setCalendarField(null);
  }

  function displayDay(day) {
    return new Date(`${day}T12:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async function exportReports(format) {
    if (!canExport) return;
    setExportingFormat(format);
    setExportError(null);
    try {
      const filename = `reportes-asociacion_${reports.dates.fromDay}_${reports.dates.toDay}.${format}`;
      if (format === 'xlsx') await saveXlsx({ filename, content: createAssociationXlsx(rows) });
      else await saveCsv({ filename, content: createAssociationCsv(rows) });
    } catch (error) { setExportError(error); }
    finally { setExportingFormat(null); }
  }

  const status = reports.phase === 'loading' ? t('associationDashboard.loading')
    : (reports.phase === 'ready' || reports.phase === 'empty') && !applied ? t('associationDashboard.applyFilters')
    : reports.phase === 'empty' ? t('associationDashboard.empty')
    : reports.phase === 'invalid' ? t('associationDashboard.invalid')
    : reports.phase === 'session' ? t('associationDashboard.session')
    : reports.phase === 'forbidden' ? t('associationDashboard.forbidden')
    : reports.phase === 'error' ? t('associationDashboard.error')
    : reports.phase === 'idle' ? t('associationDashboard.idle') : null;

  const showReports = reports.phase === 'ready' && applied;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  useEffect(() => { setPage(0); }, [rows]);
  function changePage(next) {
    setPage(next);
    listRef.current?.scrollToOffset({ offset: Math.max(0, heroHeight.current + resultsY.current - 8), animated: true });
  }
  const pager = <Pager page={currentPage} pageCount={pageCount} onChange={changePage} previousLabel={t('associationDashboard.pagePrev')} nextLabel={t('associationDashboard.pageNext')}
    pageLabel={t('associationDashboard.pageOf', { page: currentPage + 1, total: pageCount })} style={styles.pager} />;
  const loadingPhase = reports.phase === 'loading';
  const hero = <View style={styles.hero} onLayout={(event) => { heroHeight.current = event.nativeEvent.layout.height; }}>
    <View pointerEvents="none" accessible={false} aria-hidden importantForAccessibility="no" style={styles.bigPaw}><Icon name="dog" size={210} color={colors.onPrimary} strokeWidth={1.4} /></View>
    <View style={styles.heroInner}>
      <View style={styles.titleRow}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>{t('associationDashboard.title')}</Text>
          {displayName ? <Text style={styles.name}>{displayName}</Text> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('login.logout')} disabled={pending} onPress={onLogout} hitSlop={6} style={({ pressed }) => [styles.logout, pressed && styles.pressed, pending && styles.disabled]}>
          <Icon name="logout" size={22} color={colors.onPrimary} />
        </Pressable>
      </View>
      {summary ? <AssociationSummaryCard key={`${fromDay}:${toDay}`} summary={summary} wide={wide} /> : null}
    </View>
  </View>;

  const controls = <>
      <View style={styles.filter}>
        <Text accessibilityRole="header" style={styles.filterTitle}>{t('associationDashboard.filterTitle')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {['last7Days', 'last30Days', 'thisMonth'].map((preset) => <Pressable key={preset} accessibilityRole="button"
            accessibilityState={{ selected: activePreset === preset }} disabled={loadingPhase} onPress={() => applyPreset(preset)}
            style={[styles.tab, activePreset === preset && styles.tabActive, loadingPhase && styles.disabled]}>
            <Text style={[styles.tabText, activePreset === preset && styles.tabTextActive]}>{t(`associationDashboard.presets.${preset}`)}</Text>
          </Pressable>)}
          <Pressable accessibilityRole="button" accessibilityState={{ selected: activePreset === 'custom' }} disabled={loadingPhase}
            onPress={() => { setActivePreset('custom'); setCalendarField('from'); }}
            style={[styles.tab, activePreset === 'custom' && styles.tabActive, loadingPhase && styles.disabled]}>
            <Text style={[styles.tabText, activePreset === 'custom' && styles.tabTextActive]}>{t('associationDashboard.presets.custom')}</Text>
          </Pressable>
        </ScrollView>
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
          {dateErrors.from || dateErrors.to ? <Text style={styles.fieldError}>{t((dateErrors.to === 'before_from') ? 'associationDashboard.reversedDate' : 'associationDashboard.invalidDate')}</Text> : null}
        </View> : null}
        <Text style={styles.filterHint}>{t('associationDashboard.dateHint')}</Text>
      </View>

      <AssociationDatePicker visible={Boolean(calendarField)} value={calendarField === 'to' ? toDay : fromDay}
        title={t(calendarField === 'to' ? 'associationDashboard.selectTo' : 'associationDashboard.selectFrom')}
        locale={i18n.language} previousMonthLabel={t('associationDashboard.previousMonth')} nextMonthLabel={t('associationDashboard.nextMonth')}
        cancelLabel={t('common.cancel')} onSelect={selectCustomDate} onClose={() => setCalendarField(null)} />

      <View style={styles.resultsBar} onLayout={(event) => { resultsY.current = event.nativeEvent.layout.y; }}>
        <View style={styles.resultsText}>
          <Text accessibilityRole="header" style={styles.resultsTitle}>{t('associationDashboard.results')}</Text>
          {resolvedRange ? <>
            <Text style={styles.count}>{t('associationDashboard.count', { count: rows.length })}</Text>
            <Text style={styles.appliedPeriod}>{t('associationDashboard.appliedPeriod', { from: displayDay(fromDay), to: displayDay(toDay) })}</Text>
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
    </>;

  const table = showReports ? <ScrollView testID="association-report-table" horizontal style={styles.tableScroll} contentContainerStyle={styles.tableScrollContent}>
    <View style={[styles.table, { width: TABLE_WIDTH }]}>
      <View style={styles.headerRow}>{ASSOCIATION_REPORT_COLUMNS.map((key, index) =>
        <Cell key={key} header value={t(`associationDashboard.columns.${key}`)} width={WIDTHS[index]} />)}</View>
      <FlatList data={rows} keyExtractor={(item) => item.id} style={styles.list}
        renderItem={({ item, index }) => <View style={[styles.row, index % 2 && styles.alternateRow]}>
          {associationDisplayValues(presentAssociationReport(item, t, i18n.language)).map((value, cellIndex) =>
            <Cell key={ASSOCIATION_REPORT_COLUMNS[cellIndex]} value={value} width={WIDTHS[cellIndex]} />)}
        </View>} />
    </View>
  </ScrollView> : null;

  return <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
    {wide ? <View style={styles.wideRoot}>{hero}<View style={styles.page}>{controls}{table}</View></View>
      : <FlatList ref={listRef} style={styles.mobileList} contentContainerStyle={styles.mobileContent}
        data={showReports ? pageRows : []} keyExtractor={(item) => item.id}
        ListFooterComponent={showReports ? pager : null}
        ListHeaderComponent={<View>{hero}<View style={styles.controls}>{controls}</View></View>}
        renderItem={({ item }) => <AssociationReportCard report={item} />} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.primary },
  wideRoot: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, width: '100%', maxWidth: 1440, alignSelf: 'center', padding: layout.margin },
  mobileList: { flex: 1, backgroundColor: colors.background },
  mobileContent: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingBottom: spacing.xxxl },
  controls: { paddingHorizontal: layout.margin, paddingTop: spacing.xxl },
  hero: { backgroundColor: colors.primary, overflow: 'hidden' },
  bigPaw: { position: 'absolute', right: -48, top: 96, opacity: 0.1, transform: [{ rotate: '-18deg' }] },
  heroInner: { width: '100%', maxWidth: 1440, alignSelf: 'center', paddingHorizontal: layout.margin, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  heading: { flex: 1, gap: spacing.xs },
  title: { fontFamily: fontFamily.display, fontSize: 32, lineHeight: 40, letterSpacing: -0.3, color: colors.onPrimary },
  name: { fontFamily: fontFamily.label, fontSize: 14, color: colors.onForest },
  logout: { width: layout.minTouch, height: layout.minTouch, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(201,230,196,0.45)' },
  pressed: { opacity: 0.7 },
  filter: { gap: spacing.md },
  filterTitle: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 32, color: colors.primary },
  tabs: { gap: spacing.xs, paddingRight: spacing.lg },
  tab: { minHeight: layout.minTouch, justifyContent: 'center', paddingHorizontal: spacing.md, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontFamily: fontFamily.label, fontSize: 15, color: colors.inkMuted }, tabTextActive: { color: colors.primary },
  customRange: { gap: spacing.md },
  dates: { flexDirection: 'row', gap: spacing.md },
  dateField: { flex: 1, minHeight: 56, borderWidth: 1, borderColor: colors.outline, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface, justifyContent: 'center' },
  dateLabel: { fontFamily: fontFamily.label, fontSize: 12, color: colors.inkMuted }, dateValue: { fontFamily: fontFamily.labelMedium, fontVariant: ['tabular-nums'], fontSize: 15, color: colors.ink },
  search: { borderRadius: 12 },
  pager: { paddingVertical: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  fieldError: { ...type.caption, fontSize: 13, color: colors.danger },
  filterHint: { ...type.caption, color: colors.inkMuted },
  resultsBar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.md, marginTop: spacing.xxl, marginBottom: spacing.md },
  resultsText: { gap: 2, flexShrink: 1 },
  resultsTitle: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 32, color: colors.primary },
  count: { fontFamily: fontFamily.label, fontVariant: ['tabular-nums'], fontSize: 15, color: colors.ink },
  appliedPeriod: { ...type.caption, color: colors.inkMuted },
  exportActions: { flexDirection: 'row', gap: spacing.sm },
  exportButton: { minWidth: 72, borderRadius: 12 }, disabled: { opacity: 0.45 },
  status: { alignItems: 'center', paddingVertical: spacing.xxl },
  error: { ...type.caption, fontSize: 14, color: colors.danger, marginBottom: spacing.md },
  tableScroll: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  tableScrollContent: { flexGrow: 1 }, table: { flex: 1 }, list: { flex: 1 },
  headerRow: { flexDirection: 'row', backgroundColor: colors.primarySoft, borderBottomWidth: 1, borderBottomColor: colors.outlineSoft },
  headerCell: { fontFamily: fontFamily.label, color: colors.primary },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: 50 },
  alternateRow: { backgroundColor: colors.background },
  cell: { paddingHorizontal: 10, paddingVertical: 12, color: colors.ink, fontFamily: fontFamily.regular, fontSize: 13 },
});
