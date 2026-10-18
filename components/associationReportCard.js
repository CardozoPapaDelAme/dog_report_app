/**
 * @module components/associationReportCard
 * Presentational strip for one association report, formatted by `presentAssociationReport`. It mirrors the
 * moderation queue strip (pin of the report's severity, incident name, date, only the signals that exist,
 * tabular coordinates, and the full report id, which the CSV export shares) but has no actions: the association only reads accepted data.
 */
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { PinGlyph } from './ui/index.js';
import { severityLevel } from '../models/publicMap.js';
import { presentAssociationReport } from '../presenters/associationDisplay.js';
import { colors, fontFamily, layout, spacing, type } from '../theme/index.js';

/**
 * @param {object} props
 * @param {import('../models/associationReport.js').AssociationReport} props.report
 * @returns {JSX.Element}
 */
export default function AssociationReportCard({ report }) {
  const { t, i18n } = useTranslation();
  const display = presentAssociationReport(report, t, i18n.language);
  const unknown = t('associationDashboard.card.unknown');
  // Only the signals that are known: an unknown value says nothing and repeats on every strip.
  const signals = [
    ['size', display.size],
    ['color', display.color],
    ['collar', display.collar],
    ['photo', display.photo],
  ].filter(([, value]) => value !== unknown);

  return <View testID="association-report-card" style={styles.item}>
    <View style={styles.body}>
      <View style={styles.top}>
        <PinGlyph scale={0.72} color={colors.severity[severityLevel(report.incident_type)]} style={styles.pin} />
        <View style={styles.titleBlock}>
          <Text style={styles.incident}>{display.incident}</Text>
          <Text style={styles.observed}>{t('associationDashboard.card.observed')} {display.occurredAt}</Text>
        </View>
        <View style={styles.accepted}>
          <Text style={styles.acceptedLabel}>{t('associationDashboard.card.accepted')}</Text>
          <Text style={styles.acceptedDate}>{display.acceptedDate}</Text>
        </View>
      </View>

      <Text style={styles.sighting}>{display.sighting}</Text>
      {display.details.map(({ key, label, value }) => <Text selectable key={key} style={styles.detail}>{label}: {value}</Text>)}

      {signals.length ? <View style={styles.meta}>
        {signals.map(([key, value]) => <Text key={key} style={styles.metaText}>{t(`associationDashboard.card.${key}`)}: {value}</Text>)}
      </View> : null}

      <Text selectable accessible accessibilityLabel={`${t('associationDashboard.card.location')}: ${display.latitude}, ${display.longitude}`} style={styles.coordinates}>
        {display.latitude}, {display.longitude}
      </Text>

      <Text selectable style={styles.id}>{t('associationDashboard.card.reportId')} {display.id}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  item: { backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.outlineSoft, marginBottom: spacing.md },
  body: { paddingHorizontal: layout.margin, paddingVertical: spacing.lg, gap: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  pin: { marginTop: 2, marginLeft: -4, marginRight: -2 },
  titleBlock: { flex: 1, minWidth: 0, gap: 2 },
  incident: { fontFamily: fontFamily.display, fontSize: 20, lineHeight: 26, color: colors.ink },
  observed: { ...type.caption, color: colors.inkMuted, fontVariant: ['tabular-nums'] },
  accepted: { alignItems: 'flex-end', gap: 2, marginTop: 2 },
  acceptedLabel: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.inkMuted },
  acceptedDate: { fontFamily: fontFamily.label, fontVariant: ['tabular-nums'], fontSize: 13, color: colors.inkMuted },
  sighting: { ...type.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  detail: { ...type.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, columnGap: spacing.lg },
  metaText: { fontFamily: fontFamily.labelMedium, fontSize: 13, color: colors.inkMuted },
  id: { fontFamily: fontFamily.labelMedium, fontVariant: ['tabular-nums'], fontSize: 12, color: colors.inkSubtle },
  coordinates: { fontFamily: fontFamily.labelMedium, fontVariant: ['tabular-nums'], fontSize: 14, color: colors.ink },
});
