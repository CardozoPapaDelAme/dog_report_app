import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Camera, Map, ViewAnnotation } from '@maplibre/maplibre-react-native';

import { clusterRadiusPx, severityColor } from '../models/publicMap.js';
import { getMapStyleUrl } from '../services/mapConfig.js';

// MapLibre React Native v11: Map + Camera + ViewAnnotation.
// Renders exactly what the server returned; no client-side clustering.
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
  const mapRef = useRef(null);
  const cameraRef = useRef(null);

  const emit = useCallback((view) => {
    if (view && Array.isArray(view.bounds)) onRegionChange?.({ zoom: view.zoom, bounds: view.bounds });
  }, [onRegionChange]);

  // Programmatic zoom requests (cluster expansion) arrive as a new `focus` object.
  useEffect(() => {
    if (!focus) return;
    cameraRef.current?.easeTo({ center: [focus.longitude, focus.latitude], zoom: focus.zoom, duration: 500 });
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
            <View
              accessibilityLabel={`${cluster.report_count}`}
              style={[styles.cluster, {
                width: radius * 2, height: radius * 2, borderRadius: radius,
                backgroundColor: severityColor(cluster.highest_severity),
              }]}
            >
              <Text style={styles.clusterText}>{cluster.report_count}</Text>
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
            <View style={styles.pinWrap}>
              <View style={[styles.pinHead, { backgroundColor: severityColor(report.incident_type) }]}>
                <View style={styles.pinDot} />
              </View>
              <View style={[styles.pinTip, { borderTopColor: severityColor(report.incident_type) }]} />
            </View>
          </ViewAnnotation>
        );
      }) : null}
    </Map>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  cluster: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff', opacity: 0.92 },
  clusterText: { color: '#ffffff', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  pinWrap: { alignItems: 'center' },
  pinHead: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  pinDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ffffff' },
  pinTip: { width: 0, height: 0, marginTop: -2, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
});
