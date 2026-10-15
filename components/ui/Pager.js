/**
 * @module components/ui/Pager
 * Previous / next control with a "page x of y" label. Renders nothing when everything fits in one page.
 * Labels come from the caller so each screen keeps its own i18n keys.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, layout, radius, spacing } from '../../theme/index.js';
import Icon from './Icon.js';

export default function Pager({ page, pageCount, onChange, previousLabel, nextLabel, pageLabel, style }) {
  if (pageCount <= 1) return null;
  const atStart = page <= 0;
  const atEnd = page >= pageCount - 1;
  return (
    <View style={[styles.row, style]}>
      <Pressable accessibilityRole="button" accessibilityLabel={previousLabel} accessibilityState={{ disabled: atStart }} disabled={atStart} onPress={() => onChange(page - 1)} style={[styles.button, atStart && styles.dim]}>
        <Icon name="back" size={20} color={colors.primary} />
      </Pressable>
      <Text accessibilityLiveRegion="polite" style={styles.label}>{pageLabel}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={nextLabel} accessibilityState={{ disabled: atEnd }} disabled={atEnd} onPress={() => onChange(page + 1)} style={[styles.button, atEnd && styles.dim]}>
        <Icon name="forward" size={20} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  button: { width: layout.minTouch, height: layout.minTouch, borderRadius: radius.md, borderWidth: 1, borderColor: colors.outlineSoft, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fontFamily.label, fontVariant: ['tabular-nums'], fontSize: 14, color: colors.inkMuted, minWidth: 120, textAlign: 'center' },
  dim: { opacity: 0.4 },
});
