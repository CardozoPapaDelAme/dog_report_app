/** @module components/ui/StateView Loading / empty / error block with one visual pattern; the retry action is a child. */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../../theme/index.js';
import Icon from './Icon.js';

const icons = { empty: 'dog', error: 'alert', offline: 'info' };

export default function StateView({ kind = 'empty', title, message, children, style, testID }) {
  return (
    <View testID={testID} style={[styles.base, style]} accessibilityLiveRegion="polite">
      {kind === 'loading' ? <ActivityIndicator color={colors.primary} /> : <Icon name={icons[kind]} size={32} color={kind === 'error' ? colors.danger : colors.inkSubtle} />}
      {title ? <Text style={[type.title, styles.center]}>{title}</Text> : null}
      {message ? <Text style={[type.bodySmall, styles.center]}>{message}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', gap: spacing.sm, padding: spacing.xxl },
  center: { textAlign: 'center' },
});
