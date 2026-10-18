/**
 * @module components/ui/FadeIn
 * Pops its children in once: fade plus a slightly overshooting scale, optionally staggered by `delay`.
 * The animation starts when the view is first laid out (map annotations attach to the native map after
 * mounting, so starting on mount could finish before the marker is visible), with a timer as fallback.
 * Skips the animation when the system asks to reduce motion.
 */
import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

const START_SCALE = 0.3;
const DEFAULT_DURATION = 450;
/** Starts anyway if the view never reports a layout. */
const FALLBACK_MS = 400;

/**
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {number} [props.delay=0] - Milliseconds to wait before starting, to stagger siblings.
 * @param {number} [props.duration=450] - Animation length in milliseconds.
 * @returns {JSX.Element}
 */
export default function FadeIn({ children, delay = 0, duration = DEFAULT_DURATION }) {
  const progress = useRef(new Animated.Value(0)).current;
  const started = useRef(false);
  const animation = useRef(null);
  const fallback = useRef(null);

  const start = useCallback(() => {
    if (started.current) return;
    started.current = true;
    clearTimeout(fallback.current);
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (reduce) { progress.setValue(1); return; }
      animation.current = Animated.timing(progress, {
        toValue: 1, duration, delay, easing: Easing.out(Easing.back(1.7)), useNativeDriver: true,
      });
      animation.current.start();
    });
  }, [progress, duration, delay]);

  useEffect(() => {
    fallback.current = setTimeout(start, FALLBACK_MS);
    return () => { clearTimeout(fallback.current); animation.current?.stop(); };
  }, [start]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [START_SCALE, 1] });
  const opacity = progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' });
  return <Animated.View onLayout={start} style={{ opacity, transform: [{ scale }] }}>{children}</Animated.View>;
}
