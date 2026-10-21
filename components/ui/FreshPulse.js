/**
 * @module components/ui/FreshPulse
 * Expanding rings that call attention to a map marker that has just appeared. The rings live inside a fixed square
 * so the marker keeps its anchor; with Reduce Motion a single static ring is shown instead.
 */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

const RINGS = 3;
const RING_GAP_MS = 450;
const RING_MS = 1300;
/** Times the ring sequence plays before stopping. */
const CYCLES = 3;

/**
 * @param {object} props
 * @param {number} props.size - Diameter of the marker the rings start from.
 * @param {number} props.pad - Extra space on each side; the rings grow until they fill it.
 * @param {string} props.color - Ring color.
 * @param {import('react').ReactNode} props.children - The marker, centered in the square.
 * @returns {JSX.Element}
 */
export default function FreshPulse({ size, pad, color, children }) {
  const box = size + pad * 2;
  const rings = useRef(Array.from({ length: RINGS }, () => new Animated.Value(0))).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let animation = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled) return;
      if (reduce) { setReduceMotion(true); return; }
      const wave = Animated.stagger(RING_GAP_MS, rings.map((ring) => Animated.timing(ring, {
        toValue: 1, duration: RING_MS, easing: Easing.out(Easing.quad), useNativeDriver: true,
      })));
      const reset = Animated.parallel(rings.map((ring) => Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: true })));
      animation = Animated.loop(Animated.sequence([wave, reset]), { iterations: CYCLES });
      animation.start();
    });
    return () => { cancelled = true; animation?.stop(); };
  }, [rings]);

  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      {reduceMotion ? (
        <View pointerEvents="none" style={[styles.ring, { width: size + pad, height: size + pad, borderRadius: (size + pad) / 2, borderColor: color }]} />
      ) : rings.map((ring, index) => (
        <Animated.View
          key={index}
          pointerEvents="none"
          style={[styles.ring, {
            width: size, height: size, borderRadius: size / 2, borderColor: color,
            opacity: ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.95, 0] }),
            transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, box / size] }) }],
          }]}
        />
      ))}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 4 },
});
