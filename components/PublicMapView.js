/**
 * @module components/PublicMapView
 * Presentational native public map (MapLibre): server clusters or report pins, colored by severity.
 * The web build uses `components/PublicMapView.web.js` with the same props.
 */
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Camera, Map, ViewAnnotation } from '@maplibre/maplibre-react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { INCIDENT_TYPES, clusterRadiusPx, severityLevel } from '../models/publicMap.js';
import { colors, fontFamily } from '../theme/index.js';
import { Icon } from './ui/index.js';
import { getMapStyleUrl } from '../services/mapConfig.js';

/** Teardrop outline of the pin (one closed shape, so the white outline runs around the whole silhouette). */
const PIN_PATH = 'M24 3 C12.5 3 4 11.6 4 22.6 C4 37 24 57 24 57 C24 57 44 37 44 22.6 C44 11.6 35.5 3 24 3 Z';

/** A single-silhouette map pin: colored drop with a white outline and offset shadow, paw inside, amber badge when flagged. */
function PinMarker({ color, flagged }) {
  return (
    <View style={styles.pin}>
      <Svg width={48} height={62} viewBox="0 0 48 62" accessible={false} aria-hidden>
        <Path d={PIN_PATH} fill="rgba(0,0,0,0.28)" transform="translate(0 3)" />
        <Path d={PIN_PATH} fill={color} stroke="#ffffff" strokeWidth={3} strokeLinejoin="round" />
        {flagged ? <Circle cx={40} cy={9} r={7} fill="#ffa000" stroke="#ffffff" strokeWidth={2.5} /> : null}
      </Svg>
      <View pointerEvents="none" style={styles.pinPaw}><Icon name="dog" size={24} color={colors.onPrimary} strokeWidth={2.2} /></View>
    </View>
  );
}

// MapLibre React Native v11: Map + Camera + ViewAnnotation.
// Renders exactly what the server returned; no client-side clustering.
/**
 * @param {object} props
 * @param {'clusters' | 'pins'} props.mode
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
export default function PublicMapView({
  mode,
  clusters,
  reports,
  initialCenter,
  initialZoom,
  focus,
  onRegionChange,
  onSelectCluster,
  onSelectReport,
}) {
  const { t } = useTranslation();
  const mapRef = useRef(null);
  const cameraRef = useRef(null);

  const emit = useCallback((view) => {
    if (view && Array.isArray(view.bounds)) onRegionChange?.({ zoom: view.zoom, bounds: view.bounds });
  }, [onRegionChange]);

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
      onRegionDidChange={(event) => emit(event.nativeEvent)}
    >
      <Camera
        ref={cameraRef}
        initialViewState={{ center: [initialCenter.longitude, initialCenter.latitude], zoom: initialZoom }}
      />
      {mode === 'clusters' ? clusters.map((cluster) => {
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
              <PinMarker color={colors.severity[severityLevel(report.incident_type)]} flagged={Boolean(report.has_flags)} />
            </View>
          </ViewAnnotation>
        );
      }) : null}
    </Map>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  halo: { alignItems: 'center', justifyContent: 'center' },
  cluster: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  clusterText: { color: '#ffffff', fontFamily: fontFamily.number, fontVariant: ['tabular-nums'], fontSize: 15 },
  pinWrap: { alignItems: 'center' },
  pin: { width: 48, height: 62 },
  pinPaw: { position: 'absolute', left: 12, top: 11 },
});
