/**
 * @module screens/PublicMapScreen
 * Container screen for the public map: the native MapLibre map with clusters, pins, zone report
 * lists, report details and flagging, or a recent-reports list when the native map is unavailable
 * (Expo Go). The initial center is the device location when available within 3 seconds, otherwise
 * Creel.
 */
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton, Banner, Icon, IconButton, Sheet } from '../components/ui/index.js';
import { colors, fontFamily, layout, radius, spacing, type } from '../theme/index.js';

import RecentReportsList from '../components/RecentReportsList';
import ReportFlagSheet from '../components/ReportFlagSheet';
import ZoneReportsSheet from '../components/ZoneReportsSheet';
import { usePublicMap } from '../hooks/usePublicMap.js';
import { INCIDENT_TYPES, MAX_ZOOM, ZOOM_RADIUS_BANDS, isInViewport, severityLevel } from '../models/publicMap.js';
import { getApiBaseUrl } from '../services/apiClient.js';
import { CREEL_CENTER, INITIAL_ZOOM, MAP_ATTRIBUTION_TEXT } from '../services/mapConfig.js';
import { isNativeMapAvailableAtRuntime } from '../services/mapRuntime.js';

const LOCATION_TIMEOUT_MS = 3000;
/** Height of the compact cluster card; the camera leaves this much room below the focused cluster. */
const CLUSTER_CARD_PADDING = 260;
const DETAIL_KEYS = ['descripcion', 'cantidad_aprox', 'hubo_mordida', 'tipo_animal', 'resulto_herido', 'cantidad_afectada', 'situacion'];

/**
 * Zoom at which the server clusters with a smaller radius, i.e. where a tapped cluster actually splits.
 * Zooming inside a band changes nothing (the server only re-clusters at band boundaries).
 */
function nextBandZoom(zoom) {
  const level = Math.floor(zoom);
  const index = ZOOM_RADIUS_BANDS.findIndex((band) => level >= band.min && level <= band.max);
  const next = ZOOM_RADIUS_BANDS[index + 1];
  return Math.min(MAX_ZOOM, next ? next.min : level + 1);
}

// Lazy on purpose: Expo Go must never evaluate the MapLibre native module.
// Keep the extensionless path so Metro/esbuild still pick PublicMapView.web.js on web.
let cachedMapView = null;
/** Requires `components/PublicMapView` on first use and caches it. */
function getPublicMapView() {
  if (!cachedMapView) cachedMapView = require('../components/PublicMapView').default;
  return cachedMapView;
}

// Foreground location is optional: never block the map when it is denied or slow.
/** Device location when permitted (no prompt on web), otherwise `CREEL_CENTER`; never rejects. */
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

/** Resolves the initial map center, falling back to `CREEL_CENTER` after `LOCATION_TIMEOUT_MS`; `null` while pending. */
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

/** Public photo URL of a report, or `null` when the API base URL is not configured. */
function photoUrl(reportId) {
  try { return `${getApiBaseUrl()}/reports/${encodeURIComponent(reportId)}/photo`; } catch { return null; }
}

/** Compact card for a selected cluster: no dimmed backdrop, so the focused cluster stays visible above it. */
function ClusterModal({ cluster, onClose, onZoomIn, onViewReports, t }) {
  const insets = useSafeAreaInsets();
  const level = severityLevel(cluster.highest_severity);
  return (
    <View pointerEvents="box-none" style={styles.cardSlot}>
      <View testID="cluster-modal" style={[styles.clusterCard, { paddingBottom: spacing.lg + insets.bottom }]}>
        <View style={styles.cardHead}>
          <Text accessibilityRole="alert" style={styles.cardTitle}>{t('map.cluster.title', { count: cluster.report_count })}</Text>
          <IconButton icon="close" accessibilityLabel={t('map.close')} onPress={onClose} />
        </View>
        <Text style={[styles.severityTag, { backgroundColor: colors.severity[level] }]}>
          {t('map.cluster.highest', { type: t(`reportForm.incidents.${cluster.highest_severity}`) })}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.countStrip}>
          {INCIDENT_TYPES.map((type) => (
            <View key={type} style={styles.countCell}>
              <Text style={styles.rowLabel}>{t(`reportForm.incidents.${type}`)}</Text>
              <Text style={[styles.rowValue, cluster.type_counts[type] === 0 && styles.rowValueZero]}>{cluster.type_counts[type]}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.actions}>
          <AppButton title={t('map.cluster.viewReports')} onPress={onViewReports} style={styles.actionMain} />
          <AppButton title={t('map.zoomIn')} variant="secondary" onPress={onZoomIn} style={styles.actionSide} />
        </View>
      </View>
    </View>
  );
}

/** Floating top control: back arrow and screen title in one small capsule, so the map keeps the whole screen. */
function MapTopBar({ onBack, t, style }) {
  return (
    <View style={[styles.topBar, style]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('map.back')} onPress={onBack} hitSlop={6} style={({ pressed }) => [styles.backCircle, pressed && styles.pressed]}>
        <Icon name="back" size={22} color={colors.onPrimary} />
      </Pressable>
      <Text accessibilityRole="header" numberOfLines={1} style={styles.topTitle}>{t('map.title')}</Text>
    </View>
  );
}

/** Formats a report detail value for display. */
function detailValue(t, key, value) {
  if (typeof value === 'boolean') return t(`reportForm.boolean.${value ? 'si' : 'no'}`);
  if (key === 'situacion') return t(`reportForm.situations.${value}`, { defaultValue: String(value) });
  return String(value);
}

/** Bottom sheet with the details, sanitized photo (when available) and flag action of one public report. */
function PinSheet({ report, onClose, onFlag, t }) {
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
    <Sheet bottomInset testID="pin-sheet" onClose={onClose} maxHeight="88%">
      <ScrollView contentContainerStyle={styles.sheetContent}>
        <Text accessibilityRole="header" style={styles.modalTitle}>{t(`reportForm.incidents.${report.incident_type}`)}</Text>
        {report.has_flags ? (
          <View style={styles.flagNotice}><Icon name="flag" size={18} color={colors.warning} /><Text style={styles.flagText}>{t('map.pin.flagged')}</Text></View>
        ) : null}
        {uri && !photoFailed ? (
          <Image
            accessibilityLabel={t('map.pin.photo')}
            source={{ uri }}
            style={styles.photo}
            onError={() => setPhotoFailed(true)}
          />
        ) : null}
        <View style={styles.facts}>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.countRow}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Text style={[styles.rowValue, styles.rowValueWrap]}>{value}</Text>
            </View>
          ))}
        </View>
        <AppButton title={t('flag.open')} variant="destructive" onPress={onFlag} />
        <AppButton title={t('map.close')} variant="secondary" onPress={onClose} />
      </ScrollView>
    </Sheet>
  );
}

// `mapAvailable` is an override for tests; production reads the runtime (Expo Go has no native map).
/**
 * @param {object} props
 * @param {() => void} props.onBack
 * @param {boolean} [props.mapAvailable] - Overrides the native map runtime check.
 * @returns {JSX.Element}
 */
export default function PublicMapScreen({ onBack, mapAvailable }) {
  const available = mapAvailable ?? isNativeMapAvailableAtRuntime();
  return available ? <NativeMapScreen onBack={onBack} /> : <ExpoGoFallbackScreen onBack={onBack} />;
}

/** Map replacement for Expo Go: notice, recent reports, report details and flagging. */
function ExpoGoFallbackScreen({ onBack }) {
  const { t } = useTranslation();
  const [selectedReport, setSelectedReport] = useState(null);
  const [flagReport, setFlagReport] = useState(null);
  return (
    <SafeAreaView style={styles.fallbackRoot}>
      <MapTopBar onBack={onBack} t={t} style={styles.topBarFlow} />
      <View style={styles.mapArea}>
        <ScrollView contentContainerStyle={styles.fallbackContent}>
          <View accessibilityRole="alert" testID="expo-go-notice">
            <Banner tone="warning" title={t('map.expoGo.notice')} message={t('map.expoGo.hint')} />
          </View>
          <RecentReportsList onSelect={setSelectedReport} t={t} />
        </ScrollView>
        {selectedReport ? (
          <PinSheet key={`pin-${selectedReport.report_id}`} report={selectedReport} onClose={() => setSelectedReport(null)} onFlag={() => setFlagReport(selectedReport)} t={t} />
        ) : null}
        {flagReport ? <ReportFlagSheet key={`flag-${flagReport.report_id}`} report={flagReport} onClose={() => setFlagReport(null)} t={t} /> : null}
      </View>
    </SafeAreaView>
  );
}

/** Native map screen driven by `usePublicMap`. */
function NativeMapScreen({ onBack }) {
  const PublicMapView = getPublicMapView();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const map = usePublicMap();
  const initialCenter = useInitialCenter();
  // `selectedCluster` keeps the zoom at the moment of the tap: the zone list resolves membership with it.
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [zoneCluster, setZoneCluster] = useState(null);
  const [flagReport, setFlagReport] = useState(null);
  const [focus, setFocus] = useState(null);

  const focusCluster = useCallback((cluster, fromZoom) => {
    setFocus({ ...cluster.approximate_location, zoom: nextBandZoom(fromZoom), padding: { bottom: CLUSTER_CARD_PADDING + insets.bottom } });
  }, [insets.bottom]);

  const selectCluster = useCallback((cluster) => {
    const zoom = map.region?.zoom ?? INITIAL_ZOOM;
    setSelectedCluster({ cluster, zoom });
    focusCluster(cluster, zoom);
  }, [focusCluster, map.region]);

  const zoomIntoCluster = useCallback(() => {
    if (!selectedCluster) return;
    focusCluster(selectedCluster.cluster, map.region?.zoom ?? selectedCluster.zoom);
  }, [focusCluster, map.region, selectedCluster]);

  const visibleReports = map.mode === 'pins' && map.region
    ? map.reports.filter((report) => isInViewport(report.approximate_location, map.region.viewport))
    : map.reports;

  let banner = null;
  if (map.phase === 'offline') banner = { text: t('map.offline'), retry: true };
  else if (map.phase === 'error') banner = { text: t('map.error'), retry: true, danger: true };
  else if (map.phase === 'empty') banner = { text: t('map.empty') };

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        {initialCenter ? (
          <PublicMapView
            mode={map.mode}
            clusters={map.clusters}
            reports={visibleReports}
            initialCenter={initialCenter}
            initialZoom={INITIAL_ZOOM}
            focus={focus}
            onRegionChange={map.setRegion}
            onSelectCluster={selectCluster}
            onSelectReport={setSelectedReport}
          />
        ) : (
          <View style={styles.centered}><ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} /></View>
        )}
      </View>
      <MapTopBar onBack={onBack} t={t} style={[styles.topBarFloat, { top: insets.top + spacing.sm }]} />
      {map.phase === 'loading' && initialCenter ? (
        <View pointerEvents="none" style={[styles.loading, { top: insets.top + spacing.sm }]}>
          <ActivityIndicator accessibilityLabel={t('map.loading')} color={colors.primary} />
        </View>
      ) : null}
      {banner ? (
        <View style={[styles.bannerSlot, { top: insets.top + 64 }]} accessibilityRole="alert">
          <View style={styles.banner}>
            <Icon name="alert" size={20} color={banner.danger ? '#ffb4ab' : colors.warningAmber} />
            <View style={styles.bannerText}>
              <Text style={styles.bannerTitle}>{banner.text}</Text>
              {map.phase === 'offline' ? <Text style={styles.bannerHint}>{t('map.offlineReporting')}</Text> : null}
            </View>
            {banner.retry ? (
              <Pressable accessibilityRole="button" onPress={map.retry} hitSlop={8} style={styles.retryButton}>
                <Text style={styles.retryText}>{t('map.retry')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
      <Text style={[styles.attribution, { bottom: insets.bottom + spacing.sm }]}>{MAP_ATTRIBUTION_TEXT}</Text>
      {selectedCluster ? (
        <ClusterModal
          cluster={selectedCluster.cluster}
          onClose={() => setSelectedCluster(null)}
          onZoomIn={zoomIntoCluster}
          onViewReports={() => { setZoneCluster({ cluster: selectedCluster.cluster, zoom: selectedCluster.zoom }); setSelectedCluster(null); }}
          t={t}
        />
      ) : null}
      {zoneCluster ? (
        <ZoneReportsSheet
          cluster={zoneCluster.cluster}
          zoom={zoneCluster.zoom}
          onSelect={setSelectedReport}
          onClose={() => setZoneCluster(null)}
          t={t}
        />
      ) : null}
      {selectedReport ? (
        <PinSheet key={`pin-${selectedReport.report_id}`} report={selectedReport} onClose={() => setSelectedReport(null)} onFlag={() => setFlagReport(selectedReport)} t={t} />
      ) : null}
      {flagReport ? <ReportFlagSheet key={`flag-${flagReport.report_id}`} report={flagReport} onClose={() => setFlagReport(null)} t={t} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  fallbackRoot: { flex: 1, backgroundColor: colors.background },
  topBar: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 48, borderRadius: radius.pill, backgroundColor: 'rgba(2,26,6,0.86)', paddingLeft: 4, paddingRight: spacing.lg },
  topBarFloat: { position: 'absolute', left: spacing.lg },
  topBarFlow: { marginHorizontal: spacing.lg, marginVertical: spacing.sm },
  backCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  topTitle: { fontFamily: fontFamily.display, fontSize: 18, lineHeight: 24, color: colors.onPrimary },
  pressed: { opacity: 0.7 },
  cardSlot: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  clusterCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  cardTitle: { flex: 1, fontFamily: fontFamily.display, fontSize: 24, lineHeight: 30, color: colors.ink },
  countStrip: { gap: spacing.sm, paddingVertical: spacing.xs },
  actionMain: { flex: 2.5 },
  actionSide: { flex: 1 },
  mapArea: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { position: 'absolute', alignSelf: 'center', borderRadius: radius.pill, backgroundColor: colors.surface, padding: spacing.sm },
  fallbackContent: { padding: spacing.lg, gap: spacing.xl },
  bannerSlot: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, backgroundColor: 'rgba(2,26,6,0.9)', paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  bannerText: { flex: 1, gap: 2 },
  bannerTitle: { fontFamily: fontFamily.label, fontSize: 15, lineHeight: 20, color: colors.onPrimary },
  bannerHint: { ...type.caption, color: colors.onForest },
  retryButton: { minHeight: layout.minTouch, justifyContent: 'center' },
  retryText: { fontFamily: fontFamily.displayMedium, fontSize: 16, color: colors.signal },
  attribution: { position: 'absolute', left: spacing.sm, borderRadius: radius.xs, backgroundColor: 'rgba(255,255,255,0.88)', paddingHorizontal: 6, paddingVertical: 2, color: colors.ink, fontFamily: fontFamily.regular, fontSize: 10 },
  modalTitle: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 32, color: colors.ink },
  severityTag: { flexShrink: 0, alignSelf: 'flex-start', overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, color: '#ffffff', fontFamily: fontFamily.label, fontSize: 13 },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.sm },
  countCell: { minWidth: 104, flexDirection: 'column-reverse', gap: 2, borderRadius: radius.md, backgroundColor: colors.surfaceLow, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, borderBottomColor: colors.border, borderBottomWidth: 1, paddingVertical: spacing.md },
  rowLabel: { fontFamily: fontFamily.label, fontSize: 13, color: colors.inkMuted },
  rowValue: { fontFamily: fontFamily.number, fontVariant: ['tabular-nums'], fontSize: 20, lineHeight: 24, color: colors.primary },
  rowValueZero: { color: colors.inkSubtle },
  rowValueWrap: { flexShrink: 1, textAlign: 'right', fontFamily: fontFamily.labelMedium, fontSize: 15, lineHeight: 21, color: colors.ink },
  actions: { flexDirection: 'row', gap: spacing.md },
  actionHalf: { flex: 1 },
  sheetContent: { gap: spacing.md },
  facts: { borderTopWidth: 1, borderTopColor: colors.border },
  flagNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.warningSoft, padding: spacing.md },
  flagText: { fontFamily: fontFamily.label, fontSize: 14, color: colors.warning, flexShrink: 1 },
  photo: { width: '100%', height: 200, borderRadius: radius.lg, backgroundColor: colors.surfaceHigh },
});
