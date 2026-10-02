import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PublicMapView from '../components/PublicMapView.js';
import { usePublicMap } from '../hooks/usePublicMap.js';
import { INCIDENT_TYPES, MAX_ZOOM, isInViewport, severityColor } from '../models/publicMap.js';
import { getApiBaseUrl } from '../services/apiClient.js';
import { CREEL_CENTER, INITIAL_ZOOM, MAP_ATTRIBUTION_TEXT } from '../services/mapConfig.js';

const colors = {
  ink: '#191d17', primary: '#00450d', surface: '#f7fbf1', muted: '#5d6859', line: '#e0e0e0',
  danger: '#ba1a1a', dangerSoft: '#ffdad6', warningSoft: '#fff0c2', warning: '#8a5700',
};
const LOCATION_TIMEOUT_MS = 3000;
const CLUSTER_ZOOM_STEP = 2;
const DETAIL_KEYS = ['descripcion', 'cantidad_aprox', 'hubo_mordida', 'tipo_animal', 'resulto_herido', 'cantidad_afectada', 'situacion'];

// Foreground location is optional: never block the map when it is denied or slow.
async function resolveInitialCenter() {
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    // Never prompt on web; the browser prompt would stall the map.
    if (!permission.granted && permission.canAskAgain && Platform.OS !== 'web') {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (!permission.granted) return CREEL_CENTER;
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { longitude: position.coords.longitude, latitude: position.coords.latitude };
  } catch {
    return CREEL_CENTER;
  }
}

function useInitialCenter() {
  const [center, setCenter] = useState(null);
  useEffect(() => {
    let active = true;
    let timer = null;
    const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(CREEL_CENTER), LOCATION_TIMEOUT_MS); });
    Promise.race([resolveInitialCenter(), timeout]).then((value) => { if (active) setCenter(value); });
    return () => { active = false; clearTimeout(timer); };
  }, []);
  return center;
}

function photoUrl(reportId) {
  try { return `${getApiBaseUrl()}/reports/${encodeURIComponent(reportId)}/photo`; } catch { return null; }
}

function ClusterModal({ cluster, onClose, onZoomIn, t }) {
  return (
    <View style={styles.backdrop}>
      <View accessibilityRole="alert" style={styles.modal} testID="cluster-modal">
        <Text style={styles.modalTitle}>{t('map.cluster.title', { count: cluster.report_count })}</Text>
        <Text style={[styles.severityTag, { backgroundColor: severityColor(cluster.highest_severity) }]}>
          {t('map.cluster.highest', { type: t(`reportForm.incidents.${cluster.highest_severity}`) })}
        </Text>
        {INCIDENT_TYPES.map((type) => (
          <View key={type} style={styles.countRow}>
            <Text style={styles.rowLabel}>{t(`reportForm.incidents.${type}`)}</Text>
            <Text style={styles.rowValue}>{cluster.type_counts[type]}</Text>
          </View>
        ))}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onZoomIn} style={styles.primaryButton}>
            <Text style={styles.primaryText}>{t('map.zoomIn')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>{t('map.close')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function detailValue(t, key, value) {
  if (typeof value === 'boolean') return t(`reportForm.boolean.${value ? 'si' : 'no'}`);
  if (key === 'situacion') return t(`reportForm.situations.${value}`, { defaultValue: String(value) });
  return String(value);
}

function PinSheet({ report, onClose, t }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const uri = report.has_sanitized_photo ? photoUrl(report.report_id) : null;
  const { dog } = report;
  const collar = dog.has_collar === null ? null : t(`reportForm.collar.${dog.has_collar ? 'si' : 'no'}`);
  const rows = [
    [t('reportForm.fields.sighting_type'), t(`reportForm.sighting.${report.sighting_type}`)],
    dog.predominant_color ? [t('map.pin.color'), dog.predominant_color] : null,
    dog.size ? [t('reportForm.fields.dog_size'), t(`reportForm.dogSize.${dog.size}`, { defaultValue: dog.size })] : null,
    collar ? [t('reportForm.fields.has_collar'), collar] : null,
    ...DETAIL_KEYS.filter((key) => report.details[key] !== undefined && report.details[key] !== null && report.details[key] !== '')
      .map((key) => [t(`reportForm.fields.${key}`), detailValue(t, key, report.details[key])]),
    [t('map.pin.occurredAt'), new Date(report.occurred_at).toLocaleString('es-MX')],
  ].filter(Boolean);
  return (
    <View style={styles.sheet} testID="pin-sheet">
      <View style={styles.grabber} />
      <ScrollView contentContainerStyle={styles.sheetContent}>
        <Text style={styles.modalTitle}>{t(`reportForm.incidents.${report.incident_type}`)}</Text>
        {report.has_flags ? (
          <View style={styles.flagNotice}><Text style={styles.flagText}>{t('map.pin.flagged')}</Text></View>
        ) : null}
        {uri && !photoFailed ? (
          <Image
            accessibilityLabel={t('map.pin.photo')}
            source={{ uri }}
            style={styles.photo}
            onError={() => setPhotoFailed(true)}
          />
        ) : null}
        {rows.map(([label, value]) => (
          <View key={label} style={styles.countRow}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={[styles.rowValue, styles.rowValueWrap]}>{value}</Text>
          </View>
        ))}
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>{t('map.close')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export default function PublicMapScreen({ onBack }) {
  const { t } = useTranslation();
  const map = usePublicMap();
  const initialCenter = useInitialCenter();
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [focus, setFocus] = useState(null);

  const zoomIntoCluster = useCallback(() => {
    if (!selectedCluster) return;
    const zoom = Math.min(MAX_ZOOM, (map.region?.zoom ?? INITIAL_ZOOM) + CLUSTER_ZOOM_STEP);
    setFocus({ ...selectedCluster.approximate_location, zoom });
    setSelectedCluster(null);
  }, [map.region, selectedCluster]);

  const visibleReports = map.mode === 'pins' && map.region
    ? map.reports.filter((report) => isInViewport(report.approximate_location, map.region.viewport))
    : map.reports;

  let banner = null;
  if (map.phase === 'offline') banner = { text: t('map.offline'), retry: true };
  else if (map.phase === 'error') banner = { text: t('map.error'), retry: true, danger: true };
  else if (map.phase === 'empty') banner = { text: t('map.empty') };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>{t('map.back')}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>{t('map.title')}</Text>
      </View>
      <View style={styles.mapArea}>
        {initialCenter ? (
          <PublicMapView
            mode={map.mode}
            clusters={map.clusters}
            reports={visibleReports}
            initialCenter={initialCenter}
            initialZoom={INITIAL_ZOOM}
            focus={focus}
            onRegionChange={map.setRegion}
            onSelectCluster={setSelectedCluster}
            onSelectReport={setSelectedReport}
          />
        ) : (
          <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
        )}
        {map.phase === 'loading' && initialCenter ? (
          <View pointerEvents="none" style={styles.loading}>
            <ActivityIndicator accessibilityLabel={t('map.loading')} color={colors.primary} />
          </View>
        ) : null}
        {banner ? (
          <View style={[styles.banner, banner.danger && styles.bannerDanger]} accessibilityRole="alert">
            <Text style={styles.bannerText}>{banner.text}</Text>
            {banner.retry ? (
              <Pressable accessibilityRole="button" onPress={map.retry} style={styles.retryButton}>
                <Text style={styles.retryText}>{t('map.retry')}</Text>
              </Pressable>
            ) : null}
            {map.phase === 'offline' ? <Text style={styles.bannerHint}>{t('map.offlineReporting')}</Text> : null}
          </View>
        ) : null}
        <Text style={styles.attribution}>{MAP_ATTRIBUTION_TEXT}</Text>
        {selectedCluster ? (
          <ClusterModal cluster={selectedCluster} onClose={() => setSelectedCluster(null)} onZoomIn={zoomIntoCluster} t={t} />
        ) : null}
        {selectedReport ? <PinSheet key={selectedReport.report_id} report={selectedReport} onClose={() => setSelectedReport(null)} t={t} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  backButton: { minHeight: 44, justifyContent: 'center', borderRadius: 999, borderColor: colors.line, borderWidth: 1, backgroundColor: '#ffffff', paddingHorizontal: 16 },
  backText: { color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
  headerTitle: { color: colors.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20 },
  mapArea: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { position: 'absolute', top: 12, alignSelf: 'center', borderRadius: 999, backgroundColor: '#ffffff', padding: 8 },
  banner: { position: 'absolute', top: 12, left: 16, right: 16, borderRadius: 14, borderColor: '#ffa000', borderWidth: 1, backgroundColor: colors.warningSoft, padding: 14, gap: 8 },
  bannerDanger: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  bannerText: { color: colors.ink, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14 },
  bannerHint: { color: colors.muted, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12 },
  retryButton: { minHeight: 40, alignSelf: 'flex-start', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary, paddingHorizontal: 16 },
  retryText: { color: '#ffffff', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
  attribution: { position: 'absolute', left: 8, bottom: 6, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 6, paddingVertical: 2, color: colors.ink, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10 },
  backdrop: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)', padding: 24 },
  modal: { width: '100%', maxWidth: 380, borderRadius: 16, backgroundColor: '#ffffff', padding: 20, gap: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  modalTitle: { color: colors.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20 },
  severityTag: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, color: '#ffffff', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12 },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderBottomColor: colors.line, borderBottomWidth: 1, paddingVertical: 8 },
  rowLabel: { color: colors.muted, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14 },
  rowValue: { color: colors.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  rowValueWrap: { flexShrink: 1, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  primaryButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primary },
  primaryText: { color: '#ffffff', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  secondaryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderColor: colors.line, borderWidth: 1, paddingHorizontal: 16, marginTop: 6 },
  secondaryText: { color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '70%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 16, elevation: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginTop: 10 },
  sheetContent: { padding: 20, gap: 6 },
  flagNotice: { borderRadius: 12, backgroundColor: colors.warningSoft, padding: 10 },
  flagText: { color: colors.warning, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13 },
  photo: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#d8dbd2' },
});
