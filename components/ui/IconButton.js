/** @module components/ui/IconButton Icon-only button with a 44 pt target; `accessibilityLabel` is required. */
import { Pressable, StyleSheet } from 'react-native';
import { colors, layout, radius } from '../../theme/index.js';
import Icon from './Icon.js';

export default function IconButton({ icon, accessibilityLabel, onPress, disabled = false, tone = 'default', style, testID }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      hitSlop={4}
      style={({ pressed }) => [styles.base, tone === 'glass' && styles.glass, pressed && styles.pressed, disabled && styles.disabled, style]}
    >
      <Icon name={icon} color={tone === 'glass' ? colors.onGlass : colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { width: layout.minTouch, height: layout.minTouch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  glass: { backgroundColor: colors.glass },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
