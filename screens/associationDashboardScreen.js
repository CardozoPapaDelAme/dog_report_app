import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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

const WIDTHS = [210, 190, 190, 175, 130, 290, 150, 100, 105, 120, 120, 105];
const TABLE_WIDTH = WIDTHS.reduce((sum, width) => sum + width, 0);
function Cell({ value, width, header = false }) {
  return <Text numberOfLines={header ? 2 : 3} selectable={!header} style={[styles.cell, { width }, header && styles.headerCell]}>{value == null ? '—' : String(value)}</Text>;
}

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
  const dashboardContent = <>
      <View style={styles.topBar}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>{t('associationDashboard.eyebrow')}</Text>
          <Text style={styles.title}>{t('associationDashboard.title')}</Text>
          {displayName ? <Text style={styles.name}>{displayName}</Text> : null}
        </View>
        <Pressable accessibilityRole="button" disabled={pending} onPress={onLogout} style={styles.logout}>
          <Text style={styles.logoutText}>{t('login.logout')}</Text>
        </Pressable>
      </View>

      <View style={styles.filterCard}>
        <Text style={styles.filterTitle}>{t('associationDashboard.filterTitle')}</Text>
        <View style={styles.presets}>
          {['last7Days', 'last30Days', 'thisMonth'].map((preset) => <Pressable key={preset} accessibilityRole="button"
            accessibilityState={{ selected: activePreset === preset }} disabled={reports.phase === 'loading'} onPress={() => applyPreset(preset)}
            style={[styles.presetButton, activePreset === preset && styles.presetActive, reports.phase === 'loading' && styles.disabled]}>
            <Text style={[styles.presetText, activePreset === preset && styles.presetActiveText]}>{t(`associationDashboard.presets.${preset}`)}</Text>
          </Pressable>)}
          <Pressable accessibilityRole="button" accessibilityState={{ selected: activePreset === 'custom' }} disabled={reports.phase === 'loading'}
            onPress={() => { setActivePreset('custom'); setCalendarField('from'); }}
            style={[styles.presetButton, activePreset === 'custom' && styles.presetActive, reports.phase === 'loading' && styles.disabled]}>
            <Text style={[styles.presetText, activePreset === 'custom' && styles.presetActiveText]}>{t('associationDashboard.presets.custom')}</Text>
          </Pressable>
        </View>
        {activePreset === 'custom' ? <View style={styles.customRange}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t('associationDashboard.from')}: ${displayDay(fromDay)}`}
            onPress={() => setCalendarField('from')} style={styles.dateField}>
            <Text style={styles.dateLabel}>{t('associationDashboard.from')}</Text><Text style={styles.dateValue}>{displayDay(fromDay)}</Text>
          </Pressable>
          <Text style={styles.rangeSeparator}>—</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t('associationDashboard.to')}: ${displayDay(toDay)}`}
            onPress={() => setCalendarField('to')} style={styles.dateField}>
            <Text style={styles.dateLabel}>{t('associationDashboard.to')}</Text><Text style={styles.dateValue}>{displayDay(toDay)}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={reports.phase === 'loading'} onPress={() => { setExportError(null); loadRange(fromDay, toDay); }}
            style={[styles.primaryButton, reports.phase === 'loading' && styles.disabled]}>
            <Text style={styles.primaryText}>{t('associationDashboard.search')}</Text>
          </Pressable>
          {dateErrors.from || dateErrors.to ? <Text style={styles.fieldError}>{t((dateErrors.to === 'before_from') ? 'associationDashboard.reversedDate' : 'associationDashboard.invalidDate')}</Text> : null}
        </View> : null}
        <Text style={styles.filterHint}>{t('associationDashboard.dateHint')}</Text>
      </View>

      <AssociationDatePicker visible={Boolean(calendarField)} value={calendarField === 'to' ? toDay : fromDay}
        title={t(calendarField === 'to' ? 'associationDashboard.selectTo' : 'associationDashboard.selectFrom')}
        locale={i18n.language} previousMonthLabel={t('associationDashboard.previousMonth')} nextMonthLabel={t('associationDashboard.nextMonth')}
        cancelLabel={t('common.cancel')} onSelect={selectCustomDate} onClose={() => setCalendarField(null)} />

      {summary ? <AssociationSummaryCard key={`${fromDay}:${toDay}`} summary={summary} /> : null}

      <View style={styles.resultsBar}>
        <View>
          <Text style={styles.resultsTitle}>{t('associationDashboard.results')}</Text>
          {resolvedRange ? <>
            <Text style={styles.count}>{t('associationDashboard.count', { count: rows.length })}</Text>
            <Text style={styles.appliedPeriod}>{t('associationDashboard.appliedPeriod', { from: displayDay(fromDay), to: displayDay(toDay) })}</Text>
          </> : null}
        </View>
        <View style={styles.exportActions}>
          {['csv', 'xlsx'].map((format) => <Pressable key={format} accessibilityRole="button" disabled={!canExport}
            accessibilityHint={t('associationDashboard.exportHint')}
            onPress={() => exportReports(format)} style={[styles.exportButton, !canExport && styles.disabled]}>
            <Text style={styles.exportText}>{exportingFormat === format ? t('associationDashboard.exporting') : t(`associationDashboard.export${format.toUpperCase()}`)}</Text>
          </Pressable>)}
        </View>
      </View>
      {exportError ? <Text accessibilityRole="alert" style={styles.error}>{t('associationDashboard.exportError')}</Text> : null}

      {status ? <View accessibilityLiveRegion="polite" style={styles.status}>
        {reports.phase === 'loading' ? <ActivityIndicator accessibilityLabel={t('common.loading')} color="#005a25" /> : null}
        <Text style={styles.statusText}>{status}</Text>
        {reports.phase === 'error' ? <Pressable accessibilityRole="button" onPress={reports.reload} style={styles.retry}>
          <Text style={styles.retryText}>{t('associationDashboard.retry')}</Text>
        </Pressable> : null}
      </View> : null}
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

  return <SafeAreaView style={styles.safeArea}>
    {wide ? <View style={styles.page}>{dashboardContent}{table}</View>
      : <FlatList style={styles.mobileList} contentContainerStyle={styles.mobileContent}
        data={showReports ? rows : []} keyExtractor={(item) => item.id}
        ListHeaderComponent={<View>{dashboardContent}</View>}
        renderItem={({ item }) => <AssociationReportCard report={item} />} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7fbf1' },
  page: { flex: 1, width: '100%', maxWidth: 1440, alignSelf: 'center', padding: 20 },
  mobileList: { flex: 1 },
  mobileContent: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 36 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  heading: { flexShrink: 1 }, eyebrow: { color: '#005a25', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#172117', fontSize: 27, fontWeight: '700', marginTop: 6 },
  name: { color: '#5d6859', marginTop: 4 },
  logout: { padding: 10, borderWidth: 1, borderColor: '#b9c9b9', borderRadius: 8 },
  logoutText: { color: '#005a25', fontWeight: '600' },
  filterCard: { marginTop: 24, padding: 16, gap: 12, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2eae0' },
  filterTitle: { color: '#172117', fontSize: 16, fontWeight: '700' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetButton: { borderWidth: 1, borderColor: '#b9c9b9', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#fff' },
  presetActive: { backgroundColor: '#005a25', borderColor: '#005a25' },
  presetText: { color: '#334433', fontSize: 13, fontWeight: '600' }, presetActiveText: { color: '#fff' },
  customRange: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 },
  dateField: { minWidth: 132, borderWidth: 1, borderColor: '#aebead', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#fff' },
  dateLabel: { color: '#61705e', fontSize: 11, marginBottom: 3 }, dateValue: { color: '#172117', fontWeight: '600' },
  rangeSeparator: { color: '#61705e', paddingBottom: 12 },
  fieldError: { color: '#ad2d20', fontSize: 12, marginTop: 4 },
  primaryButton: { backgroundColor: '#005a25', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 12 },
  primaryText: { color: '#fff', fontWeight: '700' },
  filterHint: { color: '#61705e', fontSize: 12 },
  resultsBar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 26, marginBottom: 12 },
  resultsTitle: { color: '#172117', fontSize: 19, fontWeight: '700' }, count: { color: '#61705e', marginTop: 3 },
  appliedPeriod: { color: '#61705e', fontSize: 12, marginTop: 3 },
  exportActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exportButton: { borderWidth: 1, borderColor: '#005a25', borderRadius: 8, paddingHorizontal: 15, paddingVertical: 11 },
  exportText: { color: '#005a25', fontWeight: '700' }, disabled: { opacity: 0.45 },
  status: { flex: 1, minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20, backgroundColor: '#fff', borderRadius: 10 },
  statusText: { color: '#334433', textAlign: 'center', fontSize: 16 },
  retry: { padding: 10 }, retryText: { color: '#005a25', fontWeight: '700' },
  error: { color: '#ad2d20', marginBottom: 10 },
  tableScroll: { flex: 1, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2eae0' },
  tableScrollContent: { flexGrow: 1 }, table: { flex: 1 }, list: { flex: 1 },
  headerRow: { flexDirection: 'row', backgroundColor: '#eaf3e9', borderBottomWidth: 1, borderBottomColor: '#c6d6c3' },
  headerCell: { fontWeight: '700', color: '#234023' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#edf1ec', minHeight: 50 },
  alternateRow: { backgroundColor: '#f8fbf7' },
  cell: { paddingHorizontal: 10, paddingVertical: 12, color: '#172117', fontSize: 13 },
});
