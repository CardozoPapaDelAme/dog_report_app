/**
 * @module components/associationReportCard
 * Presentational inbox row for one association report, formatted by `presentAssociationReport`: full-width,
 * separated by hairlines (no card box).
 */
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { presentAssociationReport } from '../presenters/associationDisplay.js';
import { colors, fontFamily, layout, spacing, type } from '../theme/index.js';

/** Label/value pair with a selectable value. */
function Info({ label, value, style }) {
  return <View style={[styles.info, style]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text selectable style={styles.infoValue}>{value}</Text>
  </View>;
}

/**
 * @param {object} props
 * @param {import('../models/associationReport.js').AssociationReport} props.report
 * @returns {JSX.Element}
 */
export default function AssociationReportCard({ report }) {
  const { t, i18n } = useTranslation();
  const display = presentAssociationReport(report, t, i18n.language);

  return <View testID="association-report-card" style={styles.row}>
    <View style={styles.header}>
      <View style={styles.heading}>
        <Text style={styles.incident}>{display.incident}</Text>
        <Text style={styles.sighting}>{display.sighting}</Text>
      </View>
      <View style={styles.accepted}>
        <Text style={styles.acceptedLabel}>{t('associationDashboard.card.accepted')}</Text>
        <Text style={styles.acceptedDate}>{display.acceptedDate}</Text>
      </View>
    </View>

    <View style={styles.infoRow}>
      <Info label={t('associationDashboard.card.observed')} value={display.occurredAt} style={styles.half} />
      <Info label={t('associationDashboard.card.location')} value={`${display.latitude}, ${display.longitude}`} style={styles.half} />
    </View>

    <Text style={styles.sectionTitle}>{t('associationDashboard.card.dog')}</Text>
    <View style={styles.infoRow}>
      <Info label={t('associationDashboard.card.size')} value={display.size} style={styles.quarter} />
      <Info label={t('associationDashboard.card.color')} value={display.color} style={styles.quarter} />
      <Info label={t('associationDashboard.card.collar')} value={display.collar} style={styles.quarter} />
      <Info label={t('associationDashboard.card.photo')} value={display.photo} style={styles.quarter} />
    </View>

    {display.details.length ? <View style={styles.details}>
      <Text style={styles.sectionTitle}>{t('associationDashboard.card.details')}</Text>
      {display.details.map(({ key, label, value }) => <Info key={key} label={label} value={value} />)}
    </View> : null}

    <View style={styles.footer}>
      <Text style={styles.idLabel}>{t('associationDashboard.card.reportId')}</Text>
      <Text selectable style={styles.id}>{display.id}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: layout.margin, paddingVertical: spacing.lg, gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  heading: { flex: 1, minWidth: 0, gap: 2 },
  incident: { fontFamily: fontFamily.displayMedium, fontSize: 21, lineHeight: 27, color: colors.ink },
  sighting: { fontFamily: fontFamily.label, fontSize: 14, color: colors.primary },
  accepted: { alignItems: 'flex-end', gap: 2 },
  acceptedLabel: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.inkMuted },
  acceptedDate: { fontFamily: fontFamily.label, fontVariant: ['tabular-nums'], fontSize: 13, color: colors.ink },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, columnGap: spacing.sm },
  half: { flexBasis: '45%', flexGrow: 1 },
  quarter: { flexBasis: '21%', flexGrow: 1 },
  info: { minWidth: 0, gap: 1 },
  infoLabel: { fontFamily: fontFamily.label, fontSize: 12, color: colors.inkMuted },
  infoValue: { ...type.body, fontSize: 15, lineHeight: 21, color: colors.ink },
  sectionTitle: { fontFamily: fontFamily.label, fontSize: 13, color: colors.primary, marginTop: spacing.xs },
  details: { gap: spacing.sm },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: 2 },
  idLabel: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.inkMuted },
  id: { fontFamily: fontFamily.labelMedium, fontVariant: ['tabular-nums'], fontSize: 12, color: colors.inkMuted },
});
