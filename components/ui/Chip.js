/**
 * @module components/ui/Chip
 * Small label (status, incident type, metadata). `attack` is the only tone using danger-alert with white text.
 * Pass `onPress` to make it a selectable choice (role button, `selected` state, 44 pt target).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radius, spacing, type } from '../../theme/index.js';

const tones = {
  neutral: { bg: colors.surfaceContainer, fg: colors.inkMuted },
  success: { bg: colors.primarySoft, fg: colors.onPrimarySoft },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.onDangerSoft },
  attack: { bg: colors.dangerAlert, fg: colors.onPrimary },
  info: { bg: colors.infoSoft, fg: colors.info },
};

export default function Chip({ label, tone = 'neutral', onPress, selected = false, accessibilityLabel, style, testID }) {
  const { bg, fg } = tones[tone];
  const text = <Text style={[type.label, { color: fg }]}>{label}</Text>;
  if (!onPress) {
    return <View testID={testID} style={[styles.chip, { backgroundColor: bg }, style]}>{text}</View>;
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      aria-pressed={selected}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, styles.choice, { backgroundColor: selected ? colors.primarySoft : colors.surface, borderColor: selected ? colors.primary : colors.outlineSoft, borderWidth: 1 }, pressed && { opacity: 0.8 }, style]}
    >
      <Text style={[type.label, { color: selected ? colors.onPrimarySoft : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  choice: { minHeight: layout.minTouch, justifyContent: 'center', alignItems: 'center' },
});
