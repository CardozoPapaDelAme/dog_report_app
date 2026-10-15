/**
 * @module components/ui/Scrim
 * Soft tinted gradient over media (camera, maps) drawn with react-native-svg, so it needs no extra native
 * module. `edge="top"` is darkest at the top; `edge="bottom"` is darkest at the bottom.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export default function Scrim({ edge = 'top', height = 140, strength = 0.6, tint = '#021a06', style }) {
  const id = `scrim-${edge}`;
  const stops = edge === 'top'
    ? [[0, strength], [0.55, strength * 0.35], [1, 0]]
    : [[0, 0], [0.45, strength * 0.35], [1, strength]];
  return (
    <View pointerEvents="none" accessible={false} aria-hidden importantForAccessibility="no" style={[styles.base, edge === 'top' ? styles.top : styles.bottom, { height }, style]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            {stops.map(([offset, opacity]) => <Stop key={offset} offset={offset} stopColor={tint} stopOpacity={opacity} />)}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { position: 'absolute', left: 0, right: 0 },
  top: { top: 0 },
  bottom: { bottom: 0 },
});
