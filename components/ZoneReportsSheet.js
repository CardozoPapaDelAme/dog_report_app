import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { loadZoneReports } from '../hooks/zoneReports.js';

const colors = { ink: '#191d17', primary: '#00450d', muted: '#5d6859', line: '#e0e0e0', warningSoft: '#fff0c2', warning: '#8a5700' };

// Bottom sheet listing the public reports of a tapped cluster area (approximate, locally filtered).
export default function ZoneReportsSheet({ cluster, zoom, onSelect, onClose, t, load = loadZoneReports }) {
  const [state, setState] = useState({ phase: 'loading', reports: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ phase: 'loading', reports: [] });
    load({ cluster, zoom }).then((result) => { if (active) setState(result); });
    return () => { active = false; };
  }, [cluster, zoom, attempt, load]);

  const retry = () => setAttempt((value) => value + 1);
  return (
    <View style={styles.sheet} testID="zone-sheet">
      <View style={styles.grabber} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>{t('zone.title')}</Text>
        {state.phase === 'loading' ? <ActivityIndicator accessibilityLabel={t('zone.loading')} color={colors.primary} /> : null}
        {state.phase === 'empty' ? <Text style={styles.message}>{t('zone.empty')}</Text> : null}
        {state.phase === 'offline' || state.phase === 'error' ? (
          <View accessibilityRole="alert" style={styles.errorBox}>
            <Text style={styles.message}>{t(state.phase === 'offline' ? 'zone.offline' : 'zone.error')}</Text>
            <Pressable accessibilityRole="button" onPress={retry} style={styles.retryButton}>
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
        {state.phase === 'ready' ? <Text style={styles.note}>{t('zone.approximate')}</Text> : null}
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>{t('map.close')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 16, elevation: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginTop: 10 },
  content: { padding: 20, gap: 8 },
  title: { color: colors.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20 },
  message: { color: colors.ink, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14 },
  errorBox: { gap: 8 },
  retryButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary, paddingHorizontal: 16 },
  retryText: { color: '#ffffff', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
  row: { minHeight: 56, borderBottomColor: colors.line, borderBottomWidth: 1, paddingVertical: 10, gap: 2 },
  rowTitle: { color: colors.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15 },
  rowMeta: { color: colors.muted, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13 },
  flagText: { color: colors.warning, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12 },
  note: { color: colors.muted, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12 },
  closeButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderColor: colors.line, borderWidth: 1, marginTop: 6 },
  closeText: { color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
});
