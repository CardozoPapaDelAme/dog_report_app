/**
 * @module components/ui/MapCompass
 * Floating compass for the map: fades in only while the map is rotated away from north and fades out
 * once it is north again. The needle counter-rotates with the map; tapping asks for north.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { colors, layout, motion, radius } from '../../theme/index.js';
import Icon from './Icon.js';

/** Degrees from north below which the compass hides (and above which it shows). */
const SHOW_DEGREES = 1;

/** Smallest absolute angle from north, 0–180. */
function offNorth(bearing) {
  const wrapped = ((bearing % 360) + 360) % 360;
  return Math.min(wrapped, 360 - wrapped);
}

/**
 * @param {object} props
 * @param {number} props.bearing - Map rotation in degrees (0 = north).
 * @param {() => void} props.onPress - Resets the map to north.
 * @param {string} props.accessibilityLabel
 * @param {object} [props.style] - Positioning from the screen.
 */
export default function MapCompass({ bearing, onPress, accessibilityLabel, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const rotated = offNorth(bearing) > SHOW_DEGREES;

  useEffect(() => {
    if (rotated) setMounted(true);
    Animated.timing(opacity, {
      toValue: rotated ? 1 : 0,
      duration: motion.base,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => { if (finished && !rotated) setMounted(false); });
  }, [rotated, opacity]);

  if (!mounted) return null;
  return (
    <Animated.View pointerEvents={rotated ? 'auto' : 'none'} style={[styles.wrap, style, { opacity }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        hitSlop={4}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Animated.View style={{ transform: [{ rotate: `${-bearing}deg` }] }}>
          <Icon name="compass" size={26} color={colors.primary} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  button: { width: layout.minTouch + 4, height: layout.minTouch + 4, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 6 },
  pressed: { opacity: 0.7 },
});
