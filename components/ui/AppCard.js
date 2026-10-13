/** @module components/ui/AppCard White card with 16 px radius and a 1 px border (DESIGN.md "Dashboard Cards"). Accepts children. */
import { StyleSheet, View } from 'react-native';
import { colors, radius, shadows, spacing } from '../../theme/index.js';

export default function AppCard({ children, tone = 'default', style, testID }) {
  return (
    <View testID={testID} style={[styles.base, tone === 'soft' && styles.soft, tone === 'default' && shadows.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  soft: { backgroundColor: colors.primarySoft, borderColor: colors.outlineSoft },
});
