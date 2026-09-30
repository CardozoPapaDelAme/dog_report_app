import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, ActivityIndicator, BackHandler, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useZoneSets } from '../hooks/useZoneSets.js';
import { validateZoneApproval } from '../models/zoneSet.js';

const colors = { background: '#f7fbf1', ink: '#191d17', muted: '#5d6859', primary: '#00450d', soft: '#d9f2d4', border: '#c0c9bb', danger: '#a51e1e' };
const message = (error, t) => typeof error === 'string' ? error : error ? t(`zoneSets.validation.${error.key}`, error.values) : '';
function Button({ title, onPress, disabled = false, secondary = false, busy = false, testID }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, disabled && styles.disabled, pressed && styles.pressed]}>
    {busy ? <ActivityIndicator color={secondary ? colors.primary : '#fff'} /> : null}
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
  </Pressable>;
}
function Field({ name, label, value, error, onChange, disabled, multiline, inputRef, t, hint }) {
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    {hint ? <Text style={styles.caption}>{hint}</Text> : null}
    <TextInput ref={inputRef} testID={`zone-${name}`} accessibilityLabel={label} accessibilityHint={message(error, t) || hint}
      aria-invalid={Boolean(error)} aria-describedby={`zone-${name}-error`} value={value} onChangeText={onChange} editable={!disabled}
      autoCapitalize="none" autoCorrect={false} multiline={multiline} textAlignVertical="top"
      style={[styles.input, multiline && styles.multiline, error && styles.inputError]} />
    {error ? <Text nativeID={`zone-${name}-error`} accessibilityLiveRegion="polite" style={styles.errorText}>{message(error, t)}</Text> : null}
  </View>;
}
function ZoneSummary({ zone, t }) {
  return <View style={styles.summary}>
    <Text style={styles.label}>{zone.name} · {t('zoneSets.version', { version: zone.version })}</Text>
    <Text selectable style={styles.caption}>{t('zoneSets.sourceVersion')}: {zone.source_version}</Text>
    <Text selectable style={styles.caption}>{t('zoneSets.fields.source_uri')}: {zone.source_uri}</Text>
    <Text selectable style={styles.caption}>ID: {zone.id}</Text>
    <Text style={styles.caption}>{t('zoneSets.checksum')}</Text>
    <Text selectable testID={`zone-checksum-${zone.status}`} style={styles.hash}>{zone.source_sha256}</Text>
    {zone.association_approval_reference ? <Text selectable style={styles.caption}>{t('zoneSets.approval')}: {zone.association_approval_reference}</Text> : null}
  </View>;
}

export default function ZoneSetScreen({ accessToken, onBack, dependencies }) {
  const { t } = useTranslation();
  const form = useZoneSets(accessToken, dependencies);
  const [pending, setPending] = useState(null);
  const inputs = useRef({});
  const scroll = useRef(null);
  const stepTwo = useRef(0);
  useEffect(() => { setPending(null); }, [accessToken]);
  const busy = Boolean(form.busy);
  function leave(action) {
    if (busy) return;
    if (form.dirty) setPending(action);
    else if (action === 'back') onBack?.();
    else form.startNew();
  }
  useEffect(() => {
    if (Platform.OS !== 'android' || !onBack) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { leave('back'); return true; });
    return () => listener.remove();
  }, [busy, form.dirty, onBack]);
  useEffect(() => {
    if (!form.saved) return;
    scroll.current?.scrollTo({ y: Math.max(0, stepTwo.current - 16), animated: true });
    AccessibilityInfo.announceForAccessibility(t(form.saved.status === 'active' && !form.uncertain ? 'zoneSets.activated' : 'zoneSets.created'));
  }, [form.saved, t]);
  useEffect(() => {
    const key = Object.keys(form.errors)[0];
    if (!key) return;
    const input = inputs.current[key] ?? inputs.current.content;
    input?.focus();
    AccessibilityInfo.announceForAccessibility(message(form.errors[key], t));
  }, [form.errors, t]);
  const errorText = form.error ? t(`zoneSets.errors.${form.error.code}`, { defaultValue: t('zoneSets.errors.request_failed') }) : '';
  const editable = !busy && !form.uncertain && !form.saved;
  const contentError = form.errors.content ?? form.errors.geometry ?? form.errors.source_sha256;
  const ready = form.phase === 'ready';

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {onBack ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => leave('back')} style={styles.back}><Text style={styles.backText}>← {t('configuration.back')}</Text></Pressable> : null}
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{t('configuration.eyebrow')}</Text>
          <Text accessibilityRole="header" style={styles.title}>{t('zoneSets.title')}</Text>
          <Text style={styles.body}>{t('zoneSets.subtitle')}</Text>
        </View>
        {form.phase === 'loading' ? <ActivityIndicator accessibilityLabel={t('configuration.loading')} color={colors.primary} /> : null}
        {['session', 'forbidden'].includes(form.phase) ? <View style={styles.card} accessibilityLiveRegion="polite">
          <Text style={styles.heading}>{t(form.phase === 'session' ? 'configuration.sessionTitle' : 'configuration.forbiddenTitle')}</Text>
          <Text style={styles.body}>{t(form.phase === 'session' ? 'configuration.sessionBody' : 'configuration.forbiddenBody')}</Text>
        </View> : null}
        {form.phase === 'error' ? <View style={styles.card} accessibilityRole="alert"><Text style={styles.errorText}>{errorText}</Text><Button title={t('configuration.retry')} onPress={form.reload} /></View> : null}
        {ready ? <>
          <View style={styles.activeCard}>
            <Text style={styles.eyebrow}>{t(`configuration.environments.${form.environment}`)}</Text>
            <Text accessibilityRole="header" style={styles.heading}>{t('zoneSets.current')}</Text>
            {form.active ? <ZoneSummary zone={form.active} t={t} /> : <Text style={styles.body}>{t('zoneSets.noActive')}</Text>}
          </View>
          {form.error && !Object.keys(form.errors).length ? <View accessibilityRole="alert" style={styles.errorBanner}><Text style={styles.errorText}>{errorText}</Text></View> : null}
          {form.uncertain ? <View accessibilityRole="alert" style={styles.errorBanner}>
            <Text style={styles.label}>{t('zoneSets.uncertainTitle')}</Text>
            <Text style={styles.body}>{t(`zoneSets.uncertain.${form.uncertain}`)}</Text>
            {form.error?.requestId ? <Text selectable style={styles.caption}>{t('zoneSets.requestId')}: {form.error.requestId}</Text> : null}
            {form.uncertain === 'activate' ? <Button secondary disabled={busy} busy={form.busy === 'verify'} title={t('zoneSets.verify')} onPress={form.verifyActivation} /> : null}
            {form.verified ? <Text style={styles.errorText}>{t('zoneSets.notConfirmed')}</Text> : null}
          </View> : null}
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.heading}>{t('zoneSets.stepOne')}</Text>
            <Text style={styles.body}>{t('zoneSets.stepOneHelp')}</Text>
            {!form.saved ? <>
              <Button testID="zone-pick" secondary disabled={!editable} busy={form.busy === 'prepare'} title={t('zoneSets.pick')} onPress={() => form.prepare(true)} />
              {form.filename ? <Text style={styles.caption}>{t('zoneSets.file', { name: form.filename })}</Text> : null}
              <Field name="content" label={t('zoneSets.content')} hint={t('zoneSets.fileHelp')} value={form.draft.content} error={contentError} multiline disabled={!editable} t={t}
                inputRef={(node) => { inputs.current.content = node; }} onChange={(value) => form.changeField('content', value)} />
              <Button secondary disabled={!editable} title={t('zoneSets.calculate')} onPress={() => form.prepare()} />
              {form.preview ? <View style={styles.checksum} accessibilityLiveRegion="polite">
                <Text style={styles.label}>{t('zoneSets.checksum')}</Text><Text selectable testID="zone-checksum-preview" style={styles.hash}>{form.preview.checksum}</Text>
                <Text style={styles.caption}>{t('zoneSets.polygons', { count: form.preview.polygons })}</Text>
                <Text style={styles.caption}>{t('zoneSets.checksumHelp')}</Text>
              </View> : null}
              {['name', 'source_uri', 'source_version'].map((key) => <Field key={key} name={key} label={t(`zoneSets.fields.${key}`)}
                value={form.draft[key]} error={form.errors[key]} disabled={!editable} t={t} inputRef={(node) => { inputs.current[key] = node; }}
                onChange={(value) => form.changeField(key, value)} />)}
              <Button testID="zone-create" title={t('zoneSets.create')} disabled={!editable} busy={form.busy === 'create'} onPress={form.create} />
            </> : <>
              <Text testID="zone-created" style={styles.success}>{t('zoneSets.created')}</Text>
              <ZoneSummary zone={form.saved} t={t} />
            </>}
          </View>
          <View onLayout={(event) => { stepTwo.current = event.nativeEvent.layout.y; }} style={styles.card}>
            <Text accessibilityRole="header" style={styles.heading}>{t('zoneSets.stepTwo')}</Text>
            {!form.saved ? <Text style={styles.body}>{t('zoneSets.waitForDraft')}</Text> : form.saved.status === 'active' && !form.uncertain ? <>
              <Text testID="zone-activated" accessibilityRole="alert" style={styles.success}>{t('zoneSets.activated')}</Text>
              <Text selectable style={styles.body}>{form.saved.association_approval_reference}</Text>
            </> : <>
              <Text testID="zone-draft-status" style={styles.badge}>{t(form.uncertain ? 'zoneSets.pendingConfirmation' : 'zoneSets.draftStatus')}</Text>
              <Text style={styles.body}>{t('zoneSets.approvalHelp')}</Text>
              <Field name="association_approval_reference" label={t('zoneSets.approval')} value={form.approval} error={form.errors.association_approval_reference ?? (form.approval ? validateZoneApproval(form.approval) : null)} hint={t('zoneSets.approvalHint')}
                disabled={busy || Boolean(form.uncertain)} multiline t={t} inputRef={(node) => { inputs.current.association_approval_reference = node; }} onChange={form.changeApproval} />
              <Text style={styles.caption}>{t('zoneSets.replaceHelp')}</Text>
              <Button testID="zone-activate" title={t('zoneSets.activate')} disabled={busy || Boolean(form.uncertain) || Boolean(validateZoneApproval(form.approval))}
                busy={form.busy === 'activate'} onPress={form.activate} />
            </>}
          </View>
          {form.saved && !form.uncertain ? <Button secondary title={t('zoneSets.newDraft')} disabled={busy} onPress={() => leave('new')} /> : null}
        </> : null}
      </ScrollView>
    </KeyboardAvoidingView>
    <Modal visible={Boolean(pending)} transparent animationType="fade" onRequestClose={() => setPending(null)}>
      <View style={styles.backdrop}><View style={styles.modal} accessibilityViewIsModal>
        <Text accessibilityRole="header" style={styles.heading}>{t('zoneSets.leaveTitle')}</Text>
        <Text style={styles.body}>{t(form.saved || form.uncertain ? 'zoneSets.leaveSaved' : 'configuration.discardBody')}</Text>
        {form.saved ? <Text selectable style={styles.caption}>ID: {form.saved.id}</Text> : null}
        <Button secondary title={t('zoneSets.stay')} onPress={() => setPending(null)} />
        <Button title={t('zoneSets.leave')} onPress={() => { const action = pending; setPending(null); if (action === 'back') onBack?.(); else form.startNew(); }} />
      </View></View>
    </Modal>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 850, alignSelf: 'center', padding: 20, gap: 18, paddingBottom: 40 },
  back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }, backText: { color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  hero: { gap: 10 }, eyebrow: { color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { color: colors.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 30, lineHeight: 38 },
  body: { color: colors.muted, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 22 },
  caption: { color: colors.muted, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 19 },
  heading: { color: colors.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 19, lineHeight: 27 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#e0e6db', gap: 16 },
  activeCard: { backgroundColor: colors.soft, padding: 20, borderRadius: 18, gap: 12 },
  summary: { gap: 8 }, field: { gap: 7 }, label: { color: colors.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 22 },
  input: { backgroundColor: '#fcfdf9', borderWidth: 1, borderColor: colors.border, borderRadius: 10, minHeight: 48, padding: 12, color: colors.ink, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 16 },
  multiline: { minHeight: 110, maxHeight: 200 }, inputError: { borderWidth: 2, borderColor: colors.danger },
  checksum: { gap: 10, backgroundColor: colors.background, padding: 14, borderRadius: 12 },
  hash: { color: colors.primary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, lineHeight: 21, flexShrink: 1, ...(Platform.OS === 'web' ? { overflowWrap: 'anywhere' } : {}) },
  badge: { color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  success: { color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, lineHeight: 23 },
  errorText: { color: colors.danger, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 20 },
  errorBanner: { backgroundColor: '#fff0ee', borderRadius: 12, padding: 16, gap: 12 },
  button: { backgroundColor: colors.primary, minHeight: 48, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 13, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
  buttonText: { color: '#fff', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, textAlign: 'center' }, secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border }, secondaryText: { color: colors.primary }, disabled: { opacity: 0.5 }, pressed: { opacity: 0.8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(17,25,15,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 }, modal: { width: '100%', maxWidth: 460, padding: 24, borderRadius: 22, backgroundColor: '#fff', gap: 16 },
});
