import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useSubmitReport } from '../hooks/useSubmitReport.js';
import { REPORT_DRAFT_STATE } from '../models/reportDraft.js';
import {
  createEmptyReportFormDraft,
  INCIDENT_TYPES,
  SIGHTING_TYPES,
  DOG_SIZES,
  INJURED_DOG_SITUATIONS,
} from '../models/reportPayload.js';

const colors = {
  background: '#ffffff',
  surface: '#ffffff',
  ink: '#191d17',
  muted: '#5d6859',
  outline: '#c0c9bb',
  primary: '#00450d',
  soft: '#eef3e9',
  danger: '#a51e1e',
  dangerSoft: '#fff0ee',
  warning: '#735500',
  warningSoft: '#fff3cd',
};
const bodyFont = 'PlusJakartaSans_400Regular';
const semiBoldFont = 'PlusJakartaSans_600SemiBold';
const boldFont = 'PlusJakartaSans_700Bold';

function fieldErrorText(error, t) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return t(`reportForm.validation.${error.key}`, error.values);
}

function SelectField({ label, field, value, options, disabled, error, t, onChange }) {
  const [open, setOpen] = useState(false);
  const message = fieldErrorText(error, t);
  const selected = options.find((option) => option.value === value);
  return (
    <View style={[styles.fieldGroup, styles.dropdownGroup]}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        testID={`report-${field}-select`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled: Boolean(disabled) }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.select,
          error && styles.inputError,
          disabled && styles.inputDisabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <Text numberOfLines={1} style={styles.selectText}>{selected?.label ?? t('reportForm.selectPlaceholder')}</Text>
        <Text style={styles.selectChevron}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.selectBackdrop}>
          <Pressable style={styles.selectDismissArea} onPress={() => setOpen(false)} />
          <View style={styles.selectSheet}>
            <Text style={styles.selectSheetTitle}>{label}</Text>
            {options.map((option) => (
              <Pressable
                key={option.value}
                testID={`report-${field}-${option.value}`}
                accessibilityRole="button"
                accessibilityState={{ selected: value === option.value }}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  styles.selectOption,
                  value === option.value && styles.selectOptionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.selectOptionText, value === option.value && styles.selectOptionTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
      {message ? <Text style={styles.fieldError}>{message}</Text> : null}
    </View>
  );
}

function reportErrorText(error, t) {
  if (!error) return '';
  return t(`reportForm.errors.${error.code}`, {
    defaultValue: t('reportForm.errors.request_failed'),
  });
}

function Button({ title, onPress, disabled, busy, secondary, testID }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(busy) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {busy ? <ActivityIndicator color={secondary ? colors.primary : '#fff'} /> : null}
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{title}</Text>
    </Pressable>
  );
}

function ChoiceGroup({ label, field, value, options, disabled, error, t, onChange, allowDeselect = false }) {
  const message = fieldErrorText(error, t);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choiceGrid}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={String(option.value)}
              testID={`report-${field}-${option.value}`}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: Boolean(disabled) }}
              disabled={disabled}
              onPress={() => onChange(allowDeselect && selected ? '' : option.value)}
              style={({ pressed }) => [
                styles.choice,
                selected && styles.choiceSelected,
                disabled && styles.disabled,
                pressed && !disabled && styles.pressed,
              ]}
            >
              <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {message ? <Text style={styles.fieldError}>{message}</Text> : null}
    </View>
  );
}

function TextField({
  label,
  field,
  value,
  disabled,
  error,
  t,
  onChange,
  keyboardType = 'default',
  multiline = false,
}) {
  const message = fieldErrorText(error, t);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={`report-${field}`}
        accessibilityLabel={label}
        accessibilityHint={message}
        aria-invalid={Boolean(error)}
        editable={!disabled}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        inputMode={keyboardType === 'number-pad' ? 'numeric' : undefined}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        autoCorrect
        style={[
          styles.input,
          multiline && styles.textArea,
          error && styles.inputError,
          disabled && styles.inputDisabled,
        ]}
      />
      {message ? <Text style={styles.fieldError}>{message}</Text> : null}
    </View>
  );
}

export default function ReportFormScreen({
  draft,
  loading = false,
  error = null,
  onBackToCamera,
  queueDraft,
  syncDraft,
  submitDependencies = {},
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => createEmptyReportFormDraft());
  const submit = useSubmitReport({
    draft,
    queueDraft,
    syncDraft,
    ...submitDependencies,
  });
  const canEdit = draft?.local_state === REPORT_DRAFT_STATE.DRAFT && !submit.submitting;
  const frozen = draft?.local_state && draft.local_state !== REPORT_DRAFT_STATE.DRAFT;
  const validation = draft?.photo_validation;
  const photoUri = draft?.photo_file_uri;
  const statusError = submit.error ?? draft?.last_error ?? error;
  const generalError = reportErrorText(statusError, t);

  useEffect(() => {
    setForm(createEmptyReportFormDraft());
  }, [draft?.id]);

  useEffect(() => {
    if (submit.phase === 'success') {
      AccessibilityInfo.announceForAccessibility(t('reportForm.successTitle'));
    }
  }, [submit.phase, t]);

  function updateField(field, value) {
    if (!canEdit) return;
    setForm((current) => ({ ...current, [field]: value }));
    submit.clearFieldError(field);
  }

  const incidentOptions = useMemo(
    () => INCIDENT_TYPES.map((value) => ({
      value,
      label: t(`reportForm.incidents.${value}`),
    })),
    [t],
  );
  const sightingOptions = useMemo(
    () => SIGHTING_TYPES.map((value) => ({
      value,
      label: t(`reportForm.sighting.${value}`),
    })),
    [t],
  );
  const sizeOptions = useMemo(
    () => DOG_SIZES.map((value) => ({
        value,
        label: t(`reportForm.dogSize.${value}`),
      })),
    [t],
  );
  const collarOptions = useMemo(
    () => ['no_se', 'si', 'no'].map((value) => ({
      value,
      label: t(`reportForm.collar.${value}`),
    })),
    [t],
  );
  const yesNoOptions = useMemo(
    () => ['si', 'no'].map((value) => ({
      value,
      label: t(`reportForm.boolean.${value}`),
    })),
    [t],
  );
  const injuredDogOptions = useMemo(
    () => INJURED_DOG_SITUATIONS.map((value) => ({
      value,
      label: t(`reportForm.situations.${value}`),
    })),
    [t],
  );

  function submitForm() {
    void submit.submit(form);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('reportForm.close')}
              disabled={submit.submitting}
              onPress={onBackToCamera}
              style={({ pressed }) => [styles.closeButton, pressed && !submit.submitting && styles.pressed]}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
            <Text accessibilityRole="header" style={styles.title}>{t('reportForm.title')}</Text>
            <View style={styles.headerSpacer} />
          </View>

          {loading ? (
            <View style={styles.state}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.subtitle}>{t('reportForm.loading')}</Text>
            </View>
          ) : null}

          {error && !draft ? (
            <View style={styles.errorBanner} accessibilityRole="alert">
              <Text style={styles.errorTitle}>{t('reportForm.draftErrorTitle')}</Text>
              <Text style={styles.errorBody}>{generalError}</Text>
            </View>
          ) : null}

          {draft ? (
            <>
              <View style={styles.photoCard}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
                ) : (
                  <View style={styles.noPhoto} />
                )}
              </View>

              {frozen ? (
                <View style={styles.notice}>
                  <Text style={styles.noticeTitle}>{t('reportForm.frozenTitle')}</Text>
                  <Text style={styles.noticeText}>{t('reportForm.frozenBody')}</Text>
                </View>
              ) : null}

              {submit.phase === 'success' ? (
                <View testID="report-success" style={styles.success} accessibilityRole="alert">
                  <Text style={styles.successTitle}>{t('reportForm.successTitle')}</Text>
                  <Text style={styles.successText}>{t('reportForm.successBody')}</Text>
                </View>
              ) : null}

              {submit.phase === 'photo_pending' ? (
                <View testID="report-photo-pending" style={styles.notice} accessibilityRole="alert">
                  <Text style={styles.noticeTitle}>{t('reportForm.photoPendingTitle')}</Text>
                  <Text style={styles.noticeText}>{t('reportForm.photoPendingBody')}</Text>
                </View>
              ) : null}

              {generalError ? (
                <View style={styles.errorBanner} accessibilityRole="alert">
                  <Text style={styles.errorTitle}>{t('reportForm.errorTitle')}</Text>
                  <Text style={styles.errorBody}>{generalError}</Text>
                </View>
              ) : null}

              <View style={[styles.section, styles.incidentSection]}>
                <SelectField
                  label={t('reportForm.fields.incident_type')}
                  field="incident_type"
                  value={form.incident_type}
                  options={incidentOptions}
                  disabled={!canEdit}
                  error={submit.fieldErrors.incident_type}
                  t={t}
                  onChange={(value) => updateField('incident_type', value)}
                />
                {form.incident_type === 'ataque_humano' ? (
                  <ChoiceGroup
                    label={t('reportForm.fields.hubo_mordida')}
                    field="hubo_mordida"
                    value={form.hubo_mordida}
                    options={yesNoOptions}
                    disabled={!canEdit}
                    error={submit.fieldErrors.hubo_mordida}
                    t={t}
                    onChange={(value) => updateField('hubo_mordida', value)}
                  />
                ) : null}
                {form.incident_type === 'ataque_mascota' || form.incident_type === 'ataque_ganado' ? (
                  <TextField
                    label={t('reportForm.fields.tipo_animal')}
                    field="tipo_animal"
                    value={form.tipo_animal}
                    disabled={!canEdit}
                    error={submit.fieldErrors.tipo_animal}
                    t={t}
                    onChange={(value) => updateField('tipo_animal', value)}
                  />
                ) : null}
                {form.incident_type === 'ataque_mascota' ? (
                  <ChoiceGroup
                    label={t('reportForm.fields.resulto_herido')}
                    field="resulto_herido"
                    value={form.resulto_herido}
                    options={[
                      { value: null, label: t('reportForm.boolean.no_se') },
                      ...yesNoOptions,
                    ]}
                    disabled={!canEdit}
                    error={submit.fieldErrors.resulto_herido}
                    t={t}
                    onChange={(value) => updateField('resulto_herido', value)}
                  />
                ) : null}
                {form.incident_type === 'ataque_ganado' ? (
                  <TextField
                    label={t('reportForm.fields.cantidad_afectada')}
                    field="cantidad_afectada"
                    value={form.cantidad_afectada}
                    disabled={!canEdit}
                    error={submit.fieldErrors.cantidad_afectada}
                    t={t}
                    keyboardType="number-pad"
                    onChange={(value) => updateField('cantidad_afectada', value)}
                  />
                ) : null}
                {form.incident_type === 'perro_lastimado' ? (
                  <ChoiceGroup
                    label={t('reportForm.fields.situacion')}
                    field="situacion"
                    value={form.situacion}
                    options={injuredDogOptions}
                    disabled={!canEdit}
                    error={submit.fieldErrors.situacion}
                    t={t}
                    onChange={(value) => updateField('situacion', value)}
                  />
                ) : null}
                {form.incident_type === 'otro' ? (
                  <Text style={styles.caption}>{t('reportForm.onlyDescription')}</Text>
                ) : null}
              </View>

              <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>{t('reportForm.sections.details')}</Text>
                <ChoiceGroup
                  label={t('reportForm.fields.sighting_type')}
                  field="sighting_type"
                  value={form.sighting_type}
                  options={sightingOptions}
                  disabled={!canEdit}
                  error={submit.fieldErrors.sighting_type}
                  t={t}
                  onChange={(value) => updateField('sighting_type', value)}
                />
                {form.incident_type === 'avistamiento_simple' && form.sighting_type === 'manada' ? (
                  <TextField
                    label={t('reportForm.fields.cantidad_aprox')}
                    field="cantidad_aprox"
                    value={form.cantidad_aprox}
                    disabled={!canEdit}
                    error={submit.fieldErrors.cantidad_aprox}
                    t={t}
                    keyboardType="number-pad"
                    onChange={(value) => updateField('cantidad_aprox', value)}
                  />
                ) : null}
              </View>

              <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>{t('reportForm.sections.dog')}</Text>
                <ChoiceGroup
                  label={t('reportForm.fields.dog_size')}
                  field="dog_size"
                  value={form.dog_size}
                  options={sizeOptions}
                  disabled={!canEdit}
                  error={submit.fieldErrors.dog_size}
                  t={t}
                  onChange={(value) => updateField('dog_size', value)}
                  allowDeselect
                />
                <ChoiceGroup
                  label={t('reportForm.fields.has_collar')}
                  field="has_collar"
                  value={form.has_collar}
                  options={collarOptions}
                  disabled={!canEdit}
                  error={submit.fieldErrors.has_collar}
                  t={t}
                  onChange={(value) => updateField('has_collar', value)}
                />
              </View>

              <View style={styles.section}>
                <TextField
                  label={t('reportForm.fields.descripcion')}
                  field="descripcion"
                  value={form.descripcion}
                  disabled={!canEdit}
                  error={submit.fieldErrors.descripcion}
                  t={t}
                  multiline
                  onChange={(value) => updateField('descripcion', value)}
                />
              </View>

              <View style={styles.honeypot} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <TextInput
                  testID="report-honeypot-website"
                  value={form.honeypot_website}
                  onChangeText={(value) => updateField('honeypot_website', value)}
                  editable={canEdit}
                  autoComplete="url"
                />
                <TextInput
                  testID="report-honeypot-contact"
                  value={form.honeypot_contact}
                  onChangeText={(value) => updateField('honeypot_contact', value)}
                  editable={canEdit}
                  autoComplete="email"
                />
              </View>
            </>
          ) : null}
        </ScrollView>

        {draft ? (
          <View style={styles.footer}>
            <View style={styles.footerInner}>
              <Button
                testID="report-submit"
                title={submit.submitting ? t('reportForm.submitting') : frozen ? t('reportForm.retrySubmit') : t('reportForm.submit')}
                busy={submit.submitting}
                disabled={submit.submitting || draft.local_state === REPORT_DRAFT_STATE.SYNCED || draft.local_state === REPORT_DRAFT_STATE.TERMINAL_ERROR}
                onPress={submitForm}
              />
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 920, alignSelf: 'center', padding: 22, paddingBottom: 24, gap: 16, backgroundColor: colors.background },
  header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  closeText: { color: '#363d33', fontFamily: bodyFont, fontSize: 32, lineHeight: 36 },
  headerSpacer: { width: 44, height: 44 },
  title: { color: colors.ink, fontFamily: boldFont, fontSize: 21, lineHeight: 28, textAlign: 'center' },
  subtitle: { color: colors.muted, fontFamily: bodyFont, fontSize: 14, lineHeight: 22 },
  state: { paddingVertical: 28, gap: 14, alignItems: 'center' },
  photoCard: { height: 136, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  preview: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', opacity: 0.74, zIndex: 0 },
  noPhoto: { ...StyleSheet.absoluteFillObject, backgroundColor: '#fff', zIndex: 0 },
  section: { backgroundColor: colors.surface, borderWidth: 1, borderColor: '#dde4d8', borderRadius: 12, padding: 16, gap: 16, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  incidentSection: {},
  sectionTitle: { color: colors.ink, fontFamily: semiBoldFont, fontSize: 18, lineHeight: 24 },
  fieldGroup: { gap: 8 },
  dropdownGroup: {},
  label: { color: colors.ink, fontFamily: semiBoldFont, fontSize: 14, lineHeight: 20 },
  select: { minHeight: 52, borderRadius: 8, borderWidth: 1, borderColor: colors.outline, backgroundColor: '#f8fbf3', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  selectText: { color: colors.ink, fontFamily: bodyFont, fontSize: 16, lineHeight: 24, flexShrink: 1 },
  selectChevron: { color: colors.muted, fontFamily: bodyFont, fontSize: 13 },
  selectBackdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(25,29,23,0.16)' },
  selectDismissArea: { ...StyleSheet.absoluteFillObject },
  selectSheet: { width: '100%', maxWidth: 420, alignSelf: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#e0e6db', backgroundColor: colors.surface, overflow: 'hidden' },
  selectSheetTitle: { color: colors.ink, fontFamily: boldFont, fontSize: 15, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#edf1e9' },
  selectOption: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#edf1e9' },
  selectOptionSelected: { backgroundColor: colors.soft },
  selectOptionText: { color: colors.ink, fontFamily: bodyFont, fontSize: 14 },
  selectOptionTextSelected: { color: colors.primary, fontFamily: semiBoldFont },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  choice: { flexGrow: 1, flexBasis: 92, maxWidth: 160, minHeight: 38, borderRadius: 8, borderWidth: 1, borderColor: colors.outline, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  choiceSelected: { backgroundColor: colors.soft, borderColor: colors.primary },
  choiceText: { color: colors.ink, fontFamily: bodyFont, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  choiceTextSelected: { color: colors.primary, fontFamily: semiBoldFont },
  input: { borderWidth: 1, borderColor: colors.outline, borderRadius: 8, backgroundColor: '#fff', color: colors.ink, paddingHorizontal: 13, paddingVertical: 12, minHeight: 48, fontFamily: bodyFont, fontSize: 16, lineHeight: 24 },
  textArea: { minHeight: 104 },
  inputError: { borderColor: colors.danger, borderWidth: 2, backgroundColor: '#fffaf9' },
  inputDisabled: { opacity: 0.65 },
  fieldError: { color: colors.danger, fontFamily: bodyFont, fontSize: 13, lineHeight: 19 },
  caption: { color: colors.muted, fontFamily: bodyFont, fontSize: 12, lineHeight: 18 },
  errorBanner: { backgroundColor: colors.dangerSoft, borderColor: '#f3b3ad', borderWidth: 1, borderRadius: 12, padding: 14, gap: 5 },
  errorTitle: { color: colors.danger, fontFamily: boldFont, fontSize: 15 },
  errorBody: { color: '#5f1414', fontFamily: bodyFont, fontSize: 13, lineHeight: 19 },
  success: { backgroundColor: colors.soft, borderRadius: 12, padding: 14, gap: 4 },
  successTitle: { color: colors.primary, fontFamily: boldFont, fontSize: 15 },
  successText: { color: colors.primary, fontFamily: bodyFont, fontSize: 13, lineHeight: 19 },
  notice: { backgroundColor: colors.warningSoft, borderColor: '#e8cf8e', borderWidth: 1, borderRadius: 12, padding: 14, gap: 4 },
  noticeTitle: { color: colors.warning, fontFamily: boldFont, fontSize: 15 },
  noticeText: { color: '#4b3a12', fontFamily: bodyFont, fontSize: 13, lineHeight: 19 },
  footer: { borderTopWidth: 1, borderColor: '#eef2ea', backgroundColor: colors.background, padding: 14 },
  footerInner: { width: '100%', maxWidth: 880, alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { flexGrow: 1, minHeight: 48, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  buttonText: { color: '#fff', fontFamily: semiBoldFont, fontSize: 18, lineHeight: 24, textAlign: 'center' },
  secondaryButton: { backgroundColor: '#fff', borderColor: colors.outline, borderWidth: 1 },
  secondaryButtonText: { color: colors.primary },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  honeypot: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, left: -9999, top: -9999 },
});
