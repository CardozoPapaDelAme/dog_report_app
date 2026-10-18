/**
 * @module components/ui/FadeIn
 * Fades and scales its children in once when mounted, so map markers appear softly instead of popping in.
 * Skips the animation when the system asks to reduce motion.
 */
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { motion } from '../../theme/index.js';

const START_SCALE = 0.6;

/**
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {number} [props.duration=motion.base] - Animation length in milliseconds.
 * @returns {JSX.Element}
 */
export default function FadeIn({ children, duration = motion.base }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    let animation = null;
    const run = (reduce) => {
      if (cancelled) return;
      if (reduce) { progress.setValue(1); return; }
      animation = Animated.timing(progress, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true });
      animation.start();
    };
    AccessibilityInfo.isReduceMotionEnabled().then(run, () => run(false));
    return () => { cancelled = true; animation?.stop(); };
  }, [progress, duration]);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [START_SCALE, 1] });
  return <Animated.View style={{ opacity: progress, transform: [{ scale }] }}>{children}</Animated.View>;
}
