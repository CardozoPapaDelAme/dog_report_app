// UI-test stand-in for @maplibre/maplibre-react-native. The browser has no native
// map, so Map and ViewAnnotation render their children as plain views. This lets
// the fixture render components/PublicMapView.js (the device implementation) and
// measure the cluster markers it builds. Tiles, projection and gestures are not
// simulated; GeoJSONSource/Layer only mount.
import { forwardRef, useImperativeHandle } from 'react';
import { Pressable, View } from 'react-native';

export const Map = forwardRef(function Map({ children, style }, ref) {
  useImperativeHandle(ref, () => ({ getViewState: () => Promise.resolve(null) }), []);
  return <View style={style} testID="maplibre-stub">{children}</View>;
});

export const Camera = forwardRef(function Camera(_props, ref) {
  useImperativeHandle(ref, () => ({ easeTo() {} }), []);
  return null;
});

// Heatmap layers have no DOM equivalent; they only need to mount without error.
export function GeoJSONSource({ children }) { return <View testID="heatmap-source-stub">{children}</View>; }
export function Layer({ id }) { return <View testID={id} />; }

export function ViewAnnotation({ id, onPress, children }) {
  return (
    <Pressable accessible={false} testID={id} onPress={onPress} style={{ alignSelf: 'flex-start', margin: 4 }}>
      {children}
    </Pressable>
  );
}
