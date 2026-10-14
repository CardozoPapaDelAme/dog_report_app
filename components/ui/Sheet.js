/**
 * @module components/ui/Sheet
 * Bottom sheet over a dismissable, dimmed backdrop. The backdrop fades in and the sheet rises (both skipped
 * when the user asks for reduced motion). The backdrop is hidden from screen readers so it never adds a second
 * "Close" button; the sheet's own controls and the system back gesture close it. `keyboardAware` wraps the
 * sheet in KeyboardAvoidingView (iOS `padding`, matching the rest of the app).
 *
 * By default the sheet is drawn inside the current screen. `modal` draws it in the system window instead,
 * which always covers the whole screen whatever the size of the parent layout.
 */
import { useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, KeyboardAvoidingView, Modal, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { colors, motion, radius, shadows, spacing } from '../../theme/index.js';

/** The sheet itself; its animation starts when it mounts, so it must mount together with its content. */
function SheetBody({ children, onClose, dismissable, dim, keyboardAware, modal, bottomInset, maxHeight, style, testID }) {
  // Tolerant read: a sheet outside a SafeAreaProvider (tests, previews) simply has no bottom inset.
  const insets = useContext(SafeAreaInsetsContext) ?? { bottom: 0 };
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    const run = (reduced) => {
      if (cancelled) return;
      if (reduced) progress.setValue(1);
      else Animated.timing(progress, { toValue: 1, duration: motion.base, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    };
    AccessibilityInfo.isReduceMotionEnabled().then(run, () => run(false));
    return () => { cancelled = true; progress.stopAnimation(); };
  }, [progress]);

  const Root = keyboardAware ? KeyboardAvoidingView : View;
  const rootProps = keyboardAware ? { behavior: Platform.OS === 'ios' ? 'padding' : undefined } : {};
  return (
    <Root pointerEvents="box-none" style={modal ? styles.overlayModal : styles.overlay} {...rootProps}>
      {/* The dimmed backdrop is also the dismiss area: one visible view that receives the tap. `collapsable={false}`
          keeps native from flattening it away, which would leave nothing to touch. */}
      <Animated.View
        accessible={false}
        collapsable={false}
        style={[StyleSheet.absoluteFill, { backgroundColor: dim ? colors.scrim : 'rgba(0,0,0,0.01)', opacity: progress }]}
        onStartShouldSetResponder={() => dismissable}
        onResponderRelease={() => { if (dismissable) onClose?.(); }}
      />
      <Animated.View
        testID={testID}
        style={[styles.sheet, bottomInset && { paddingBottom: spacing.xl + insets.bottom }, { maxHeight }, { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [260, 0] }) }] }, style]}
      >
        {children}
      </Animated.View>
    </Root>
  );
}

export default function Sheet({ children, onClose, dismissable = true, dim = true, keyboardAware = false, modal = false, bottomInset = false, maxHeight = '90%', style, testID }) {
  // The system modal is switched on after the first render (react-native-web drops a modal that mounts already visible).
  const [shown, setShown] = useState(!modal);
  useEffect(() => { if (modal) setShown(true); }, [modal]);
  const body = (
    <SheetBody onClose={onClose} dismissable={dismissable} dim={dim} keyboardAware={keyboardAware} modal={modal} bottomInset={bottomInset} maxHeight={maxHeight} style={style} testID={testID}>
      {children}
    </SheetBody>
  );
  return modal
    ? <Modal transparent visible={shown} animationType="none" statusBarTranslucent onRequestClose={dismissable ? onClose : undefined}>{shown ? body : null}</Modal>
    : body;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  overlayModal: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, gap: spacing.md, ...shadows.overlay },
});
