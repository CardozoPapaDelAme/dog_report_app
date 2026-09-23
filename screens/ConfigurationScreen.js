import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, ActivityIndicator, BackHandler, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConfiguration } from '../hooks/useConfiguration.js';
import { CONFIGURATION_FIELDS, CONFIGURATION_GROUPS } from '../models/configuration.js';

const colors = { background: '#f7fbf1', surface: '#ffffff', ink: '#191d17', muted: '#5d6859', outline: '#c0c9bb', primary: '#00450d', soft: '#d9f2d4', danger: '#a51e1e', dangerSoft: '#fff0ee' };
const bodyFont = 'PlusJakartaSans_400Regular';
const boldFont = 'PlusJakartaSans_700Bold';
function errorText(error, t) {
  return typeof error === 'string' ? error : error ? t(`configuration.validation.${error.key}`, error.values) : '';
}
function Button({ title, onPress, disabled, secondary, busy, testID }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(busy) }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
    {busy ? <ActivityIndicator color={secondary ? colors.primary : '#fff'} /> : null}
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
  </Pressable>;
}
function ThresholdField({ field, value, error, disabled, t, wide, inputRef, onChange, onLayout }) {
  const label = t(`configuration.fields.${field.key}`);
  const message = errorText(error, t);
  const hint = t(field.decimals === 0 ? 'configuration.integerHint' : 'configuration.decimalHint', field);
  return <View onLayout={onLayout} style={[styles.field, wide && styles.wideField]}>
    <Text nativeID={`${field.key}-label`} style={styles.label}>{label}</Text>
    <Text style={styles.hint}>{hint}</Text>
    <TextInput ref={inputRef} testID={`configuration-${field.key}`} accessibilityLabel={label} accessibilityHint={message || hint}
      aria-invalid={Boolean(error)} aria-describedby={`${field.key}-help`} value={value} editable={!disabled}
      onChangeText={onChange} keyboardType={field.decimals === 0 ? 'number-pad' : 'decimal-pad'} inputMode={field.decimals === 0 ? 'numeric' : 'decimal'}
      selectTextOnFocus autoCorrect={false} style={[styles.input, error && styles.inputError, disabled && styles.inputDisabled]} />
    <Text nativeID={`${field.key}-help`} accessibilityLiveRegion="polite" style={error ? styles.fieldError : styles.fieldHelp}>{message || t(`configuration.help.${field.key}`)}</Text>
  </View>;
}

export default function ConfigurationScreen({ accessToken, onBack, api }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const form = useConfiguration(accessToken, api);
  const [pendingAction, setPendingAction] = useState(null);
  const scroll = useRef(null);
  const inputs = useRef({});
  const sections = useRef({});
  const fieldOffsets = useRef({});
  const errorCount = Object.keys(form.fieldErrors).length;
  useEffect(() => { setPendingAction(null); }, [accessToken]);
  useEffect(() => {
    if (Platform.OS !== 'android' || !onBack) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!form.saving) {
        if (form.dirty) setPendingAction('back');
        else onBack();
      }
      return true;
    });
    return () => subscription.remove();
  }, [form.dirty, form.saving, onBack]);
  useEffect(() => {
    if (!form.savedVersion) return;
    scroll.current?.scrollTo({ y: 0, animated: true });
    AccessibilityInfo.announceForAccessibility(t('configuration.saved', { version: form.savedVersion }));
  }, [form.savedVersion, t]);
  useEffect(() => {
    const key = Object.keys(form.fieldErrors)[0];
    if (!key) return;
    const group = CONFIGURATION_FIELDS.find((field) => field.key === key)?.group ?? 'note';
    scroll.current?.scrollTo({ y: Math.max(0, (sections.current[group] ?? 0) + (fieldOffsets.current[key] ?? 0) - 18), animated: true });
    inputs.current[key]?.focus();
    AccessibilityInfo.announceForAccessibility(errorText(form.fieldErrors[key], t));
  }, [form.fieldErrors, t]);

  function navigate(action) {
    if (form.saving) return;
    if (form.dirty) setPendingAction(action);
    else if (action === 'back') onBack?.();
    else form.reload();
  }
  function confirmAction() {
    const action = pendingAction;
    setPendingAction(null);
    if (action === 'back') onBack?.();
    else form.reload();
  }
  const ready = form.phase === 'ready';
  const sessionError = form.phase === 'session' || form.phase === 'forbidden';
  const generalError = form.error ? t(`configuration.errors.${form.error.code}`, { defaultValue: t('configuration.errors.request_failed') }) : null;

  return <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {onBack ? <Pressable accessibilityRole="button" disabled={form.saving} onPress={() => navigate('back')} style={styles.back}>
          <Text style={styles.backText}>← {t('configuration.back')}</Text>
        </Pressable> : null}
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{t('configuration.eyebrow')}</Text>
          <Text accessibilityRole="header" style={styles.title}>{t('configuration.title')}</Text>
          <Text style={styles.subtitle}>{t('configuration.subtitle')}</Text>
        </View>
        {form.phase === 'loading' ? <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.subtitle}>{t('configuration.loading')}</Text></View> : null}
        {sessionError ? <View style={styles.state} accessibilityLiveRegion="polite">
          <Text style={styles.stateTitle}>{t(form.phase === 'forbidden' ? 'configuration.forbiddenTitle' : 'configuration.sessionTitle')}</Text>
          <Text style={styles.subtitle}>{t(form.phase === 'forbidden' ? 'configuration.forbiddenBody' : 'configuration.sessionBody')}</Text>
        </View> : null}
        {form.phase === 'error' ? <View style={styles.state} accessibilityRole="alert">
          <Text style={styles.stateTitle}>{t('configuration.loadError')}</Text><Text style={styles.subtitle}>{generalError}</Text>
          <Button title={t('configuration.retry')} onPress={form.reload} secondary />
        </View> : null}
        {ready ? <>
          <View style={styles.versionCard}>
            <View style={styles.versionTop}><Text style={styles.version}>{t('configuration.version', { version: form.configuration.version })}</Text>
              <Text style={styles.environment}>{t(`configuration.environments.${form.configuration.environment}`)}</Text></View>
            <Text style={styles.caption}>{t('configuration.history')}</Text>
            {form.configuration.change_note ? <Text style={styles.previousNote}>{t('configuration.previousNote', { note: form.configuration.change_note })}</Text> : null}
          </View>
          {form.savedVersion ? <View style={styles.success} accessibilityRole="alert" accessibilityLiveRegion="polite"><Text style={styles.successText}>{t('configuration.saved', { version: form.savedVersion })}</Text></View> : null}
          {errorCount ? <View style={styles.errorBanner} accessibilityRole="alert"><Text style={styles.fieldError}>{t('configuration.fixFields', { count: errorCount })}</Text></View> : null}
          {form.error && !errorCount ? <View style={styles.errorBanner} accessibilityRole="alert"><Text style={styles.fieldError}>{form.needsReload ? t('configuration.verifyBeforeRetry') : generalError}</Text></View> : null}
          {CONFIGURATION_GROUPS.map((group, index) => <View key={group} onLayout={(event) => { sections.current[group] = event.nativeEvent.layout.y; }} style={styles.card}>
            <View style={styles.sectionHeader}><Text style={styles.sectionNumber}>{String(index + 1).padStart(2, '0')}</Text><Text accessibilityRole="header" style={styles.sectionTitle}>{t(`configuration.groups.${group}`)}</Text></View>
            <View style={styles.fields}>{CONFIGURATION_FIELDS.filter((field) => field.group === group).map((field) => <ThresholdField key={field.key} field={field} value={form.draft[field.key]}
              error={form.fieldErrors[field.key]} disabled={form.saving || form.needsReload} t={t} wide={width >= 760}
              inputRef={(node) => { inputs.current[field.key] = node; }} onChange={(value) => form.changeField(field.key, value)}
              onLayout={(event) => { fieldOffsets.current[field.key] = event.nativeEvent.layout.y; }} />)}</View>
          </View>)}
          <View style={styles.card} onLayout={(event) => { sections.current.note = event.nativeEvent.layout.y; }}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>{t('configuration.reasonTitle')}</Text>
            <Text style={styles.hint}>{t('configuration.reasonHelp')}</Text>
            <TextInput ref={(node) => { inputs.current.change_note = node; }} testID="configuration-change_note" multiline textAlignVertical="top" value={form.draft.change_note}
              editable={!form.saving && !form.needsReload} accessibilityLabel={t('configuration.reasonTitle')} aria-invalid={Boolean(form.fieldErrors.change_note)}
              accessibilityHint={errorText(form.fieldErrors.change_note, t) || t('configuration.reasonHelp')} aria-describedby="change-note-help"
              onChangeText={(value) => form.changeField('change_note', value)} placeholder={t('configuration.reasonPlaceholder')} placeholderTextColor={colors.muted}
              style={[styles.input, styles.noteInput, form.fieldErrors.change_note && styles.inputError]} />
            <View style={styles.noteFooter}><Text nativeID="change-note-help" style={styles.fieldError}>{errorText(form.fieldErrors.change_note, t)}</Text><Text style={styles.caption}>{[...form.draft.change_note].length}/1000</Text></View>
          </View>
          <Text style={styles.footnote}>{t('configuration.saveExplanation')}</Text>
        </> : null}
      </ScrollView>
      {ready ? <View style={styles.footer}><View style={styles.footerInner}>
        <Button title={t(form.needsReload ? 'configuration.verify' : 'configuration.reload')} secondary disabled={form.saving} onPress={() => navigate('reload')} />
        <Button testID="configuration-save" title={t(form.saving ? 'configuration.saving' : 'configuration.save')} busy={form.saving} disabled={form.saving || form.needsReload} onPress={form.save} />
      </View></View> : null}
    </KeyboardAvoidingView>
    <Modal transparent animationType="fade" visible={Boolean(pendingAction)} onRequestClose={() => setPendingAction(null)}>
      <View style={styles.modalBackdrop}><View style={styles.modalCard} accessibilityViewIsModal>
        <Text accessibilityRole="header" style={styles.stateTitle}>{t('configuration.discardTitle')}</Text>
        <Text style={styles.subtitle}>{t('configuration.discardBody')}</Text>
        <View style={styles.modalActions}><Button secondary title={t('configuration.keepEditing')} onPress={() => setPendingAction(null)} /><Button title={t('configuration.discard')} onPress={confirmAction} /></View>
      </View></View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: 20, paddingBottom: 32, gap: 18 },
  back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }, backText: { color: colors.primary, fontFamily: boldFont, fontSize: 14 },
  hero: { gap: 9, marginBottom: 6 }, eyebrow: { color: colors.primary, fontFamily: boldFont, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },
  title: { color: colors.ink, fontFamily: boldFont, fontSize: 30, lineHeight: 38 }, subtitle: { color: colors.muted, fontFamily: bodyFont, fontSize: 14, lineHeight: 22 },
  versionCard: { backgroundColor: colors.soft, borderRadius: 18, padding: 18, gap: 8 }, versionTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, justifyContent: 'space-between' },
  version: { color: colors.primary, fontFamily: boldFont, fontSize: 16 }, environment: { color: colors.primary, fontFamily: boldFont, fontSize: 11, borderWidth: 1, borderColor: '#9ebf99', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 },
  caption: { color: colors.muted, fontFamily: bodyFont, fontSize: 12, lineHeight: 18 }, previousNote: { color: colors.ink, fontFamily: bodyFont, fontSize: 12, lineHeight: 18 },
  card: { backgroundColor: colors.surface, borderColor: '#e0e6db', borderWidth: 1, borderRadius: 18, padding: 18, gap: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, sectionNumber: { color: colors.primary, fontFamily: boldFont, fontSize: 12, backgroundColor: colors.background, padding: 8, borderRadius: 9 },
  sectionTitle: { color: colors.ink, fontFamily: boldFont, fontSize: 17, flexShrink: 1 }, fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 }, field: { width: '100%', gap: 6 }, wideField: { flexBasis: '45%', flexGrow: 1 },
  label: { color: colors.ink, fontFamily: boldFont, fontSize: 14, lineHeight: 21 }, hint: { color: colors.muted, fontFamily: bodyFont, fontSize: 12, lineHeight: 19 },
  input: { borderWidth: 1, borderColor: colors.outline, borderRadius: 10, backgroundColor: '#fcfdf9', color: colors.ink, paddingHorizontal: 13, paddingVertical: 12, minHeight: 48, fontFamily: bodyFont, fontSize: 16 }, inputError: { borderColor: colors.danger, borderWidth: 2, backgroundColor: '#fffaf9' }, inputDisabled: { opacity: 0.65 },
  fieldHelp: { color: colors.muted, fontFamily: bodyFont, fontSize: 12, lineHeight: 18 }, fieldError: { color: colors.danger, fontFamily: bodyFont, fontSize: 13, lineHeight: 19, flexShrink: 1 },
  errorBanner: { backgroundColor: colors.dangerSoft, borderRadius: 12, padding: 14 }, success: { backgroundColor: colors.soft, borderRadius: 12, padding: 14 }, successText: { color: colors.primary, fontFamily: boldFont, fontSize: 14 },
  noteInput: { minHeight: 110 }, noteFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, footnote: { color: colors.muted, fontFamily: bodyFont, fontSize: 12, lineHeight: 19 },
  footer: { borderTopWidth: 1, borderColor: '#e0e6db', backgroundColor: colors.surface, padding: 14 }, footerInner: { width: '100%', maxWidth: 920, alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { flexGrow: 1, minHeight: 48, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, buttonText: { color: '#fff', fontFamily: boldFont, fontSize: 14 }, secondary: { backgroundColor: '#fff', borderColor: colors.outline, borderWidth: 1 }, secondaryText: { color: colors.primary }, disabled: { opacity: 0.5 }, pressed: { opacity: 0.8 },
  state: { paddingVertical: 32, gap: 18, alignItems: 'center' }, stateTitle: { color: colors.ink, fontFamily: boldFont, fontSize: 21 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,25,15,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 }, modalCard: { width: '100%', maxWidth: 460, backgroundColor: '#fff', borderRadius: 22, padding: 24, gap: 16 }, modalActions: { gap: 10 },
});
