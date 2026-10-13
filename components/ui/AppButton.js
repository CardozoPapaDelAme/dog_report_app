/**
 * @module components/ui/AppButton
 * Shared button: variants primary/secondary/ghost/destructive, sizes md/lg, pressed/disabled/loading states.
 * Loading and disabled block presses immediately (the double-tap guard the screens rely on).
 */
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, layout, radius, spacing, type } from '../../theme/index.js';

const variants = {
  primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
  secondary: { bg: colors.surface, fg: colors.primary, border: colors.outlineSoft },
  ghost: { bg: colors.transparent, fg: colors.primary, border: colors.transparent },
  glass: { bg: 'rgba(255,255,255,0.14)', fg: colors.onPrimary, border: 'rgba(255,255,255,0.45)' },
  destructive: { bg: colors.surface, fg: colors.danger, border: colors.danger },
};

/**
 * @param {object} props
 * @param {string} props.title - Visible label; also the accessibility name unless `accessibilityLabel` is set.
 * @param {() => void} [props.onPress]
 * @param {'primary'|'secondary'|'ghost'|'destructive'|'glass'} [props.variant]
 * @param {'md'|'lg'} [props.size]
 * @param {boolean} [props.loading]
 * @param {boolean} [props.disabled]
 */
export default function AppButton({ title, onPress, variant = 'primary', size = 'md', loading = false, disabled = false, accessibilityLabel, style, testID, nativeID }) {
  const tone = variants[variant];
  const blocked = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={onPress}
      testID={testID}
      nativeID={nativeID}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' && styles.large,
        { backgroundColor: tone.bg, borderColor: tone.border },
        pressed && styles.pressed,
        blocked && styles.disabled,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={tone.fg} /> : <Text style={[type.button, { color: tone.fg }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: layout.minTouch, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  large: { minHeight: 52 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
});
