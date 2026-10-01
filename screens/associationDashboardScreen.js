import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ASSOCIATION_REPORT_COLUMNS, associationReportValues, createAssociationCsv } from '../models/associationReport.js';
import { useAssociationReports } from '../hooks/useAssociationReports.js';
import { saveAssociationCsv } from '../services/associationExport';

const WIDTHS = [210, 190, 190, 175, 130, 290, 150, 100, 105, 120, 120, 105];
const TABLE_WIDTH = WIDTHS.reduce((sum, width) => sum + width, 0);
const dateText = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function Cell({ value, width, header = false }) {
  return <Text numberOfLines={header ? 2 : 3} selectable={!header} style={[styles.cell, { width }, header && styles.headerCell]}>{value == null ? '—' : String(value)}</Text>;
}

export default function AssociationDashboardScreen({ accessToken, displayName, onLogout, pending, getPage, saveCsv = saveAssociationCsv }) {
  const { t } = useTranslation();
  const [fromDay, setFromDay] = useState(() => { const day = new Date(); day.setDate(day.getDate() - 29); return dateText(day); });
  const [toDay, setToDay] = useState(() => dateText(new Date()));
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const reports = useAssociationReports(accessToken, getPage);
  const { loadRange } = reports;
  useEffect(() => { loadRange(fromDay, toDay); }, [loadRange]);

  const rows = reports.rows;
  const applied = reports.dates?.fromDay === fromDay && reports.dates?.toDay === toDay;
  const canExport = reports.phase === 'ready' && applied && !exporting && !pending;

  async function exportCsv() {
    if (!canExport) return;
    setExporting(true);
    setExportError(null);
    try {
      await saveCsv({
        filename: `reportes-asociacion_${reports.dates.fromDay}_${reports.dates.toDay}.csv`,
        content: createAssociationCsv(rows),
      });
    } catch (error) { setExportError(error); }
    finally { setExporting(false); }
  }

  const status = reports.phase === 'loading' ? t('associationDashboard.loading')
    : reports.phase === 'empty' ? t('associationDashboard.empty')
    : reports.phase === 'invalid' ? t('associationDashboard.invalid')
    : reports.phase === 'session' ? t('associationDashboard.session')
    : reports.phase === 'forbidden' ? t('associationDashboard.forbidden')
    : reports.phase === 'error' ? t('associationDashboard.error')
    : reports.phase === 'idle' ? t('associationDashboard.idle') : null;

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.page}>
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

      <View style={styles.filters}>
        <View style={styles.field}>
          <Text style={styles.label}>{t('associationDashboard.from')}</Text>
          <TextInput accessibilityLabel={t('associationDashboard.from')} value={fromDay} onChangeText={setFromDay}
            placeholder="AAAA-MM-DD" autoCapitalize="none" style={styles.input} />
          {reports.errors.from ? <Text style={styles.fieldError}>{t('associationDashboard.invalidDate')}</Text> : null}
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t('associationDashboard.to')}</Text>
          <TextInput accessibilityLabel={t('associationDashboard.to')} value={toDay} onChangeText={setToDay}
            placeholder="AAAA-MM-DD" autoCapitalize="none" style={styles.input} />
          {reports.errors.to ? <Text style={styles.fieldError}>{t(reports.errors.to === 'before_from' ? 'associationDashboard.reversedDate' : 'associationDashboard.invalidDate')}</Text> : null}
        </View>
        <Pressable accessibilityRole="button" disabled={reports.phase === 'loading'} onPress={() => { setExportError(null); loadRange(fromDay, toDay); }}
          style={[styles.primaryButton, reports.phase === 'loading' && styles.disabled]}>
          <Text style={styles.primaryText}>{t('associationDashboard.search')}</Text>
        </Pressable>
      </View>
      <Text style={styles.filterHint}>{t('associationDashboard.dateHint')}</Text>

      <View style={styles.resultsBar}>
        <View>
          <Text style={styles.resultsTitle}>{t('associationDashboard.results')}</Text>
          {reports.phase === 'ready' ? <Text style={styles.count}>{t('associationDashboard.count', { count: rows.length })}</Text> : null}
        </View>
        <Pressable accessibilityRole="button" disabled={!canExport} onPress={exportCsv}
          style={[styles.exportButton, !canExport && styles.disabled]}>
          <Text style={styles.exportText}>{exporting ? t('associationDashboard.exporting') : t('associationDashboard.export')}</Text>
        </Pressable>
      </View>
      {exportError ? <Text accessibilityRole="alert" style={styles.error}>{t('associationDashboard.exportError')}</Text> : null}

      {status ? <View style={styles.status}>
        {reports.phase === 'loading' ? <ActivityIndicator color="#005a25" /> : null}
        <Text style={styles.statusText}>{status}</Text>
        {reports.phase === 'error' ? <Pressable accessibilityRole="button" onPress={reports.reload} style={styles.retry}>
          <Text style={styles.retryText}>{t('associationDashboard.retry')}</Text>
        </Pressable> : null}
      </View> : null}

      {reports.phase === 'ready' ? <ScrollView horizontal style={styles.tableScroll} contentContainerStyle={styles.tableScrollContent}>
        <View style={[styles.table, { width: TABLE_WIDTH }]}>
          <View style={styles.headerRow}>{ASSOCIATION_REPORT_COLUMNS.map((key, index) =>
            <Cell key={key} header value={t(`associationDashboard.columns.${key}`)} width={WIDTHS[index]} />)}</View>
          <FlatList data={rows} keyExtractor={(item) => item.id} style={styles.list}
            renderItem={({ item, index }) => <View style={[styles.row, index % 2 && styles.alternateRow]}>
              {associationReportValues(item).map((value, cellIndex) =>
                <Cell key={ASSOCIATION_REPORT_COLUMNS[cellIndex]} value={
                  typeof value === 'boolean' ? t(value ? 'common.yes' : 'common.no') : value
                } width={WIDTHS[cellIndex]} />)}
            </View>} />
        </View>
      </ScrollView> : null}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7fbf1' },
  page: { flex: 1, width: '100%', maxWidth: 1440, alignSelf: 'center', padding: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  heading: { flexShrink: 1 }, eyebrow: { color: '#005a25', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#172117', fontSize: 27, fontWeight: '700', marginTop: 6 },
  name: { color: '#5d6859', marginTop: 4 },
  logout: { padding: 10, borderWidth: 1, borderColor: '#b9c9b9', borderRadius: 8 },
  logoutText: { color: '#005a25', fontWeight: '600' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12, marginTop: 24 },
  field: { width: 180 }, label: { color: '#334433', fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#aebead', borderRadius: 8, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, color: '#172117' },
  fieldError: { color: '#ad2d20', fontSize: 12, marginTop: 4 },
  primaryButton: { backgroundColor: '#005a25', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 12 },
  primaryText: { color: '#fff', fontWeight: '700' },
  filterHint: { color: '#61705e', fontSize: 12, marginTop: 8 },
  resultsBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 26, marginBottom: 12 },
  resultsTitle: { color: '#172117', fontSize: 19, fontWeight: '700' }, count: { color: '#61705e', marginTop: 3 },
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
