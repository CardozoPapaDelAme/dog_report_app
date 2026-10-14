/**
 * @module components/ZoneReportsSheet
 * Bottom sheet listing the public reports of a selected cluster area, with loading, empty, offline
 * and error states and a retry action.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { loadZoneReports } from '../hooks/zoneReports.js';
import { severityLevel } from '../models/publicMap.js';
import { colors, fontFamily, spacing, type } from '../theme/index.js';
import { AppButton, Icon, Sheet } from './ui/index.js';

// Bottom sheet listing the public reports of a tapped cluster area (approximate, locally filtered).
/**
 * @param {object} props
 * @param {import('../models/publicMap.js').MapCluster} props.cluster
 * @param {number} props.zoom - Map zoom used to resolve cluster membership.
 * @param {(report: import('../models/publicMap.js').PublicReport) => void} props.onSelect
 * @param {() => void} props.onClose
 * @param {(key: string, options?: object) => string} props.t - Translation function.
 * @param {typeof loadZoneReports} [props.load=loadZoneReports] - Loader (network call); reloads on retry.
 * @returns {JSX.Element}
 */
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
    <Sheet bottomInset testID="zone-sheet" onClose={onClose} maxHeight="85%">
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>{t('zone.title')}</Text>
        {state.phase === 'loading' ? <ActivityIndicator accessibilityLabel={t('zone.loading')} color={colors.primary} style={styles.loader} /> : null}
        {state.phase === 'empty' ? <Text style={styles.message}>{t('zone.empty')}</Text> : null}
        {state.phase === 'offline' || state.phase === 'error' ? (
          <View accessibilityRole="alert" style={styles.errorBox}>
            <Text style={styles.message}>{t(state.phase === 'offline' ? 'zone.offline' : 'zone.error')}</Text>
            <AppButton title={t('map.retry')} variant="secondary" onPress={retry} />
          </View>
        ) : null}
        <View style={styles.list}>
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
        {state.phase === 'ready' ? <Text style={styles.note}>{t('zone.approximate')}</Text> : null}
        <AppButton title={t('map.close')} variant="secondary" onPress={onClose} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  title: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 32, color: colors.ink },
  loader: { paddingVertical: spacing.lg },
  message: { ...type.body, fontSize: 15, color: colors.ink },
  errorBox: { gap: spacing.md },
  list: { borderTopWidth: 1, borderTopColor: colors.border },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.md },
  pressed: { opacity: 0.7 },
  stripe: { width: 5, alignSelf: 'stretch', borderRadius: 3 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fontFamily.displayMedium, fontSize: 18, lineHeight: 24, color: colors.ink },
  rowMeta: { ...type.caption, color: colors.inkMuted, fontVariant: ['tabular-nums'] },
  flagText: { fontFamily: fontFamily.label, fontSize: 13, color: colors.warning },
  note: { ...type.caption, color: colors.inkMuted },
});
