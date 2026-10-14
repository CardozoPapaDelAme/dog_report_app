/**
 * @module screens/ConfigurationScreen
 * Container screen for the operational configuration (thresholds and limits by group) of an
 * authenticated staff session; the API answers 403 for other roles, shown as `forbidden`. Confirms
 * before discarding unsaved changes on back, logout or reload, focuses the first invalid field and
 * announces saved versions for accessibility.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConfiguration } from '../hooks/useConfiguration.js';
import { CONFIGURATION_FIELDS, CONFIGURATION_GROUPS } from '../models/configuration.js';
import { AppButton, Banner, Icon, Sheet, StateView } from '../components/ui/index.js';
import { colors, fontFamily, layout, radius, spacing, type } from '../theme/index.js';

/** Translates a validation error (`{key, values}`) or returns a string error as is. */
function errorText(error, t) {
  return typeof error === 'string' ? error : error ? t(`configuration.validation.${error.key}`, error.values) : '';
}
/** Numeric input for one `CONFIGURATION_FIELDS` entry with hint, help and error text. */
function ThresholdField({ field, value, error, disabled, t, inputRef, onChange, onLayout, last }) {
  const label = t(`configuration.fields.${field.key}`);
  const message = errorText(error, t);
  const hint = t(field.decimals === 0 ? 'configuration.integerHint' : 'configuration.decimalHint', field);
  return <View onLayout={onLayout} style={[styles.row, !last && styles.rowDivider]}>
    <View style={styles.rowText}>
      <Text nativeID={`${field.key}-label`} style={styles.label}>{label}</Text>
      <Text style={styles.hint}>{hint}</Text>
      <Text nativeID={`${field.key}-help`} accessibilityLiveRegion="polite" style={error ? styles.fieldError : styles.fieldHelp}>{message || t(`configuration.help.${field.key}`)}</Text>
    </View>
    <TextInput ref={inputRef} testID={`configuration-${field.key}`} accessibilityLabel={label} accessibilityHint={message || hint}
      aria-invalid={Boolean(error)} aria-describedby={`${field.key}-help`} value={value} editable={!disabled}
      onChangeText={onChange} keyboardType={field.decimals === 0 ? 'number-pad' : 'decimal-pad'} inputMode={field.decimals === 0 ? 'numeric' : 'decimal'}
      selectTextOnFocus autoCorrect={false} style={[styles.numberInput, error && styles.inputError, disabled && styles.inputDisabled]} />
  </View>;
}

/**
 * @param {object} props
 * @param {string} props.accessToken - Session access token.
 * @param {() => void} [props.onBack]
 * @param {() => void} [props.onLogout]
 * @param {boolean} [props.logoutPending=false]
 * @param {object} [props.api] - Network call overrides for `useConfiguration`.
 * @returns {JSX.Element}
 */
export default function ConfigurationScreen({ accessToken, onBack, onLogout, logoutPending = false, api }) {
  const { t } = useTranslation();
  const form = useConfiguration(accessToken, api);
  const [pendingAction, setPendingAction] = useState(null);
  const scroll = useRef(null);
  const inputs = useRef({});
  const sections = useRef({});
  const bodyOffset = useRef(0);
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
    scroll.current?.scrollTo({ y: Math.max(0, bodyOffset.current + (sections.current[group] ?? 0) + (fieldOffsets.current[key] ?? 0) - 18), animated: true });
    inputs.current[key]?.focus();
    AccessibilityInfo.announceForAccessibility(errorText(form.fieldErrors[key], t));
  }, [form.fieldErrors, t]);

  function navigate(action) {
    if (form.saving || (action === 'logout' && logoutPending)) return;
    if (form.dirty) setPendingAction(action);
    else if (action === 'back') onBack?.();
    else if (action === 'logout') onLogout?.();
    else form.reload();
  }
  function confirmAction() {
    const action = pendingAction;
    setPendingAction(null);
    if (action === 'back') onBack?.();
    else if (action === 'logout') onLogout?.();
    else form.reload();
  }
  const ready = form.phase === 'ready';
  const sessionError = form.phase === 'session' || form.phase === 'forbidden';
  const generalError = form.error ? t(`configuration.errors.${form.error.code}`, { defaultValue: t('configuration.errors.request_failed') }) : null;

  return <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View pointerEvents="none" accessible={false} aria-hidden importantForAccessibility="no" style={styles.bigPaw}><Icon name="dog" size={210} color={colors.onPrimary} strokeWidth={1.4} /></View>
          <View style={styles.headerInner}>
            {onBack || onLogout ? <View style={styles.topActions}>
              {onBack ? <Pressable accessibilityRole="button" disabled={form.saving} onPress={() => navigate('back')} hitSlop={8} style={styles.back}>
                <Icon name="back" size={20} color={colors.onPrimary} /><Text style={styles.backText}>{t('configuration.back')}</Text>
              </Pressable> : <View />}
              {onLogout ? <Pressable accessibilityRole="button" disabled={form.saving || logoutPending} onPress={() => navigate('logout')} hitSlop={8} style={styles.back}>
                <Text style={styles.backText}>{t('login.logout')}</Text>
              </Pressable> : null}
            </View> : null}
            <Text accessibilityRole="header" style={styles.title}>{t('configuration.title')}</Text>
            <Text style={styles.subtitle}>{t('configuration.subtitle')}</Text>
            {ready ? <View style={styles.versionRow}>
              <Text style={styles.version}>{t('configuration.version', { version: form.configuration.version })}</Text>
              <Text style={styles.environment}>{t(`configuration.environments.${form.configuration.environment}`)}</Text>
            </View> : null}
            {ready ? <Text style={styles.caption}>{t('configuration.history')}</Text> : null}
            {ready && form.configuration.change_note ? <Text style={styles.caption}>{t('configuration.previousNote', { note: form.configuration.change_note })}</Text> : null}
          </View>
        </View>
        <View style={styles.body} onLayout={(event) => { bodyOffset.current = event.nativeEvent.layout.y; }}>
        {form.phase === 'loading' ? <StateView kind="loading" title={t('configuration.loading')} /> : null}
        {sessionError ? <StateView kind="empty" title={t(form.phase === 'forbidden' ? 'configuration.forbiddenTitle' : 'configuration.sessionTitle')} message={t(form.phase === 'forbidden' ? 'configuration.forbiddenBody' : 'configuration.sessionBody')} /> : null}
        {form.phase === 'error' ? <StateView kind="error" title={t('configuration.loadError')} message={generalError}>
          <AppButton title={t('configuration.retry')} variant="secondary" onPress={form.reload} />
        </StateView> : null}
        {ready ? <>
          {form.savedVersion ? <Banner tone="success" message={t('configuration.saved', { version: form.savedVersion })} /> : null}
          {errorCount ? <Banner tone="error" message={t('configuration.fixFields', { count: errorCount })} /> : null}
          {form.error && !errorCount ? <Banner tone="error" message={form.needsReload ? t('configuration.verifyBeforeRetry') : generalError} /> : null}
          {CONFIGURATION_GROUPS.map((group) => {
            const groupFields = CONFIGURATION_FIELDS.filter((field) => field.group === group);
            return <View key={group} onLayout={(event) => { sections.current[group] = event.nativeEvent.layout.y; }} style={styles.group}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>{t(`configuration.groups.${group}`)}</Text>
              <View style={styles.list}>{groupFields.map((field, index) => <ThresholdField key={field.key} field={field} value={form.draft[field.key]}
                error={form.fieldErrors[field.key]} disabled={form.saving || form.needsReload} t={t} last={index === groupFields.length - 1}
                inputRef={(node) => { inputs.current[field.key] = node; }} onChange={(value) => form.changeField(field.key, value)}
                onLayout={(event) => { fieldOffsets.current[field.key] = event.nativeEvent.layout.y; }} />)}</View>
            </View>;
          })}
          <View style={styles.group} onLayout={(event) => { sections.current.note = event.nativeEvent.layout.y; }}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>{t('configuration.reasonTitle')}</Text>
            <Text style={styles.hint}>{t('configuration.reasonHelp')}</Text>
            <TextInput ref={(node) => { inputs.current.change_note = node; }} testID="configuration-change_note" multiline textAlignVertical="top" value={form.draft.change_note}
              editable={!form.saving && !form.needsReload} accessibilityLabel={t('configuration.reasonTitle')} aria-invalid={Boolean(form.fieldErrors.change_note)}
              accessibilityHint={errorText(form.fieldErrors.change_note, t) || t('configuration.reasonHelp')} aria-describedby="change-note-help"
              onChangeText={(value) => form.changeField('change_note', value)} placeholder={t('configuration.reasonPlaceholder')} placeholderTextColor={colors.inkSubtle}
              style={[styles.input, styles.noteInput, form.fieldErrors.change_note && styles.inputError]} />
            <View style={styles.noteFooter}><Text nativeID="change-note-help" style={styles.fieldError}>{errorText(form.fieldErrors.change_note, t)}</Text><Text style={styles.counter}>{[...form.draft.change_note].length}/1000</Text></View>
          </View>
          <Text style={styles.footnote}>{t('configuration.saveExplanation')}</Text>
        </> : null}
        </View>
      </ScrollView>
      {ready ? <View style={styles.footer}><View style={styles.footerInner}>
        <Pressable accessibilityRole="button" accessibilityLabel={t(form.needsReload ? 'configuration.verify' : 'configuration.reload')} accessibilityState={{ disabled: form.saving }} disabled={form.saving} onPress={() => navigate('reload')} hitSlop={4} style={({ pressed }) => [styles.reload, pressed && styles.pressed, form.saving && styles.dim]}>
          <Icon name="refresh" size={22} color={colors.onPrimary} />
        </Pressable>
        <AppButton testID="configuration-save" variant="signal" title={t(form.saving ? 'configuration.saving' : 'configuration.save')} loading={form.saving} disabled={form.saving || form.needsReload} onPress={form.save} style={styles.save} />
      </View></View> : null}
    </KeyboardAvoidingView>
    {pendingAction ? <Sheet onClose={() => setPendingAction(null)} maxHeight="70%">
      <Text accessibilityRole="header" style={styles.sheetTitle}>{t('configuration.discardTitle')}</Text>
      <Text style={styles.sheetBody}>{t('configuration.discardBody')}</Text>
      <View style={styles.modalActions}><AppButton variant="secondary" title={t('configuration.keepEditing')} onPress={() => setPendingAction(null)} /><AppButton title={t('configuration.discard')} onPress={confirmAction} /></View>
    </Sheet> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: colors.primary }, scroll: { backgroundColor: colors.background },
  content: { flexGrow: 1 },
  header: { backgroundColor: colors.primary, overflow: 'hidden' },
  bigPaw: { position: 'absolute', right: -44, top: 40, opacity: 0.1, transform: [{ rotate: '-18deg' }] },
  headerInner: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: layout.margin, paddingTop: spacing.xs, paddingBottom: spacing.xxl, gap: spacing.sm },
  topActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: layout.minTouch, justifyContent: 'center' }, backText: { ...type.button, fontSize: 15, color: colors.onPrimary },
  title: { fontFamily: fontFamily.display, fontSize: 38, lineHeight: 46, letterSpacing: -0.4, color: colors.onPrimary, marginTop: spacing.md },
  subtitle: { ...type.body, fontSize: 15, lineHeight: 22, color: colors.onForest, maxWidth: 520 },
  versionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  version: { fontFamily: fontFamily.displayMedium, fontSize: 20, color: colors.signal },
  environment: { fontFamily: fontFamily.label, fontSize: 13, color: colors.onForest, borderWidth: 1, borderColor: 'rgba(201,230,196,0.5)', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  caption: { ...type.caption, color: colors.onForest },
  body: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: layout.margin, paddingTop: spacing.xxl, paddingBottom: spacing.xxxl, gap: spacing.xxl },
  group: { gap: spacing.md },
  sectionTitle: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 32, color: colors.primary },
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg, padding: spacing.lg },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { flex: 1, gap: spacing.xxs },
  label: { fontFamily: fontFamily.label, fontSize: 15, lineHeight: 21, color: colors.ink }, hint: { ...type.caption, color: colors.inkMuted },
  numberInput: { width: 104, minHeight: 52, textAlign: 'right', fontFamily: fontFamily.number, fontVariant: ['tabular-nums'], fontSize: 24, color: colors.primary, backgroundColor: colors.primarySoft, borderWidth: 2, borderColor: 'transparent', borderRadius: radius.md, paddingHorizontal: spacing.md },
  input: { ...type.body, borderWidth: 1, borderColor: colors.outline, borderRadius: radius.sm, backgroundColor: colors.surface, color: colors.ink, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 48 },
  inputError: { borderColor: colors.danger, backgroundColor: '#fffaf9' }, inputDisabled: { opacity: 0.65 },
  fieldHelp: { ...type.caption, color: colors.inkMuted }, fieldError: { ...type.caption, fontSize: 13, color: colors.danger, flexShrink: 1 },
  noteInput: { minHeight: 120 }, noteFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  counter: { fontFamily: fontFamily.labelMedium, fontVariant: ['tabular-nums'], fontSize: 13, color: colors.inkMuted },
  footnote: { ...type.caption, color: colors.inkMuted },
  footer: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  footerInner: { width: '100%', maxWidth: 920, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  reload: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(201,230,196,0.45)' }, pressed: { opacity: 0.7 }, dim: { opacity: 0.45 },
  save: { flex: 1, borderRadius: 12 },
  sheetTitle: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 32, color: colors.ink }, sheetBody: { ...type.body, color: colors.inkMuted },
  modalActions: { gap: spacing.md, marginTop: spacing.sm },
});
