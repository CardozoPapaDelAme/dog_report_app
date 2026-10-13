/**
 * @module components/ui/AppTextField
 * Labeled text input with 8 px radius. Forwards the ref (so `focus()` keeps working) and every TextInput prop,
 * including `nativeID`/`testID` and `multiline`. The label is visual; pass `accessibilityLabel` if it differs.
 */
import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, layout, radius, spacing, type } from '../../theme/index.js';

const AppTextField = forwardRef(function AppTextField({ label, error, helper, trailing, style, containerStyle, multiline, ...inputProps }, ref) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={type.label}>{label}</Text> : null}
      <View style={trailing ? [styles.input, styles.row, error && styles.inputError] : null}>
        <TextInput
          ref={ref}
          multiline={multiline}
          placeholderTextColor={colors.inkSubtle}
          accessibilityLabel={inputProps.accessibilityLabel ?? label}
          style={trailing ? styles.bare : [styles.input, multiline && styles.multiline, error && styles.inputError, style]}
          {...inputProps}
        />
        {trailing}
      </View>
      {error ? <Text style={[type.caption, styles.error]}>{error}</Text> : helper ? <Text style={type.caption}>{helper}</Text> : null}
    </View>
  );
});

export default AppTextField;

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  input: { ...type.body, minHeight: layout.minTouch, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 0 },
  bare: { ...type.body, flex: 1, minHeight: layout.minTouch - 2, paddingVertical: spacing.sm },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger },
});
