/**
 * @module components/ui/Sheet
 * Bottom sheet over a dismissable, dimmed backdrop, drawn inside the screen (not in a system modal, so there
 * is no sliding black box). The backdrop fades in and the sheet rises; both are skipped when the user asks for
 * reduced motion. The backdrop is hidden from accessibility so it never adds a second "Close" button; the
 * sheet's own close control remains the accessible one. `keyboardAware` wraps the sheet in
 * KeyboardAvoidingView (iOS `padding`, matching the rest of the app).
 */
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { colors, motion, radius, shadows, spacing } from '../../theme/index.js';

export default function Sheet({ children, onClose, dismissable = true, dim = true, keyboardAware = false, maxHeight = '90%', style, testID }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    const run = (reduced) => {
      if (cancelled) return;
      if (reduced) progress.setValue(1);
      else Animated.timing(progress, { toValue: 1, duration: motion.base, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    };
    AccessibilityInfo.isReduceMotionEnabled().then(run, () => run(false));
    return () => { cancelled = true; };
  }, [progress]);

  const Root = keyboardAware ? KeyboardAvoidingView : View;
  const rootProps = keyboardAware ? { behavior: Platform.OS === 'ios' ? 'padding' : undefined } : {};
  return (
    <Root pointerEvents="box-none" style={styles.overlay} {...rootProps}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: dim ? colors.scrim : 'transparent', opacity: progress }]} />
      <Pressable accessible={false} aria-hidden importantForAccessibility="no" onPress={dismissable ? onClose : undefined} style={StyleSheet.absoluteFill} />
      <Animated.View
        testID={testID}
        style={[styles.sheet, { maxHeight }, { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [260, 0] }) }] }, style]}
      >
        {children}
      </Animated.View>
    </Root>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, gap: spacing.md, ...shadows.overlay },
});
