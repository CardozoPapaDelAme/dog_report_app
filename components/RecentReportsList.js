import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { loadRecentReports } from '../hooks/zoneReports.js';

const colors = { ink: '#191d17', primary: '#00450d', muted: '#5d6859', line: '#e0e0e0', warning: '#8a5700' };

// Expo Go fallback: recent public reports as a plain list (no native map). Selecting a row hands the report to the caller.
export default function RecentReportsList({ onSelect, t, load = loadRecentReports }) {
  const [state, setState] = useState({ phase: 'loading', reports: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ phase: 'loading', reports: [] });
    load({ limit: 100 }).then((result) => { if (active) setState(result); });
    return () => { active = false; };
  }, [attempt, load]);

  return (
    <View style={styles.list} testID="recent-reports">
      <Text accessibilityRole="header" style={styles.title}>{t('map.expoGo.title')}</Text>
      {state.phase === 'loading' ? <ActivityIndicator accessibilityLabel={t('map.loading')} color={colors.primary} /> : null}
      {state.phase === 'empty' ? <Text style={styles.message}>{t('map.expoGo.empty')}</Text> : null}
      {state.phase === 'offline' || state.phase === 'error' ? (
        <View accessibilityRole="alert" style={styles.errorBox}>
          <Text style={styles.message}>{t(state.phase === 'offline' ? 'map.expoGo.offline' : 'map.expoGo.error')}</Text>
          <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('map.retry')}</Text>
          </Pressable>
        </View>
      ) : null}
      {state.reports.map((report) => (
        <Pressable key={report.report_id} accessibilityRole="button" onPress={() => onSelect(report)} style={styles.row}>
          <Text style={styles.rowTitle}>{t(`reportForm.incidents.${report.incident_type}`)}</Text>
          <Text style={styles.rowMeta}>
            {`${t(`reportForm.sighting.${report.sighting_type}`)} · ${new Date(report.occurred_at).toLocaleDateString('es-MX')}`}
          </Text>
          {report.has_flags ? <Text style={styles.flagText}>{`⚑ ${t('map.pin.flagged')}`}</Text> : null}
        </Pressable>
      ))}
      {state.phase === 'ready' ? <Text style={styles.note}>{t('map.expoGo.approximate')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  title: { color: colors.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18 },
  message: { color: colors.ink, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14 },
  errorBox: { gap: 8 },
  retryButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary, paddingHorizontal: 16 },
  retryText: { color: '#ffffff', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
  row: { minHeight: 56, borderBottomColor: colors.line, borderBottomWidth: 1, paddingVertical: 10, gap: 2 },
  rowTitle: { color: colors.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15 },
  rowMeta: { color: colors.muted, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13 },
  flagText: { color: colors.warning, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12 },
  note: { color: colors.muted, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12 },
});
