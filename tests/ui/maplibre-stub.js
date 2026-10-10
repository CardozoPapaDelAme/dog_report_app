// UI-test stand-in for @maplibre/maplibre-react-native. The browser has no native
// map, so Map and ViewAnnotation render their children as plain views. This lets
// the fixture render components/PublicMapView.js (the device implementation) and
// measure the cluster markers it builds. Tiles, projection and gestures are not
// simulated.
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

export function ViewAnnotation({ id, onPress, children }) {
  return (
    <Pressable accessible={false} testID={id} onPress={onPress} style={{ alignSelf: 'flex-start', margin: 4 }}>
      {children}
    </Pressable>
  );
}
