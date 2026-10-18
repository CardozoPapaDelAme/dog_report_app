/**
 * @module components/RecentReportsList
 * List of recent public reports used when the native map is unavailable (Expo Go), with loading,
 * empty, offline and error states and a retry action.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { loadRecentReports } from '../hooks/zoneReports.js';
import { severityLevel } from '../models/publicMap.js';
import { colors, fontFamily, spacing, type } from '../theme/index.js';
import { AppButton, Icon } from './ui/index.js';

// Expo Go fallback: recent public reports as a plain list (no native map). Selecting a row hands the report to the caller.
/**
 * @param {object} props
 * @param {(report: import('../models/publicMap.js').PublicReport) => void} props.onSelect
 * @param {(key: string, options?: object) => string} props.t - Translation function.
 * @param {typeof loadRecentReports} [props.load=loadRecentReports] - Loader (network call); reloads on retry.
 * @returns {JSX.Element}
 */
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
          <AppButton title={t('map.retry')} variant="secondary" onPress={() => setAttempt((value) => value + 1)} />
        </View>
      ) : null}
      <View style={styles.rows}>
        {state.reports.map((report) => (
          <Pressable key={report.report_id} accessibilityRole="button" onPress={() => onSelect(report)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={[styles.stripe, { backgroundColor: colors.severity[severityLevel(report.incident_type)] }]} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{t(`reportForm.incidents.${report.incident_type}`)}</Text>
              <Text style={styles.rowMeta}>
                {`${t(`reportForm.sighting.${report.sighting_type}`)} · ${new Date(report.occurred_at).toLocaleDateString('es-MX')}`}
              </Text>
              {report.has_flags ? <Text style={styles.flagText}>{`⚑ ${t('map.pin.flagged')}`}</Text> : null}
            </View>
            <Icon name="forward" size={20} color={colors.inkSubtle} />
          </Pressable>
        ))}
      </View>
      {state.phase === 'ready' ? <Text style={styles.note}>{t('map.expoGo.approximate')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  title: { fontFamily: fontFamily.display, fontSize: 24, lineHeight: 30, color: colors.primary },
  message: { ...type.body, fontSize: 15, color: colors.ink },
  errorBox: { gap: spacing.md },
  rows: { borderTopWidth: 1, borderTopColor: colors.border },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.md },
  pressed: { opacity: 0.7 },
  stripe: { width: 5, alignSelf: 'stretch', borderRadius: 3 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fontFamily.displayMedium, fontSize: 18, lineHeight: 24, color: colors.ink },
  rowMeta: { ...type.caption, color: colors.inkMuted, fontVariant: ['tabular-nums'] },
  flagText: { fontFamily: fontFamily.label, fontSize: 13, color: colors.warning },
  note: { ...type.caption, color: colors.inkMuted },
});
