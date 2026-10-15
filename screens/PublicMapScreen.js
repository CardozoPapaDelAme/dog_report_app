/**
 * @module screens/PublicMapScreen
 * Container screen for the public map: the native MapLibre map with clusters, pins, zone report
 * lists, report details and flagging, or a recent-reports list when the native map is unavailable
 * (Expo Go). The initial center is the device location when available within 3 seconds, otherwise
 * Creel.
 */
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton, Banner, Icon, IconButton, MapCompass, PhotoViewer, Sheet, SheetHost } from '../components/ui/index.js';
import { colors, fontFamily, layout, radius, spacing, type } from '../theme/index.js';

import RecentReportsList from '../components/RecentReportsList';
import ReportFlagSheet from '../components/ReportFlagSheet';
import ZoneReportsSheet from '../components/ZoneReportsSheet';
import { usePublicHeatmapReports } from '../hooks/usePublicHeatmapReports.js';
import { usePublicMap } from '../hooks/usePublicMap.js';
import { HEATMAP_MAX_ZOOM, INCIDENT_TYPES, MAX_ZOOM, ZOOM_RADIUS_BANDS, isInViewport, severityLevel } from '../models/publicMap.js';
import { getApiBaseUrl } from '../services/apiClient.js';
import { CREEL_CENTER, INITIAL_ZOOM, MAP_ATTRIBUTION_TEXT } from '../services/mapConfig.js';
import { isNativeMapAvailableAtRuntime } from '../services/mapRuntime.js';

/** Height of the vertical mode switch (two 40 pt options, 2 pt gap, 3 pt padding); the compass sits right under it. */
const MODE_SWITCH_HEIGHT = 40 * 2 + 2 + 3 * 2;
/** How long the "switch to clusters to zoom further" hint stays on screen. */
const HEATMAP_HINT_MS = 5000;
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

/** Compact card for a selected cluster: no dimmed backdrop, so the focused cluster stays visible above it. The camera already zoomed in on tap. */
function ClusterModal({ cluster, onClose, onViewReports, t }) {
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
        <AppButton title={t('map.cluster.viewReports')} onPress={onViewReports} />
      </View>
    </View>
  );
}

/**
 * Floating back control: one round white button with a soft shadow, like the controls of any map app.
 * The screen title stays available to screen readers; `showTitle` also draws it (list view without a map).
 */
function MapTopBar({ onBack, t, style, showTitle = false }) {
  return (
    <View style={[styles.topBar, style]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('map.back')} onPress={onBack} hitSlop={8} style={({ pressed }) => [styles.backCircle, pressed && styles.pressed]}>
        <Icon name="back" size={24} color={colors.primary} />
      </Pressable>
      <Text accessibilityRole="header" numberOfLines={1} style={showTitle ? styles.topTitleShown : styles.topTitleHidden}>{t('map.title')}</Text>
    </View>
  );
}

/** Slim vertical switch floating at the right margin (same inset as the back button): icon-only (labels for screen readers), clusters over heatmap. */
function MapModeSwitch({ value, onChange, t, style }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('map.modeLabel')} style={[styles.modeSwitch, style]}>
      {['clusters', 'heatmap'].map((mode) => {
        const selected = value === mode;
        return (
          <Pressable
            key={mode}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={t(mode === 'clusters' ? 'map.modeClusters' : 'map.modeHeatmap')}
            onPress={() => onChange(mode)}
            style={[styles.modeOption, selected && styles.modeOptionSelected]}
          >
            <Icon name={mode === 'clusters' ? 'clusters' : 'heat'} size={20} color={selected ? colors.onPrimary : colors.primary} />
          </Pressable>
        );
      })}
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
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const uri = report.has_sanitized_photo ? photoUrl(report.report_id) : null;
  const { dog } = report;
  const collar = dog.has_collar === null ? null : t(`reportForm.collar.${dog.has_collar ? 'si' : 'no'}`);
  const facts = [
    [t('reportForm.fields.sighting_type'), t(`reportForm.sighting.${report.sighting_type}`)],
    dog.predominant_color ? [t('map.pin.color'), dog.predominant_color] : null,
    dog.size ? [t('reportForm.fields.dog_size'), t(`reportForm.dogSize.${dog.size}`, { defaultValue: dog.size })] : null,
    collar ? [t('reportForm.fields.has_collar'), collar] : null,
    ...DETAIL_KEYS.filter((key) => report.details[key] !== undefined && report.details[key] !== null && report.details[key] !== '')
      .map((key) => [t(`reportForm.fields.${key}`), detailValue(t, key, report.details[key])]),
  ].filter(Boolean);
  const level = severityLevel(report.incident_type);
  return (
    <>
    <Sheet bottomInset testID="pin-sheet" onClose={onClose} maxHeight="88%">
      <ScrollView contentContainerStyle={styles.sheetContent}>
        {uri && !photoFailed ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('map.pin.photo')} onPress={() => setViewingPhoto(true)} style={({ pressed }) => [styles.photoWrap, pressed && styles.pressed]}>
            <Image
              accessible={false}
              source={{ uri }}
              style={styles.photo}
              onError={() => setPhotoFailed(true)}
            />
            <View pointerEvents="none" style={styles.expandBadge}><Icon name="expand" size={18} color={colors.onPrimary} /></View>
          </Pressable>
        ) : null}
        <View style={styles.pinHead}>
          <View style={[styles.pinStripe, { backgroundColor: colors.severity[level] }]} />
          <View style={styles.pinHeadText}>
            <Text accessibilityRole="header" style={styles.modalTitle}>{t(`reportForm.incidents.${report.incident_type}`)}</Text>
            <Text style={styles.pinDate}>{new Date(report.occurred_at).toLocaleString('es-MX')}</Text>
          </View>
        </View>
        {report.has_flags ? (
          <View style={styles.flagNotice}><Icon name="flag" size={18} color={colors.warning} /><Text style={styles.flagText}>{t('map.pin.flagged')}</Text></View>
        ) : null}
        <View style={styles.factGrid}>
          {facts.map(([label, value]) => (
            <View key={label} style={styles.fact}>
              <Text style={styles.factLabel}>{label}</Text>
              <Text style={styles.factValue}>{value}</Text>
            </View>
          ))}
        </View>
        <AppButton title={t('map.close')} onPress={onClose} />
        <Pressable accessibilityRole="button" onPress={onFlag} style={({ pressed }) => [styles.flagLink, pressed && styles.pressed]}>
          <Icon name="flag" size={18} color={colors.danger} />
          <Text style={styles.flagLinkText}>{t('flag.open')}</Text>
        </Pressable>
      </ScrollView>
    </Sheet>
    {viewingPhoto && uri ? <PhotoViewer uri={uri} label={t('map.pin.photo')} closeLabel={t('map.close')} onClose={() => setViewingPhoto(false)} /> : null}
    </>
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
      <MapTopBar onBack={onBack} t={t} showTitle style={styles.topBarFlow} />
      <View style={styles.mapArea}>
        <ScrollView contentContainerStyle={styles.fallbackContent}>
          <View accessibilityRole="alert" testID="expo-go-notice">
            <Banner tone="warning" title={t('map.expoGo.notice')} message={t('map.expoGo.hint')} />
          </View>
          <RecentReportsList onSelect={setSelectedReport} t={t} />
        </ScrollView>
      </View>
      <SheetHost visible={Boolean(selectedReport || flagReport)} onRequestClose={() => (flagReport ? setFlagReport(null) : setSelectedReport(null))}>
        {selectedReport ? (
          <PinSheet key={`pin-${selectedReport.report_id}`} report={selectedReport} onClose={() => setSelectedReport(null)} onFlag={() => setFlagReport(selectedReport)} t={t} />
        ) : null}
        {flagReport ? <ReportFlagSheet key={`flag-${flagReport.report_id}`} report={flagReport} onClose={() => setFlagReport(null)} t={t} /> : null}
      </SheetHost>
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
  const [viewMode, setViewMode] = useState('clusters');
  const [bearing, setBearing] = useState(0);
  const mapRef = useRef(null);
  const heatmap = usePublicHeatmapReports(viewMode === 'heatmap');
  const [zoomHint, setZoomHint] = useState(false);
  const atZoomLimit = useRef(false);

  // Heatmap stops at HEATMAP_MAX_ZOOM: tell the user once per arrival how to get closer.
  const handleRegionChange = useCallback((region) => {
    map.setRegion(region);
    if (viewMode !== 'heatmap') return;
    if (region.zoom >= HEATMAP_MAX_ZOOM - 0.05) {
      if (!atZoomLimit.current) { atZoomLimit.current = true; setZoomHint(true); }
    } else if (region.zoom < HEATMAP_MAX_ZOOM - 0.5) {
      atZoomLimit.current = false;
    }
  }, [map.setRegion, viewMode]);

  useEffect(() => {
    if (!zoomHint) return undefined;
    const timer = setTimeout(() => setZoomHint(false), HEATMAP_HINT_MS);
    return () => clearTimeout(timer);
  }, [zoomHint]);

  const changeViewMode = useCallback((next) => {
    setViewMode(next);
    if (next !== 'heatmap') { setZoomHint(false); atZoomLimit.current = false; }
  }, []);

  const focusCluster = useCallback((cluster, fromZoom) => {
    setFocus({ ...cluster.approximate_location, zoom: nextBandZoom(fromZoom), padding: { bottom: CLUSTER_CARD_PADDING + insets.bottom } });
  }, [insets.bottom]);

  const selectCluster = useCallback((cluster) => {
    const zoom = map.region?.zoom ?? INITIAL_ZOOM;
    setSelectedCluster({ cluster, zoom });
    focusCluster(cluster, zoom);
  }, [focusCluster, map.region]);

  // Android back closes the sheet on top: flag form, then report detail, then the zone list.
  const closeTopSheet = useCallback(() => {
    if (flagReport) setFlagReport(null);
    else if (selectedReport) setSelectedReport(null);
    else setZoneCluster(null);
  }, [flagReport, selectedReport]);

  // Opening a report closes the cluster card so only one panel is on screen.
  const selectReport = useCallback((report) => { setSelectedCluster(null); setSelectedReport(report); }, []);

  const visibleReports = map.mode === 'pins' && map.region
    ? map.reports.filter((report) => isInViewport(report.approximate_location, map.region.viewport))
    : map.reports;

  const activePhase = viewMode === 'heatmap' ? heatmap.phase : map.phase;
  const activeRetry = viewMode === 'heatmap' ? heatmap.retry : map.retry;
  let banner = null;
  if (activePhase === 'offline') banner = { text: t('map.offline'), retry: true };
  else if (activePhase === 'error') banner = { text: t('map.error'), retry: true, danger: true };
  else if (activePhase === 'empty') banner = { text: t('map.empty') };

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        {initialCenter ? (
          <PublicMapView
            ref={mapRef}
            mode={map.mode}
            viewMode={viewMode}
            heatmapReports={heatmap.reports}
            onBearingChange={setBearing}
            clusters={map.clusters}
            reports={visibleReports}
            initialCenter={initialCenter}
            initialZoom={INITIAL_ZOOM}
            focus={focus}
            onRegionChange={handleRegionChange}
            onSelectCluster={selectCluster}
            onSelectReport={selectReport}
          />
        ) : (
          <View style={styles.centered}><ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} /></View>
        )}
      </View>
      <MapTopBar onBack={onBack} t={t} style={[styles.topBarFloat, { top: insets.top + spacing.sm }]} />
      <MapModeSwitch value={viewMode} onChange={changeViewMode} t={t} style={{ top: insets.top + spacing.sm }} />
      <MapCompass
        bearing={bearing}
        onPress={() => mapRef.current?.resetNorth?.()}
        accessibilityLabel={t('map.compass')}
        style={{ top: insets.top + spacing.sm + MODE_SWITCH_HEIGHT + spacing.sm, right: spacing.lg }}
      />
      {activePhase === 'loading' && initialCenter ? (
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
              {activePhase === 'offline' ? <Text style={styles.bannerHint}>{t('map.offlineReporting')}</Text> : null}
            </View>
            {banner.retry ? (
              <Pressable accessibilityRole="button" onPress={activeRetry} hitSlop={8} style={styles.retryButton}>
                <Text style={styles.retryText}>{t('map.retry')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
      {zoomHint ? (
        <View pointerEvents="none" accessibilityRole="alert" style={[styles.hintSlot, { bottom: insets.bottom + 44 }]}>
          <View style={styles.banner}>
            <Icon name="info" size={20} color={colors.signal} />
            <Text style={[styles.bannerTitle, styles.bannerText]}>{t('map.heatmapZoomLimit')}</Text>
          </View>
        </View>
      ) : null}
      <Text style={[styles.attribution, { bottom: insets.bottom + spacing.sm }]}>{MAP_ATTRIBUTION_TEXT}</Text>
      {selectedCluster ? (
        <ClusterModal
          cluster={selectedCluster.cluster}
          onClose={() => setSelectedCluster(null)}
          onViewReports={() => { setZoneCluster({ cluster: selectedCluster.cluster, zoom: selectedCluster.zoom }); setSelectedCluster(null); }}
          t={t}
        />
      ) : null}
      <SheetHost visible={Boolean(zoneCluster || selectedReport || flagReport)} onRequestClose={closeTopSheet}>
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
      </SheetHost>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  fallbackRoot: { flex: 1, backgroundColor: colors.background },
  topBar: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  topBarFloat: { position: 'absolute', left: spacing.lg },
  topBarFlow: { marginHorizontal: spacing.lg, marginVertical: spacing.sm },
  backCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 6 },
  topTitleShown: { fontFamily: fontFamily.display, fontSize: 24, lineHeight: 30, color: colors.primary },
  topTitleHidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  pressed: { opacity: 0.7 },
  cardSlot: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  clusterCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  cardTitle: { flex: 1, fontFamily: fontFamily.display, fontSize: 24, lineHeight: 30, color: colors.ink },
  countStrip: { gap: spacing.sm, paddingVertical: spacing.xs },
  mapArea: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modeSwitch: { position: 'absolute', right: spacing.lg, width: 46, alignItems: 'center', padding: 3, gap: 2, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.92)', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 1 }, elevation: 5 },
  modeOption: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  modeOptionSelected: { backgroundColor: colors.primary },
  loading: { position: 'absolute', alignSelf: 'center', borderRadius: radius.pill, backgroundColor: colors.surface, padding: spacing.sm },
  fallbackContent: { padding: spacing.lg, gap: spacing.xl },
  hintSlot: { position: 'absolute', left: spacing.lg, right: spacing.lg },
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
  
  countCell: { minWidth: 104, flexDirection: 'column-reverse', gap: 2, borderRadius: radius.md, backgroundColor: colors.surfaceLow, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  
  rowLabel: { fontFamily: fontFamily.label, fontSize: 13, color: colors.inkMuted },
  rowValue: { fontFamily: fontFamily.number, fontVariant: ['tabular-nums'], fontSize: 20, lineHeight: 24, color: colors.primary },
  rowValueZero: { color: colors.inkSubtle },
  
  
  
  sheetContent: { gap: spacing.md },
  pinHead: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.md },
  pinStripe: { width: 6, borderRadius: 3 },
  pinHeadText: { flex: 1, gap: 2 },
  pinDate: { ...type.caption, color: colors.inkMuted, fontVariant: ['tabular-nums'] },
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.lg, marginVertical: spacing.xs },
  fact: { flexBasis: '45%', flexGrow: 1, gap: 2 },
  factLabel: { fontFamily: fontFamily.label, fontSize: 12, color: colors.inkMuted },
  factValue: { fontFamily: fontFamily.labelMedium, fontSize: 16, lineHeight: 22, color: colors.ink },
  flagLink: { minHeight: layout.minTouch, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  flagLinkText: { fontFamily: fontFamily.label, fontSize: 15, color: colors.danger },
  flagNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.warningSoft, padding: spacing.md },
  flagText: { fontFamily: fontFamily.label, fontSize: 14, color: colors.warning, flexShrink: 1 },
  photoWrap: { borderRadius: radius.lg, overflow: 'hidden' },
  photo: { width: '100%', height: 220, backgroundColor: colors.surfaceHigh },
  expandBadge: { position: 'absolute', right: spacing.md, bottom: spacing.md, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
});
