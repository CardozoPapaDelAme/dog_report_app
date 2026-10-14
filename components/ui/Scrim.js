/**
 * @module components/ui/Scrim
 * Dark gradient over media (camera, maps) built from stacked translucent strips, so it needs no native module.
 * `edge="top"` is darkest at the top; `edge="bottom"` is darkest at the bottom.
 */
import { StyleSheet, View } from 'react-native';

const STEPS = 10;

export default function Scrim({ edge = 'top', height = 140, strength = 0.6, style }) {
  const strips = Array.from({ length: STEPS }, (_, i) => {
    const t = 1 - i / (STEPS - 1);
    return strength * t * t;
  });
  const ordered = edge === 'top' ? strips : [...strips].reverse();
  return (
    <View pointerEvents="none" accessible={false} aria-hidden importantForAccessibility="no" style={[styles.base, edge === 'top' ? styles.top : styles.bottom, { height }, style]}>
      {ordered.map((opacity, i) => <View key={i} style={{ flex: 1, backgroundColor: `rgba(0,0,0,${opacity.toFixed(3)})` }} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { position: 'absolute', left: 0, right: 0 },
  top: { top: 0 },
  bottom: { bottom: 0 },
});
