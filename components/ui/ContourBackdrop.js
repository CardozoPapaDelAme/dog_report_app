/**
 * @module components/ui/ContourBackdrop
 * Topographic contour lines (the sierra around Creel) drawn as an absolute, non-interactive background.
 * Generated from a fixed seed so the terrain is identical on every render; every fifth ring is an index contour.
 */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const SIZE = 400;

function ring(cx, cy, radius, seed) {
  const points = [];
  for (let i = 0; i <= 120; i += 1) {
    const a = (i / 120) * Math.PI * 2;
    const wobble = 1 + 0.1 * Math.sin(3 * a + seed) + 0.06 * Math.sin(5 * a + seed * 1.7) + 0.035 * Math.sin(9 * a + seed * 0.6);
    points.push(`${(cx + Math.cos(a) * radius * wobble).toFixed(1)} ${(cy + Math.sin(a) * radius * wobble * 0.86).toFixed(1)}`);
  }
  return `M${points.join('L')}Z`;
}

const rings = Array.from({ length: 22 }, (_, i) => ({ d: ring(330, 90, 30 + i * 26, 1.3 + i * 0.045), index: i % 5 === 4 }));

function ContourBackdrop({ color = '#91d78a', style }) {
  return (
    <Svg
      pointerEvents="none"
      accessible={false}
      aria-hidden
      importantForAccessibility="no"
      viewBox={`0 0 ${SIZE} ${SIZE * 2}`}
      preserveAspectRatio="xMaxYMin slice"
      style={[StyleSheet.absoluteFill, style]}
    >
      {rings.map((r, i) => (
        <Path key={i} d={r.d} fill="none" stroke={color} strokeOpacity={r.index ? 0.32 : 0.15} strokeWidth={r.index ? 1.6 : 1} />
      ))}
    </Svg>
  );
}

export default memo(ContourBackdrop);
