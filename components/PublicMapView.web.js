import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { INCIDENT_TYPES, MAX_ZOOM, MIN_ZOOM, severityLevel } from '../models/publicMap.js';
import { WEB_STUB_BOUNDS } from '../services/mapConfig.js';

// Web stub (react-native-web): MapLibre native is unavailable, so the same server data
// is shown as an accessible list and zoom buttons drive onRegionChange for UI tests.
export default function PublicMapView({
  mode, clusters, reports, initialZoom, focus, onRegionChange, onSelectCluster, onSelectReport,
}) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(initialZoom);
  const zoomRef = useRef(initialZoom);

  const apply = useCallback((next) => {
    const level = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    zoomRef.current = level;
    setZoom(level);
    onRegionChange?.({ zoom: level, bounds: [...WEB_STUB_BOUNDS] });
  }, [onRegionChange]);

  useEffect(() => { apply(initialZoom); }, []); // initial region report
  useEffect(() => { if (focus) apply(focus.zoom); }, [focus]);

  return (
    <View style={styles.root} testID="public-map-stub">
      <View style={styles.controls}>
        <Pressable accessibilityRole="button" onPress={() => apply(zoomRef.current - 1)} style={styles.button}>
          <Text style={styles.buttonText}>{t('map.zoomOut')}</Text>
        </Pressable>
        <Text accessibilityLiveRegion="polite" style={styles.zoomLabel}>{t('map.zoomLevel', { zoom })}</Text>
        <Pressable accessibilityRole="button" onPress={() => apply(zoomRef.current + 1)} style={styles.button}>
          <Text style={styles.buttonText}>{t('map.zoomIn')}</Text>
        </Pressable>
      </View>
      {mode === 'clusters' ? clusters.map((cluster) => (
        <Pressable
          key={cluster.cluster_id}
          accessibilityRole="button"
          onPress={() => onSelectCluster?.(cluster)}
          style={styles.item}
        >
          <Text style={styles.itemText}>
            {t('map.clusterItem', {
              count: cluster.report_count,
              severity: t(`map.severity.${severityLevel(cluster.highest_severity)}`),
            })}
          </Text>
        </Pressable>
      )) : null}
      {mode === 'pins' ? reports.map((report) => (
        <Pressable
          key={report.report_id}
          accessibilityRole="button"
          onPress={() => onSelectReport?.(report)}
          style={styles.item}
        >
          <Text style={styles.itemText}>
            {t('map.pinItem', { type: t(`reportForm.incidents.${INCIDENT_TYPES.includes(report.incident_type) ? report.incident_type : 'otro'}`) })}
          </Text>
        </Pressable>
      )) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#e9eee4', padding: 16, gap: 8 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  button: { minHeight: 44, justifyContent: 'center', borderRadius: 12, backgroundColor: '#00450d', paddingHorizontal: 16 },
  buttonText: { color: '#ffffff', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
  zoomLabel: { color: '#191d17', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13 },
  item: { minHeight: 44, justifyContent: 'center', borderRadius: 12, backgroundColor: '#ffffff', borderColor: '#e0e0e0', borderWidth: 1, paddingHorizontal: 14 },
  itemText: { color: '#191d17', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14 },
});
