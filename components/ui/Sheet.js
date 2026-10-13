/**
 * @module components/ui/Sheet
 * Bottom sheet over a dismissable backdrop. The backdrop is hidden from accessibility so it never adds a
 * second "Close" button; the sheet's own close control remains the accessible one. `keyboardAware` wraps
 * the sheet in KeyboardAvoidingView (iOS `padding`, matching the rest of the app).
 */
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, shadows, spacing } from '../../theme/index.js';

export default function Sheet({ children, onClose, dismissable = true, keyboardAware = false, maxHeight = '90%', style, testID }) {
  const Root = keyboardAware ? KeyboardAvoidingView : View;
  const rootProps = keyboardAware ? { behavior: Platform.OS === 'ios' ? 'padding' : undefined } : {};
  return (
    <Root pointerEvents="box-none" style={styles.overlay} {...rootProps}>
      <Pressable accessible={false} aria-hidden importantForAccessibility="no" onPress={dismissable ? onClose : undefined} style={StyleSheet.absoluteFill} />
      <View testID={testID} style={[styles.sheet, { maxHeight }, style]}>
        {children}
      </View>
    </Root>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, gap: spacing.md, ...shadows.overlay },
});
