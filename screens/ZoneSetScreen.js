/**
 * @module screens/ZoneSetScreen
 * Container screen for zone set management of an authenticated staff session (403 shown as
 * `forbidden`): shows the active zone set, prepares a GeoJSON draft from text or a file, creates it,
 * and activates it with an association approval reference. Confirms before discarding a draft.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useZoneSets } from '../hooks/useZoneSets.js';
import { validateZoneApproval } from '../models/zoneSet.js';
import { AppButton, Banner, Icon, Sheet, StateView } from '../components/ui/index.js';
import { colors, fontFamily, layout, radius, spacing, type } from '../theme/index.js';

/** Translates a validation error (`{key, values}`) or returns a string error as is. */
const message = (error, t) => typeof error === 'string' ? error : error ? t(`zoneSets.validation.${error.key}`, error.values) : '';
function Field({ name, label, value, error, onChange, disabled, multiline, inputRef, t, hint }) {
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    {hint ? <Text style={styles.caption}>{hint}</Text> : null}
    <TextInput ref={inputRef} testID={`zone-${name}`} accessibilityLabel={label} accessibilityHint={message(error, t) || hint}
      aria-invalid={Boolean(error)} aria-describedby={`zone-${name}-error`} value={value} onChangeText={onChange} editable={!disabled}
      autoCapitalize="none" autoCorrect={false} multiline={multiline} textAlignVertical="top" placeholderTextColor={colors.inkSubtle}
      style={[styles.input, multiline && styles.multiline, error && styles.inputError]} />
    {error ? <Text nativeID={`zone-${name}-error`} accessibilityLiveRegion="polite" style={styles.errorText}>{message(error, t)}</Text> : null}
  </View>;
}
/** Read-only details of a zone set (SHA-256 included) as a grouped list; `collapsible` folds all but the name behind a toggle. */
function ZoneSummary({ zone, t, collapsible = false }) {
  const [open, setOpen] = useState(!collapsible);
  const details = <View style={!open && styles.hidden}>
    <View style={[styles.item, styles.itemDivider]}><Text style={styles.caption}>{t('zoneSets.sourceVersion')}</Text><Text selectable style={styles.value}>{zone.source_version}</Text></View>
    <View style={[styles.item, styles.itemDivider]}><Text style={styles.caption}>{t('zoneSets.fields.source_uri')}</Text><Text selectable style={styles.value}>{zone.source_uri}</Text></View>
    <View style={[styles.item, styles.itemDivider]}><Text style={styles.caption}>ID</Text><Text selectable style={styles.value}>{zone.id}</Text></View>
    <View style={[styles.item, zone.association_approval_reference && styles.itemDivider]}><Text style={styles.caption}>{t('zoneSets.checksum')}</Text>
      <Text selectable testID={`zone-checksum-${zone.status}`} style={styles.hash}>{zone.source_sha256}</Text></View>
    {zone.association_approval_reference ? <View style={styles.item}><Text selectable style={styles.caption}>{t('zoneSets.approval')}: {zone.association_approval_reference}</Text></View> : null}
  </View>;
  return <View style={styles.list}>
    <View style={[styles.item, styles.itemHead, open && styles.itemDivider]}>
      <Text style={[styles.label, styles.headText]}>{zone.name} · {t('zoneSets.version', { version: zone.version })}</Text>
      {collapsible ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((value) => !value)} hitSlop={8} style={styles.toggle}>
        <Text style={styles.toggleText}>{t(open ? 'zoneSets.hideDetails' : 'zoneSets.showDetails')}</Text><Icon name="down" size={18} color={colors.primary} />
      </Pressable> : null}
    </View>
    {details}
  </View>;
}
/** One step of the flow: a dot on the route line, with the content on the right. */
function Step({ children, active = true, last = false, onLayout }) {
  return <View onLayout={onLayout} style={styles.step}>
    <View style={styles.rail}><View style={[styles.dot, active && styles.dotActive]} />{last ? null : <View style={styles.line} />}</View>
    <View style={[styles.stepBody, !active && styles.stepWaiting]}>{children}</View>
  </View>;
}

/**
 * @param {object} props
 * @param {string} props.accessToken - Session access token.
 * @param {() => void} [props.onBack]
 * @param {object} [props.dependencies] - Network and file overrides for `useZoneSets`.
 * @returns {JSX.Element}
 */
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

  const activating = Boolean(form.saved) && !(form.saved.status === 'active' && !form.uncertain);
  const primary = !ready ? null : !form.saved
    ? { testID: 'zone-create', title: t('zoneSets.create'), disabled: !editable, loading: form.busy === 'create', onPress: form.create }
    : activating
      ? { testID: 'zone-activate', title: t('zoneSets.activate'), disabled: busy || Boolean(form.uncertain) || Boolean(validateZoneApproval(form.approval)), loading: form.busy === 'activate', onPress: form.activate }
      : null;

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View pointerEvents="none" accessible={false} aria-hidden importantForAccessibility="no" style={styles.bigPaw}><Icon name="dog" size={210} color={colors.onPrimary} strokeWidth={1.4} /></View>
          <View style={styles.headerInner}>
            {onBack ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => leave('back')} hitSlop={8} style={styles.back}>
              <Icon name="back" size={20} color={colors.onPrimary} /><Text style={styles.backText}>{t('configuration.back')}</Text>
            </Pressable> : null}
            <Text accessibilityRole="header" style={styles.title}>{t('zoneSets.title')}</Text>
            <Text style={styles.subtitle}>{t('zoneSets.subtitle')}</Text>
            {ready ? <View style={styles.versionRow}>
              <Text style={styles.environment}>{t(`configuration.environments.${form.environment}`)}</Text>
            </View> : null}
          </View>
        </View>
        <View style={styles.body}>
          {form.phase === 'loading' ? <StateView kind="loading" title={t('configuration.loading')} /> : null}
          {['session', 'forbidden'].includes(form.phase) ? <StateView kind="empty" title={t(form.phase === 'session' ? 'configuration.sessionTitle' : 'configuration.forbiddenTitle')} message={t(form.phase === 'session' ? 'configuration.sessionBody' : 'configuration.forbiddenBody')} /> : null}
          {form.phase === 'error' ? <StateView kind="error" title={errorText}><AppButton title={t('configuration.retry')} variant="secondary" onPress={form.reload} /></StateView> : null}
          {ready ? <>
            <View style={styles.block}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>{t('zoneSets.current')}</Text>
              {form.active ? <ZoneSummary zone={form.active} t={t} collapsible /> : <Text style={styles.body_text}>{t('zoneSets.noActive')}</Text>}
            </View>
            {form.error && !Object.keys(form.errors).length ? <Banner tone="error" message={errorText} /> : null}
            {form.uncertain ? <Banner tone="error" title={t('zoneSets.uncertainTitle')} message={t(`zoneSets.uncertain.${form.uncertain}`)}>
              {form.error?.requestId ? <Text selectable style={styles.caption}>{t('zoneSets.requestId')}: {form.error.requestId}</Text> : null}
              {form.uncertain === 'activate' ? <AppButton variant="secondary" disabled={busy} loading={form.busy === 'verify'} title={t('zoneSets.verify')} onPress={form.verifyActivation} /> : null}
              {form.verified ? <Text style={styles.errorText}>{t('zoneSets.notConfirmed')}</Text> : null}
            </Banner> : null}
            <View>
              <Step active={!form.saved}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>{t('zoneSets.stepOne')}</Text>
                <Text style={styles.body_text}>{t('zoneSets.stepOneHelp')}</Text>
                {!form.saved ? <>
                  <AppButton testID="zone-pick" variant="secondary" disabled={!editable} loading={form.busy === 'prepare'} title={t('zoneSets.pick')} onPress={() => form.prepare(true)} />
                  {form.filename ? <Text style={styles.caption}>{t('zoneSets.file', { name: form.filename })}</Text> : null}
                  <Field name="content" label={t('zoneSets.content')} hint={t('zoneSets.fileHelp')} value={form.draft.content} error={contentError} multiline disabled={!editable} t={t}
                    inputRef={(node) => { inputs.current.content = node; }} onChange={(value) => form.changeField('content', value)} />
                  <AppButton variant="secondary" disabled={!editable} title={t('zoneSets.calculate')} onPress={() => form.prepare()} />
                  {form.preview ? <View style={styles.checksum} accessibilityLiveRegion="polite">
                    <Text style={styles.label}>{t('zoneSets.checksum')}</Text><Text selectable testID="zone-checksum-preview" style={styles.hash}>{form.preview.checksum}</Text>
                    <Text style={styles.caption}>{t('zoneSets.polygons', { count: form.preview.polygons })}</Text>
                    <Text style={styles.caption}>{t('zoneSets.checksumHelp')}</Text>
                  </View> : null}
                  {['name', 'source_uri', 'source_version'].map((key) => <Field key={key} name={key} label={t(`zoneSets.fields.${key}`)}
                    value={form.draft[key]} error={form.errors[key]} disabled={!editable} t={t} inputRef={(node) => { inputs.current[key] = node; }}
                    onChange={(value) => form.changeField(key, value)} />)}
                </> : <>
                  <Text testID="zone-created" style={styles.success}>{t('zoneSets.created')}</Text>
                  <ZoneSummary zone={form.saved} t={t} />
                </>}
              </Step>
              <Step last active={Boolean(form.saved)} onLayout={(event) => { stepTwo.current = event.nativeEvent.layout.y; }}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>{t('zoneSets.stepTwo')}</Text>
                {!form.saved ? <Text style={styles.body_text}>{t('zoneSets.waitForDraft')}</Text> : form.saved.status === 'active' && !form.uncertain ? <>
                  <Text testID="zone-activated" accessibilityRole="alert" style={styles.success}>{t('zoneSets.activated')}</Text>
                  <Text selectable style={styles.body_text}>{form.saved.association_approval_reference}</Text>
                </> : <>
                  <Text testID="zone-draft-status" style={styles.badge}>{t(form.uncertain ? 'zoneSets.pendingConfirmation' : 'zoneSets.draftStatus')}</Text>
                  <Text style={styles.body_text}>{t('zoneSets.approvalHelp')}</Text>
                  <Field name="association_approval_reference" label={t('zoneSets.approval')} value={form.approval} error={form.errors.association_approval_reference ?? (form.approval ? validateZoneApproval(form.approval) : null)} hint={t('zoneSets.approvalHint')}
                    disabled={busy || Boolean(form.uncertain)} multiline t={t} inputRef={(node) => { inputs.current.association_approval_reference = node; }} onChange={form.changeApproval} />
                  <Text style={styles.caption}>{t('zoneSets.replaceHelp')}</Text>
                </>}
              </Step>
            </View>
            {form.saved && !form.uncertain ? <AppButton variant="secondary" title={t('zoneSets.newDraft')} disabled={busy} onPress={() => leave('new')} /> : null}
          </> : null}
        </View>
      </ScrollView>
      {primary ? <View style={styles.footer}><View style={styles.footerInner}>
        <AppButton variant="signal" size="lg" {...primary} style={styles.save} />
      </View></View> : null}
    </KeyboardAvoidingView>
    {pending ? <Sheet onClose={() => setPending(null)} maxHeight="75%">
      <Text accessibilityRole="header" style={styles.sheetTitle}>{t('zoneSets.leaveTitle')}</Text>
      <Text style={styles.body_text}>{t(form.saved || form.uncertain ? 'zoneSets.leaveSaved' : 'configuration.discardBody')}</Text>
      {form.saved ? <Text selectable style={styles.caption}>ID: {form.saved.id}</Text> : null}
      <View style={styles.sheetActions}>
        <AppButton variant="secondary" title={t('zoneSets.stay')} onPress={() => setPending(null)} />
        <AppButton title={t('zoneSets.leave')} onPress={() => { const action = pending; setPending(null); if (action === 'back') onBack?.(); else form.startNew(); }} />
      </View>
    </Sheet> : null}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: colors.primary }, scroll: { backgroundColor: colors.background }, content: { flexGrow: 1 },
  header: { backgroundColor: colors.primary, overflow: 'hidden' },
  bigPaw: { position: 'absolute', right: -44, top: 40, opacity: 0.1, transform: [{ rotate: '-18deg' }] },
  headerInner: { width: '100%', maxWidth: 850, alignSelf: 'center', paddingHorizontal: layout.margin, paddingTop: spacing.xs, paddingBottom: spacing.xxl, gap: spacing.sm },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: layout.minTouch, alignSelf: 'flex-start' }, backText: { ...type.button, fontSize: 15, color: colors.onPrimary },
  title: { fontFamily: fontFamily.display, fontSize: 38, lineHeight: 46, letterSpacing: -0.4, color: colors.onPrimary, marginTop: spacing.md },
  subtitle: { ...type.body, fontSize: 15, lineHeight: 22, color: colors.onForest, maxWidth: 520 },
  versionRow: { flexDirection: 'row', marginTop: spacing.sm },
  environment: { fontFamily: fontFamily.label, fontSize: 13, color: colors.onForest, borderWidth: 1, borderColor: 'rgba(201,230,196,0.5)', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  body: { width: '100%', maxWidth: 850, alignSelf: 'center', paddingHorizontal: layout.margin, paddingTop: spacing.xxl, paddingBottom: spacing.xxxl, gap: spacing.xxl },
  block: { gap: spacing.md },
  sectionTitle: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 32, color: colors.primary },
  body_text: { ...type.body, fontSize: 15, lineHeight: 22, color: colors.inkMuted },
  caption: { ...type.caption, color: colors.inkMuted },
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  hidden: { display: 'none' },
  itemHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, headText: { flex: 1 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: layout.minTouch, justifyContent: 'center' }, toggleText: { fontFamily: fontFamily.label, fontSize: 14, color: colors.primary },
  item: { padding: spacing.lg, gap: spacing.xxs }, itemDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  value: { fontFamily: fontFamily.labelMedium, fontSize: 15, lineHeight: 21, color: colors.ink, flexShrink: 1 },
  step: { flexDirection: 'row', gap: spacing.lg },
  rail: { width: 20, alignItems: 'center', paddingTop: spacing.sm },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.outline, backgroundColor: colors.background },
  dotActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  line: { flex: 1, width: 2, backgroundColor: colors.outlineSoft, marginTop: spacing.xs },
  stepBody: { flex: 1, gap: spacing.lg, paddingBottom: spacing.xxl }, stepWaiting: { opacity: 0.6 },
  field: { gap: spacing.xs }, label: { fontFamily: fontFamily.label, fontSize: 15, lineHeight: 22, color: colors.ink },
  input: { ...type.body, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outline, borderRadius: radius.sm, minHeight: 48, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, color: colors.ink },
  multiline: { minHeight: 120, maxHeight: 220 }, inputError: { borderWidth: 2, borderColor: colors.danger },
  checksum: { gap: spacing.sm, backgroundColor: colors.primarySoft, padding: spacing.lg, borderRadius: radius.md },
  hash: { color: colors.primary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, lineHeight: 20, flexShrink: 1, ...(Platform.OS === 'web' ? { overflowWrap: 'anywhere' } : {}) },
  badge: { alignSelf: 'flex-start', fontFamily: fontFamily.label, fontSize: 14, color: colors.primary, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  success: { fontFamily: fontFamily.displayMedium, fontSize: 18, lineHeight: 24, color: colors.primary },
  errorText: { ...type.caption, fontSize: 13, color: colors.danger },
  footer: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  footerInner: { width: '100%', maxWidth: 810, alignSelf: 'center' }, save: { borderRadius: 12 },
  sheetTitle: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 32, color: colors.ink }, sheetActions: { gap: spacing.md, marginTop: spacing.sm },
});
