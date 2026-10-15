/**
 * @module components/ui/AppTextField
 * Labeled text input with 8 px radius. Forwards the ref (so `focus()` keeps working) and every TextInput prop,
 * including `nativeID`/`testID` and `multiline`. The label is visual; pass `accessibilityLabel` if it differs.
 */
import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, layout, radius, spacing, type } from '../../theme/index.js';

const AppTextField = forwardRef(function AppTextField({ label, error, helper, trailing, tone = 'light', style, containerStyle, multiline, ...inputProps }, ref) {
  const dark = tone === 'dark';
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={[type.label, dark && styles.labelDark]}>{label}</Text> : null}
      <View style={trailing ? [styles.input, styles.row, dark && styles.inputDark, error && styles.inputError] : null}>
        <TextInput
          ref={ref}
          multiline={multiline}
          placeholderTextColor={dark ? colors.onForestSubtle : colors.inkSubtle}
          accessibilityLabel={inputProps.accessibilityLabel ?? label}
          style={trailing ? [styles.bare, dark && styles.textDark] : [styles.input, multiline && styles.multiline, dark && styles.inputDark, dark && styles.textDark, error && styles.inputError, style]}
          {...inputProps}
        />
        {trailing}
      </View>
      {error ? <Text style={[type.caption, styles.error, dark && styles.errorDark]}>{error}</Text> : helper ? <Text style={[type.caption, dark && styles.helperDark]}>{helper}</Text> : null}
    </View>
  );
});

export default AppTextField;

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  input: { ...type.input, minHeight: layout.minTouch, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 0 },
  bare: { ...type.input, flex: 1, minHeight: layout.minTouch - 2, paddingVertical: spacing.sm },
  multiline: { minHeight: 96, lineHeight: 22, textAlignVertical: 'top' },
  labelDark: { color: colors.onForest },
  inputDark: { backgroundColor: colors.forestField, borderColor: 'rgba(201,230,196,0.45)' },
  textDark: { color: colors.onPrimary },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger },
  errorDark: { color: '#ffb4ab' },
  helperDark: { color: colors.onForest },
});
