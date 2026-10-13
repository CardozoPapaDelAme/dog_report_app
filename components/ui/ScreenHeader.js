/** @module components/ui/ScreenHeader Title row with an optional leading action (back/close) and trailing slot. */
import { StyleSheet, Text, View } from 'react-native';
import { layout, spacing, type } from '../../theme/index.js';
import IconButton from './IconButton.js';

export default function ScreenHeader({ title, onBack, backLabel, backIcon = 'back', trailing, style }) {
  return (
    <View style={[styles.row, style]}>
      {onBack ? <IconButton icon={backIcon} accessibilityLabel={backLabel} onPress={onBack} /> : <View style={styles.spacer} />}
      <Text accessibilityRole="header" style={[type.title, styles.title]} numberOfLines={2}>{title}</Text>
      {trailing ?? <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: layout.gutter },
  title: { flex: 1, textAlign: 'center' },
  spacer: { width: layout.minTouch },
});
