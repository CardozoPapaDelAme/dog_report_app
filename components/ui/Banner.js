/**
 * @module components/ui/Banner
 * Inline message with an icon: info / warning / error / success. Accepts children for extra content
 * (actions, hints) so callers keep their own copy and roles.
 */
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '../../theme/index.js';
import Icon from './Icon.js';

const tones = {
  info: { bg: colors.infoSoft, fg: colors.info, border: colors.info, icon: 'info' },
  warning: { bg: colors.warningSoft, fg: colors.warning, border: colors.warningAmber, icon: 'alert' },
  error: { bg: colors.dangerSoft, fg: colors.onDangerSoft, border: colors.danger, icon: 'alert' },
  success: { bg: colors.primarySoft, fg: colors.onPrimarySoft, border: colors.primary, icon: 'check' },
};

export default function Banner({ tone = 'info', title, message, children, style, testID }) {
  const { bg, fg, border, icon } = tones[tone];
  return (
    <View testID={testID} accessibilityRole={tone === 'error' ? 'alert' : undefined} style={[styles.base, { backgroundColor: bg, borderColor: border }, style]}>
      <Icon name={icon} color={fg} />
      <View style={styles.body}>
        {title ? <Text style={[type.title, { color: fg }]}>{title}</Text> : null}
        {message ? <Text style={[type.bodySmall, { color: colors.ink }]}>{message}</Text> : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  body: { flex: 1, gap: spacing.xs },
});
