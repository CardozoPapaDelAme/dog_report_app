import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

function bucketDate(key, grouping) {
  return new Date(`${key}${grouping === 'month' ? '-01' : ''}T12:00:00`);
}

export default function AssociationSummaryCard({ summary }) {
  const { t, i18n } = useTranslation();
  const initial = [...summary.buckets].reverse().find((bucket) => bucket.count > 0) ?? summary.buckets[summary.buckets.length - 1];
  const [selectedKey, setSelectedKey] = useState(initial?.key ?? null);
  const chartRef = useRef(null);
  const selected = summary.buckets.find((bucket) => bucket.key === selectedKey) ?? initial;
  const highest = Math.max(1, ...summary.buckets.map((bucket) => bucket.count));
  const initialIndex = summary.buckets.findIndex((bucket) => bucket.key === initial?.key);

  return <View style={styles.card}>
    <View style={styles.heading}>
      <View style={styles.totalBlock}>
        <Text style={styles.totalLabel}>{t('associationDashboard.summary.total')}</Text>
        <Text testID="association-total" style={styles.totalNumber}>{summary.total.toLocaleString(i18n.language)}</Text>
      </View>
      <View style={styles.chartHeading}>
        <Text style={styles.chartTitle}>{t('associationDashboard.summary.byDate')}</Text>
        <Text style={styles.chartSubtitle}>{t(`associationDashboard.summary.${summary.grouping}`)}</Text>
      </View>
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
            <View style={[styles.bar, { height: bucket.count ? Math.max(8, Math.round(bucket.count / highest * 80)) : 3 },
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
  card: { marginTop: 18, padding: 16, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2eae0' },
  heading: { alignItems: 'flex-start' },
  totalBlock: { minWidth: 110 },
  totalLabel: { color: '#61705e', fontSize: 13, fontWeight: '600' },
  totalNumber: { color: '#005a25', fontSize: 32, fontWeight: '800', marginTop: 2 },
  chartHeading: { marginTop: 12 },
  chartTitle: { color: '#172117', fontSize: 16, fontWeight: '700' },
  chartSubtitle: { color: '#61705e', fontSize: 12, marginTop: 3 },
  chartScroll: { marginTop: 14 },
  chartContent: { alignItems: 'flex-end', paddingRight: 4 },
  barItem: { width: 52, alignItems: 'center', marginRight: 4 },
  barTrack: { height: 104, width: 38, justifyContent: 'flex-end', alignItems: 'center' },
  barCount: { color: '#334433', fontSize: 11, fontWeight: '700', marginBottom: 3 },
  bar: { width: 30, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  selectedBar: { backgroundColor: '#005a25' },
  filledBar: { backgroundColor: '#92c49c' },
  emptyBar: { backgroundColor: '#dce7da' },
  barLabel: { color: '#61705e', fontSize: 10, marginTop: 6, textAlign: 'center' },
  selectedLabel: { color: '#005a25', fontWeight: '700' },
  selectedDetail: { color: '#334433', fontSize: 13, fontWeight: '600', marginTop: 12 },
});
