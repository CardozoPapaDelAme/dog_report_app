/**
 * @module components/associationReportCard
 * Presentational card for one association report, formatted by `presentAssociationReport`.
 */
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { presentAssociationReport } from '../presenters/associationDisplay.js';

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

  return <View testID="association-report-card" style={styles.card}>
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
      <Info label={t('associationDashboard.card.location')}
        value={`${display.latitude}, ${display.longitude}`} style={styles.half} />
    </View>

    <Text style={styles.sectionTitle}>{t('associationDashboard.card.dog')}</Text>
    <View style={styles.infoRow}>
      <Info label={t('associationDashboard.card.size')} value={display.size} style={styles.half} />
      <Info label={t('associationDashboard.card.color')} value={display.color} style={styles.half} />
      <Info label={t('associationDashboard.card.collar')} value={display.collar} style={styles.half} />
      <Info label={t('associationDashboard.card.photo')} value={display.photo} style={styles.half} />
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
  card: { marginBottom: 12, padding: 16, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2eae0' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  heading: { flex: 1, minWidth: 0 },
  incident: { color: '#172117', fontSize: 18, fontWeight: '700' },
  sighting: { color: '#005a25', fontSize: 13, fontWeight: '600', marginTop: 4 },
  accepted: { alignItems: 'flex-end' },
  acceptedLabel: { color: '#61705e', fontSize: 11 },
  acceptedDate: { color: '#334433', fontSize: 13, fontWeight: '700', marginTop: 3 },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  half: { flexBasis: '45%', flexGrow: 1 },
  info: { minWidth: 0 },
  infoLabel: { color: '#61705e', fontSize: 11, marginBottom: 3 },
  infoValue: { color: '#172117', fontSize: 14, lineHeight: 20 },
  sectionTitle: { color: '#334433', fontSize: 13, fontWeight: '700', marginTop: 18 },
  details: { gap: 10 },
  footer: { marginTop: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#edf1ec' },
  idLabel: { color: '#61705e', fontSize: 11, marginBottom: 3 },
  id: { color: '#5a6658', fontSize: 11 },
});
