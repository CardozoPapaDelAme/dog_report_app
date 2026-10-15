/**
 * @module components/PublicMapView
 * Presentational native public map (MapLibre): server clusters or report pins, colored by severity.
 * The web build uses `components/PublicMapView.web.js` with the same props.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Camera, GeoJSONSource, Layer, Map, ViewAnnotation } from '@maplibre/maplibre-react-native';

import { INCIDENT_TYPES, clusterRadiusPx, clustersToHeatmapGeoJSON, severityLevel } from '../models/publicMap.js';
import { colors, fontFamily } from '../theme/index.js';
import { PinGlyph } from './ui/index.js';
import { getMapStyleUrl } from '../services/mapConfig.js';

// MapLibre React Native v11: Map + Camera + ViewAnnotation.
// Renders exactly what the server returned; no client-side clustering.
/**
 * @param {object} props
 * @param {'clusters' | 'pins'} props.mode
 * @param {'clusters' | 'heatmap'} [props.viewMode] - `heatmap` draws a weighted density layer instead of cluster markers (pins unchanged).
 * @param {(bearing: number) => void} [props.onBearingChange] - Map rotation in degrees; 0 is north.
 * Ref handle: `resetNorth()` eases the camera back to north.
 * @param {import('../models/publicMap.js').MapCluster[]} props.clusters - Rendered in `clusters` mode.
 * @param {import('../models/publicMap.js').PublicReport[]} props.reports - Rendered in `pins` mode.
 * @param {{longitude: number, latitude: number}} props.initialCenter
 * @param {number} props.initialZoom
 * @param {{longitude: number, latitude: number, zoom: number} | null} [props.focus] - A new object eases the camera.
 * @param {(region: {zoom: number, bounds: number[]}) => void} [props.onRegionChange] - Called after load and each move.
 * @param {(cluster: import('../models/publicMap.js').MapCluster) => void} [props.onSelectCluster]
 * @param {(report: import('../models/publicMap.js').PublicReport) => void} [props.onSelectReport]
 * @returns {JSX.Element}
 */
const HEATMAP_PAINT = {
  'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 1, 0.25, 20, 1],
  'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 16, 2],
  'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 18, 14, 36, 17, 56],
  'heatmap-opacity': 0.85,
  'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
    0, 'rgba(46,125,50,0)', 0.25, colors.severity.low, 0.5, colors.signal, 0.75, colors.severity.medium, 1, colors.severity.high],
};

const PublicMapView = forwardRef(function PublicMapView({
  mode,
  viewMode = 'clusters',
  onBearingChange,
  clusters,
  reports,
  initialCenter,
  initialZoom,
  focus,
  onRegionChange,
  onSelectCluster,
  onSelectReport,
}, ref) {
  const { t } = useTranslation();
  const mapRef = useRef(null);
  const cameraRef = useRef(null);

  const heatmapData = useMemo(() => clustersToHeatmapGeoJSON(clusters), [clusters]);
  const heatmap = viewMode === 'heatmap' && mode === 'clusters';

  useImperativeHandle(ref, () => ({
    resetNorth: () => cameraRef.current?.easeTo({ bearing: 0, duration: 400 }),
  }), []);

  const emit = useCallback((view) => {
    if (view && Array.isArray(view.bounds)) onRegionChange?.({ zoom: view.zoom, bounds: view.bounds });
    if (view && Number.isFinite(view.bearing)) onBearingChange?.(view.bearing);
  }, [onRegionChange, onBearingChange]);

  // Programmatic zoom requests (cluster expansion) arrive as a new `focus` object.
  useEffect(() => {
    if (!focus) return;
    cameraRef.current?.easeTo({ center: [focus.longitude, focus.latitude], zoom: focus.zoom, duration: 600, ...(focus.padding ? { padding: focus.padding } : {}) });
  }, [focus]);

  return (
    <Map
      ref={mapRef}
      style={styles.map}
      mapStyle={getMapStyleUrl()}
      attribution
      onDidFinishLoadingMap={() => { mapRef.current?.getViewState().then(emit).catch(() => {}); }}
      onRegionIsChanging={(event) => { const b = event.nativeEvent?.bearing; if (Number.isFinite(b)) onBearingChange?.(b); }}
      onRegionDidChange={(event) => emit(event.nativeEvent)}
    >
      <Camera
        ref={cameraRef}
        initialViewState={{ center: [initialCenter.longitude, initialCenter.latitude], zoom: initialZoom }}
      />
      {heatmap ? (
        <GeoJSONSource id="heatmap-source" data={heatmapData}>
          <Layer type="heatmap" id="heatmap-layer" paint={HEATMAP_PAINT} />
        </GeoJSONSource>
      ) : null}
      {mode === 'clusters' && !heatmap ? clusters.map((cluster) => {
        const radius = clusterRadiusPx(cluster.report_count);
        const { longitude, latitude } = cluster.approximate_location;
        return (
          <ViewAnnotation
            key={cluster.cluster_id}
            id={`cluster-${cluster.cluster_id}`}
            lngLat={[longitude, latitude]}
            onPress={() => onSelectCluster?.(cluster)}
          >
            <View style={[styles.halo, { width: radius * 2 + 14, height: radius * 2 + 14, borderRadius: radius + 7, backgroundColor: `${colors.severity[severityLevel(cluster.highest_severity)]}33` }]}>
              <View
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('map.clusterItem', {
                  count: cluster.report_count,
                  severity: t(`map.severity.${severityLevel(cluster.highest_severity)}`),
                })}
                style={[styles.cluster, {
                  width: radius * 2, height: radius * 2, borderRadius: radius,
                  backgroundColor: colors.severity[severityLevel(cluster.highest_severity)],
                }]}
              >
                <Text style={styles.clusterText}>{cluster.report_count}</Text>
              </View>
            </View>
          </ViewAnnotation>
        );
      }) : null}
      {mode === 'pins' ? reports.map((report) => {
        const { longitude, latitude } = report.approximate_location;
        return (
          <ViewAnnotation
            key={report.report_id}
            id={`pin-${report.report_id}`}
            anchor="bottom"
            lngLat={[longitude, latitude]}
            onPress={() => onSelectReport?.(report)}
          >
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('map.pinItem', { type: t(`reportForm.incidents.${INCIDENT_TYPES.includes(report.incident_type) ? report.incident_type : 'otro'}`) })}
              style={styles.pinWrap}
            >
              <PinGlyph color={colors.severity[severityLevel(report.incident_type)]} flagged={Boolean(report.has_flags)} />
            </View>
          </ViewAnnotation>
        );
      }) : null}
    </Map>
  );
});

export default PublicMapView;

const styles = StyleSheet.create({
  map: { flex: 1 },
  halo: { alignItems: 'center', justifyContent: 'center' },
  cluster: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  clusterText: { color: '#ffffff', fontFamily: fontFamily.number, fontVariant: ['tabular-nums'], fontSize: 15 },
  pinWrap: { alignItems: 'center' },
});
