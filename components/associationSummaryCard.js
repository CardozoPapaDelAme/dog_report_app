/**
 * @module components/associationSummaryCard
 * Presentational summary for the association dashboard header (dark, on forest green): total count and a
 * scrollable bar chart by day or month with a selectable bucket.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing } from '../theme/index.js';

/** Local noon date for a `YYYY-MM-DD` (day) or `YYYY-MM` (month) bucket key. */
function bucketDate(key, grouping) {
  return new Date(`${key}${grouping === 'month' ? '-01' : ''}T12:00:00`);
}

/**
 * @param {object} props
 * @param {ReturnType<typeof import('../models/associationSummary.js').buildAssociationSummary>} props.summary
 * @returns {JSX.Element}
 */
export default function AssociationSummaryCard({ summary, wide = false }) {
  const { t, i18n } = useTranslation();
  const initial = [...summary.buckets].reverse().find((bucket) => bucket.count > 0) ?? summary.buckets[summary.buckets.length - 1];
  const [selectedKey, setSelectedKey] = useState(initial?.key ?? null);
  const chartRef = useRef(null);
  const selected = summary.buckets.find((bucket) => bucket.key === selectedKey) ?? initial;
  const highest = Math.max(1, ...summary.buckets.map((bucket) => bucket.count));
  const initialIndex = summary.buckets.findIndex((bucket) => bucket.key === initial?.key);

  return <View style={[styles.summary, wide && styles.summaryWide]}>
    <View style={styles.heading}>
      <View style={styles.totalBlock}>
        <Text style={styles.totalLabel}>{t('associationDashboard.summary.total')}</Text>
        <Text testID="association-total" style={styles.totalNumber}>{summary.total.toLocaleString(i18n.language)}</Text>
      </View>
    </View>
    <View style={styles.chartBlock}>
      <View style={styles.chartHeading}>
        <Text style={styles.chartTitle}>{t('associationDashboard.summary.byDate')}</Text>
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
    </View>
  </View>;
}

const styles = StyleSheet.create({
  summary: { marginTop: spacing.lg },
  summaryWide: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xxxl },
  chartBlock: { flex: 1, minWidth: 0 },
  heading: { gap: spacing.md },
  totalBlock: { minWidth: 110 },
  totalLabel: { fontFamily: fontFamily.label, fontSize: 14, color: colors.onForest },
  totalNumber: { fontFamily: fontFamily.number, fontVariant: ['tabular-nums'], fontSize: 64, lineHeight: 70, color: colors.onPrimary },
  chartHeading: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  chartTitle: { fontFamily: fontFamily.label, fontSize: 14, color: colors.onPrimary },
  chartSubtitle: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.onForest },
  chartScroll: { marginTop: spacing.md },
  chartContent: { alignItems: 'flex-end', paddingRight: 4 },
  barItem: { width: 52, alignItems: 'center', marginRight: 4 },
  barTrack: { height: 112, width: 38, justifyContent: 'flex-end', alignItems: 'center' },
  barCount: { fontFamily: fontFamily.label, fontVariant: ['tabular-nums'], fontSize: 12, color: colors.onPrimary, marginBottom: 3 },
  bar: { width: 28, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  selectedBar: { backgroundColor: colors.signal },
  filledBar: { backgroundColor: colors.primaryFixed },
  emptyBar: { backgroundColor: 'rgba(201,230,196,0.25)' },
  barLabel: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.onForest, marginTop: 6, textAlign: 'center' },
  selectedLabel: { fontFamily: fontFamily.label, color: colors.signal },
  selectedDetail: { fontFamily: fontFamily.label, fontSize: 14, color: colors.onPrimary, marginTop: spacing.md },
});
