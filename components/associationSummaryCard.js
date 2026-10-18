/**
 * @module components/associationSummaryCard
 * Presentational summary for the association dashboard: `AssociationTotal` (big number for the green header)
 * and the default export, a scrollable bar chart by day or month with a selectable bucket on a light surface.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing } from '../theme/index.js';

/** Local noon date for a `YYYY-MM-DD` (day) or `YYYY-MM` (month) bucket key. */
function bucketDate(key, grouping) {
  return new Date(`${key}${grouping === 'month' ? '-01' : ''}T12:00:00`);
}

/** Total count for the header (on forest green); keeps the `association-total` test id. */
export function AssociationTotal({ total }) {
  const { t, i18n } = useTranslation();
  return <View style={styles.totalRow}>
    <Text testID="association-total" style={styles.totalNumber}>{total.toLocaleString(i18n.language)}</Text>
    <Text style={styles.totalLabel}>{t('associationDashboard.summary.total')}</Text>
  </View>;
}

/**
 * @param {object} props
 * @param {ReturnType<typeof import('../models/associationSummary.js').buildAssociationSummary>} props.summary
 * @returns {JSX.Element}
 */
export default function AssociationSummaryCard({ summary }) {
  const { t, i18n } = useTranslation();
  const initial = [...summary.buckets].reverse().find((bucket) => bucket.count > 0) ?? summary.buckets[summary.buckets.length - 1];
  const [selectedKey, setSelectedKey] = useState(initial?.key ?? null);
  const chartRef = useRef(null);
  const selected = summary.buckets.find((bucket) => bucket.key === selectedKey) ?? initial;
  const highest = Math.max(1, ...summary.buckets.map((bucket) => bucket.count));
  const initialIndex = summary.buckets.findIndex((bucket) => bucket.key === initial?.key);

  return <View style={styles.summary}>
    <View style={styles.chartHeading}>
      <Text accessibilityRole="header" style={styles.chartTitle}>{t('associationDashboard.summary.byDate')}</Text>
      <Text style={styles.chartSubtitle}>{t(`associationDashboard.summary.${summary.grouping}`)}</Text>
    </View>

    {summary.total > 0 ? <ScrollView ref={chartRef} horizontal style={styles.chartScroll} contentContainerStyle={styles.chartContent}
      onContentSizeChange={() => chartRef.current?.scrollTo({ x: Math.max(0, (initialIndex - 2) * 56), y: 0, animated: false })}>
      {summary.buckets.map((bucket) => {
        const date = bucketDate(bucket.key, summary.grouping);
        const shortLabel = date.toLocaleDateString(i18n.language, summary.grouping === 'day'
          ? { day: 'numeric', month: 'short' } : { month: 'short', year: '2-digit' });
        const longLabel = date.toLocaleDateString(i18n.language, summary.grouping === 'day'
          ? { day: 'numeric', month: 'long', year: 'numeric' } : { month: 'long', year: 'numeric' });
        const chosen = bucket.key === selected?.key;
        return <Pressable key={bucket.key} accessibilityRole="button"
          accessibilityLabel={`${longLabel}: ${t('associationDashboard.summary.bucketCount', { count: bucket.count })}`}
          accessibilityState={{ selected: chosen }} onPress={() => setSelectedKey(bucket.key)} style={styles.barItem}>
          <View style={styles.barTrack}>
            {bucket.count ? <Text style={styles.barCount}>{bucket.count}</Text> : null}
            <View style={[styles.bar, { height: bucket.count ? Math.max(8, Math.round(bucket.count / highest * 84)) : 3 },
              chosen ? styles.selectedBar : bucket.count ? styles.filledBar : styles.emptyBar]} />
          </View>
          <Text numberOfLines={1} style={[styles.barLabel, chosen && styles.selectedLabel]}>{shortLabel}</Text>
        </Pressable>;
      })}
    </ScrollView> : null}

    {summary.total > 0 && selected ? <Text accessibilityLiveRegion="polite" style={styles.selectedDetail}>
      {bucketDate(selected.key, summary.grouping).toLocaleDateString(i18n.language, summary.grouping === 'day'
        ? { day: 'numeric', month: 'long', year: 'numeric' } : { month: 'long', year: 'numeric' })}
      {' · '}{t('associationDashboard.summary.bucketCount', { count: selected.count })}
    </Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md, flexWrap: 'wrap' },
  totalNumber: { fontFamily: fontFamily.number, fontVariant: ['tabular-nums'], fontSize: 64, lineHeight: 70, color: colors.onPrimary },
  totalLabel: { fontFamily: fontFamily.label, fontSize: 16, color: colors.onForest },
  summary: { gap: spacing.sm },
  chartHeading: { gap: 2 },
  chartTitle: { fontFamily: fontFamily.display, fontSize: 22, lineHeight: 28, color: colors.primary },
  chartSubtitle: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.inkMuted },
  chartScroll: { marginTop: spacing.sm },
  chartContent: { alignItems: 'flex-end', paddingRight: 4 },
  barItem: { width: 52, alignItems: 'center', marginRight: 4 },
  barTrack: { height: 112, width: 38, justifyContent: 'flex-end', alignItems: 'center' },
  barCount: { fontFamily: fontFamily.label, fontVariant: ['tabular-nums'], fontSize: 12, color: colors.ink, marginBottom: 3 },
  bar: { width: 28, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  selectedBar: { backgroundColor: colors.primary },
  filledBar: { backgroundColor: '#8fcf8a' },
  emptyBar: { backgroundColor: colors.surfaceHigh },
  barLabel: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.inkMuted, marginTop: 6, textAlign: 'center' },
  selectedLabel: { fontFamily: fontFamily.label, color: colors.primary },
  selectedDetail: { fontFamily: fontFamily.label, fontSize: 14, color: colors.ink, marginTop: spacing.sm },
});
