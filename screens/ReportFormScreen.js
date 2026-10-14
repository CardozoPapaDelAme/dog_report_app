/**
 * @module screens/ReportFormScreen
 * Container screen for the public report form of a local draft: photo preview, incident and dog
 * fields (dog color prefilled from on-device detection), submission through `useSubmitReport`, and
 * success, queued, photo pending and error dialogs. Fields are editable only while the draft is in
 * state `draft`.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Image,
  Keyboard,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useSubmitReport } from '../hooks/useSubmitReport.js';
import { DOG_COLORS, detectedDogColorFromDraft } from '../models/dogColor.js';
import { REPORT_DRAFT_STATE } from '../models/reportDraft.js';
import {
  photoStatusIsTerminal,
  photoStatusSucceeded,
} from '../models/photoState.js';
import {
  createEmptyReportFormDraft,
  INCIDENT_TYPES,
  SIGHTING_TYPES,
  DOG_SIZES,
  INJURED_DOG_SITUATIONS,
} from '../models/reportPayload.js';
import { AppButton, Banner, Icon, PhotoViewer, Sheet } from '../components/ui/index.js';
import { colors, fontFamily, layout, radius, spacing, type } from '../theme/index.js';

/** Translates a field validation error (`{key, values}`) or returns a string error as is. */
function fieldErrorText(error, t) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return t(`reportForm.validation.${error.key}`, error.values);
}

/** Single-choice field; the option list opens in a sheet owned by the screen (`onOpen`). */
function SelectField({ label, field, value, options, disabled, error, t, onOpen, expanded }) {
  const message = fieldErrorText(error, t);
  const selected = options.find((option) => option.value === value);
  return (
    <View style={[styles.fieldGroup, styles.dropdownGroup]}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        testID={`report-${field}-select`}
        accessibilityRole="button"
        accessibilityState={{ expanded, disabled: Boolean(disabled) }}
        disabled={disabled}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.select,
          error && styles.inputError,
          disabled && styles.inputDisabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <Text numberOfLines={1} style={styles.selectText}>{selected?.label ?? t('reportForm.selectPlaceholder')}</Text>
        <Icon name="down" size={20} color={colors.primary} />
      </Pressable>
      {message ? <Text style={styles.fieldError}>{message}</Text> : null}
    </View>
  );
}

/** Translated message for a submission error code, with a generic fallback. */
function reportErrorText(error, t) {
  if (!error) return '';
  return t(`reportForm.errors.${error.code}`, {
    defaultValue: t('reportForm.errors.request_failed'),
  });
}

function reportErrorCode(error) {
  return error?.code ?? 'request_failed';
}

/** Rejection code of a terminal, unsuccessful photo status; `null` otherwise. */
function photoRejectedInfo(draft) {
  const status = draft?.photo_status;
  if (!status || !photoStatusIsTerminal(status) || photoStatusSucceeded(status)) {
    return null;
  }
  return {
    code: status.rejection_code ?? status.state ?? 'photo_not_uploaded',
  };
}

/** Element identity props for a text input; web also receives `id` and `name`. */
function textInputIdentity(id, name) {
  if (Platform.OS !== 'web') {
    return { nativeID: id };
  }
  return { id, name, nativeID: id };
}

/** Pelt colors drawn on the color chips; `mixto` is split in two tones. */
const COAT_COLORS = { negro: '#222622', blanco: '#f6f4ee', 'café': '#6b4226', gris: '#8c918c', dorado: '#d9a441' };

/** Round color sample for a dog color option. */
function CoatDot({ value, large = false }) {
  const dotStyle = large ? [styles.dot, styles.dotLarge] : styles.dot;
  if (value === 'mixto') {
    return (
      <View style={dotStyle}>
        <View style={[styles.dotHalf, { backgroundColor: '#222622' }]} />
        <View style={[styles.dotHalf, { backgroundColor: '#f6f4ee' }]} />
      </View>
    );
  }
  return <View style={[dotStyle, { backgroundColor: COAT_COLORS[value] ?? colors.outline }]} />;
}

/** Paw that grows with the dog size, so the options read at a glance. */
function SizePaw({ value, selected }) {
  const size = { chico: 15, mediano: 21, grande: 27 }[value];
  return size ? <Icon name="dog" size={size} color={selected ? colors.onPrimary : colors.primary} /> : null;
}

/** Segmented control for short lists (two or three options): one piece, selected segment filled. */
function Segmented({ label, field, value, options, disabled, error, t, onChange, allowDeselect = false, adornment }) {
  const message = fieldErrorText(error, t);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segmented}>
        {options.map((option, index) => {
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
                styles.segment,
                index > 0 && styles.segmentDivider,
                selected && styles.segmentSelected,
                disabled && styles.disabled,
                pressed && !disabled && styles.pressed,
              ]}
            >
              {adornment ? adornment(option.value, selected) : null}
              <Text numberOfLines={2} style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {message ? <Text style={styles.fieldError}>{message}</Text> : null}
    </View>
  );
}

/** Single row of coat-color circles; the chosen color's name sits next to the label. */
function CoatSwatches({ label, field, value, options, disabled, error, t, onChange }) {
  const message = fieldErrorText(error, t);
  const chosen = options.find((option) => option.value === value);
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {chosen ? <Text style={styles.chosenName}>{chosen.label}</Text> : null}
      </View>
      <View style={styles.swatchRow}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              testID={`report-${field}-${option.value}`}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected, disabled: Boolean(disabled) }}
              disabled={disabled}
              onPress={() => onChange(selected ? '' : option.value)}
              style={({ pressed }) => [styles.swatchHit, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
            >
              <View style={[styles.swatchRing, selected && styles.swatchRingSelected]}>
                <CoatDot value={option.value} large />
              </View>
            </Pressable>
          );
        })}
      </View>
      {message ? <Text style={styles.fieldError}>{message}</Text> : null}
    </View>
  );
}

/** Group of option chips; `allowDeselect` lets a second tap clear the value. */
function ChoiceGroup({ label, field, value, options, disabled, error, t, onChange, allowDeselect = false, adornment, soft = false }) {
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
                adornment && styles.choiceWithAdornment,
                selected && (soft ? styles.choiceSoftSelected : styles.choiceSelected),
                disabled && styles.disabled,
                pressed && !disabled && styles.pressed,
              ]}
            >
              {adornment ? adornment(option.value, selected) : null}
              <Text style={[styles.choiceText, selected && (soft ? styles.choiceTextSoftSelected : styles.choiceTextSelected)]}>
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
  const inputId = `report-${field}`;
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={inputId}
        {...textInputIdentity(inputId, field)}
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

/**
 * @param {object} props
 * @param {import('../models/reportDraft.js').ReportDraft | null} props.draft - Active draft.
 * @param {boolean} [props.loading=false] - Draft is being created.
 * @param {{code?: string} | null} [props.error=null] - Draft creation or queue error.
 * @param {() => void} props.onBackToCamera
 * @param {(id: string, options: object) => Promise<import('../models/reportDraft.js').ReportDraft>} props.queueDraft
 * @param {(id: string) => Promise<import('../models/reportDraft.js').ReportDraft | null>} props.syncDraft
 * @param {object} [props.submitDependencies] - Extra `useSubmitReport` options (e.g. `getDeviceFingerprint`).
 * @returns {JSX.Element}
 */
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
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState(() => createEmptyReportFormDraft());
  const [picker, setPicker] = useState(null);
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const submit = useSubmitReport({
    draft,
    queueDraft,
    syncDraft,
    ...submitDependencies,
  });
  const canEdit = draft?.local_state === REPORT_DRAFT_STATE.DRAFT && !submit.submitting;
  const frozen = draft?.local_state && draft.local_state !== REPORT_DRAFT_STATE.DRAFT;
  const validation = draft?.photo_validation;
  const detectedColor = detectedDogColorFromDraft(draft);
  const photoUri = draft?.photo_file_uri;
  const showPhoto = Boolean(draft && photoUri && !photoFailed);
  const submittedDraft = submit.submittedDraft ?? draft;
  const photoRejection = photoRejectedInfo(submittedDraft);
  const statusError = submit.error ?? draft?.last_error ?? error;
  const generalError = reportErrorText(statusError, t);
  const showSuccessDialog = submit.phase === 'success' || submit.phase === 'photo_rejected';
  const showQueuedDialog = submit.phase === 'retry_wait';
  const showErrorDialog = Boolean(
    draft &&
      generalError &&
      !showSuccessDialog &&
      !showQueuedDialog &&
      submit.phase !== 'photo_pending' &&
      !submit.submitting,
  );

  // The form only makes room for the keyboard while one is really on screen.
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    setPhotoFailed(false);
    setForm({ ...createEmptyReportFormDraft(), dog_color: detectedDogColorFromDraft(draft) });
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
  const colorOptions = useMemo(
    () => DOG_COLORS.map((value) => ({
      value,
      label: t(`reportForm.dogColor.${value}`),
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

  function retrySubmit() {
    void submit.submit(form);
  }

  const fullScreenResult = showSuccessDialog || showQueuedDialog;

  return (
    <View style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} enabled={keyboardVisible && !picker && !viewingPhoto} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={[styles.topRow, { paddingTop: insets.top + spacing.sm }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('reportForm.close')}
              disabled={submit.submitting}
              onPress={onBackToCamera}
              style={({ pressed }) => [styles.closeButton, pressed && !submit.submitting && styles.pressed]}
            >
              <Icon name="close" size={22} color={colors.primary} />
            </Pressable>
          </View>
          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              <Text accessibilityRole="header" style={styles.title}>{t('reportForm.title')}</Text>
              {showPhoto ? <Text style={styles.photoHint}>{t('reportForm.viewPhoto')}</Text> : null}
            </View>
            {showPhoto ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('reportForm.photoPreview')}
                onPress={() => { Keyboard.dismiss(); setViewingPhoto(true); }}
                style={({ pressed }) => [styles.thumb, pressed && styles.pressed]}
              >
                <Image accessible={false} source={{ uri: photoUri }} style={styles.thumbImage} resizeMode="cover" onError={() => setPhotoFailed(true)} />
              </Pressable>
            ) : draft ? (
              <View testID="report-no-photo" style={[styles.thumb, styles.thumbEmpty]}>
                <Icon name="dog" size={26} color={colors.primary} />
                <Text style={styles.thumbEmptyText}>{t('reportForm.noPhoto')}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.body}>
            {loading ? (
              <View style={styles.state}>
                <Text style={styles.subtitle}>{t('reportForm.loading')}</Text>
              </View>
            ) : null}

            {error && !draft ? (
              <View accessibilityRole="alert">
                <Banner tone="error" title={t('reportForm.draftErrorTitle')} message={generalError} />
              </View>
            ) : null}

            {draft ? (
              <>
                {submit.phase === 'photo_pending' ? (
                  <View testID="report-photo-pending" accessibilityRole="alert">
                    <Banner tone="warning" title={t('reportForm.photoPendingTitle')} message={t('reportForm.photoPendingBody')} />
                  </View>
                ) : null}

                {submit.phase === 'photo_rejected' || photoRejection ? (
                  <View testID="report-photo-rejected" accessibilityRole="alert">
                    <Banner
                      tone="warning"
                      title={t('reportForm.photoRejectedTitle')}
                      message={t('reportForm.photoRejectedBody', { code: photoRejection?.code ?? 'photo_not_uploaded' })}
                    />
                  </View>
                ) : null}

                <View style={styles.section}>
                  <SelectField
                    label={t('reportForm.fields.incident_type')}
                    field="incident_type"
                    value={form.incident_type}
                    options={incidentOptions}
                    disabled={!canEdit}
                    error={submit.fieldErrors.incident_type}
                    t={t}
                    expanded={picker?.field === 'incident_type'}
                    onOpen={() => { Keyboard.dismiss(); setPicker({ field: 'incident_type', label: t('reportForm.fields.incident_type'), options: incidentOptions, onChange: (value) => updateField('incident_type', value) }); }}
                  />
                  {form.incident_type === 'ataque_humano' ? (
                    <Segmented
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
                    <Segmented
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
                  <Segmented
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
                  <Segmented
                    label={t('reportForm.fields.dog_size')}
                    field="dog_size"
                    value={form.dog_size}
                    options={sizeOptions}
                    disabled={!canEdit}
                    error={submit.fieldErrors.dog_size}
                    t={t}
                    onChange={(value) => updateField('dog_size', value)}
                    allowDeselect
                    adornment={(value, selected) => <SizePaw value={value} selected={selected} />}
                  />
                  <CoatSwatches
                    label={t('reportForm.fields.dog_color')}
                    field="dog_color"
                    value={form.dog_color}
                    options={colorOptions}
                    disabled={!canEdit}
                    error={submit.fieldErrors.dog_color}
                    t={t}
                    onChange={(value) => updateField('dog_color', value)}
                  />
                  {detectedColor ? (
                    <Text testID="report-dog_color-detected" style={styles.colorHint}>
                      {t('reportForm.dogColorDetected', { color: t(`reportForm.dogColor.${detectedColor}`) })}
                    </Text>
                  ) : null}
                  <Segmented
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
                  <View testID="report-privacy-warning" style={styles.privacy}>
                    <Icon name="shield" size={20} color={colors.primary} />
                    <View style={styles.privacyText}>
                      <Text style={styles.privacyTitle}>{t('reportForm.privacyTitle')}</Text>
                      <Text style={styles.privacyBody}>{t('reportForm.privacyBody')}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.honeypot} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                  <TextInput
                    testID="report-honeypot-website"
                    {...textInputIdentity('report-honeypot-website', 'honeypot_website')}
                    value={form.honeypot_website}
                    onChangeText={(value) => updateField('honeypot_website', value)}
                    editable={canEdit}
                    autoComplete="url"
                  />
                  <TextInput
                    testID="report-honeypot-contact"
                    {...textInputIdentity('report-honeypot-contact', 'honeypot_contact')}
                    value={form.honeypot_contact}
                    onChangeText={(value) => updateField('honeypot_contact', value)}
                    editable={canEdit}
                    autoComplete="email"
                  />
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>

        {draft ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View style={styles.footerInner}>
              <AppButton
                testID="report-submit"
                variant="signal"
                size="lg"
                title={submit.submitting ? t('reportForm.submitting') : frozen ? t('reportForm.retrySubmit') : t('reportForm.submit')}
                loading={submit.submitting}
                disabled={submit.submitting || draft.local_state === REPORT_DRAFT_STATE.SYNCED || draft.local_state === REPORT_DRAFT_STATE.TERMINAL_ERROR}
                onPress={submitForm}
                style={styles.submit}
              />
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <Modal visible={fullScreenResult} transparent animationType="fade" onRequestClose={onBackToCamera}>
        <View style={styles.resultFull}>
          <View
            testID={showSuccessDialog ? 'report-success' : 'report-queued'}
            style={styles.resultFullBody}
            accessibilityViewIsModal
            accessibilityRole="alert"
          >
            <View pointerEvents="none" accessible={false} aria-hidden importantForAccessibility="no" style={styles.resultPaw}>
              <Icon name="dog" size={240} color={colors.onPrimary} strokeWidth={1.3} />
            </View>
            <View style={styles.resultText}>
              <Text style={styles.resultTitle}>{showSuccessDialog ? t('reportForm.successTitle') : t('reportForm.queuedTitle')}</Text>
              <Text style={styles.resultBody}>{showSuccessDialog ? t('reportForm.successBody') : t('reportForm.queuedBody')}</Text>
            </View>
            <View style={styles.resultActions}>
              <AppButton
                testID={showSuccessDialog ? 'report-success-back' : 'report-queued-back'}
                title={t('reportForm.resultBack')}
                variant="signal"
                size="lg"
                onPress={onBackToCamera}
              />
            </View>
          </View>
        </View>
      </Modal>

      {viewingPhoto && showPhoto ? <PhotoViewer uri={photoUri} label={t('reportForm.photoPreview')} closeLabel={t('reportForm.close')} onClose={() => setViewingPhoto(false)} /> : null}

      {picker ? (
        <Sheet modal onClose={() => setPicker(null)} maxHeight="80%" style={styles.pickerSheet}>
          <Text accessibilityRole="header" style={styles.selectSheetTitle}>{picker.label}</Text>
          {picker.options.map((option) => (
            <Pressable
              key={option.value}
              testID={`report-${picker.field}-${option.value}`}
              accessibilityRole="button"
              accessibilityState={{ selected: form[picker.field] === option.value }}
              onPress={() => { picker.onChange(option.value); setPicker(null); }}
              style={({ pressed }) => [styles.selectOption, form[picker.field] === option.value && styles.selectOptionSelected, pressed && styles.pressed]}
            >
              <Text style={[styles.selectOptionText, form[picker.field] === option.value && styles.selectOptionTextSelected]}>{option.label}</Text>
              {form[picker.field] === option.value ? <Icon name="check" size={20} color={colors.primary} strokeWidth={3} /> : null}
            </Pressable>
          ))}
        </Sheet>
      ) : null}

      {showErrorDialog ? (
        <Sheet modal testID="report-error" onClose={onBackToCamera} maxHeight="70%" style={styles.errorSheet}>
          <View accessibilityViewIsModal accessibilityRole="alert" style={styles.errorBody}>
            <Text style={styles.resultTitleError}>{t('reportForm.errorTitle')}</Text>
            <Text style={styles.resultBodyError}>{t('reportForm.errorCode', { code: reportErrorCode(statusError) })}</Text>
            <View style={styles.resultActions}>
              <AppButton testID="report-error-retry" title={t('reportForm.resultRetry')} loading={submit.submitting} disabled={submit.submitting} onPress={retrySubmit} />
              <AppButton testID="report-error-back" title={t('reportForm.resultBack')} variant="secondary" onPress={onBackToCamera} />
            </View>
          </View>
        </Sheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.primary },
  content: { flexGrow: 1, backgroundColor: colors.background },
  topRow: { paddingHorizontal: layout.margin },
  closeButton: { width: layout.minTouch, height: layout.minTouch, marginLeft: -spacing.sm, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg, paddingHorizontal: layout.margin, paddingTop: spacing.xs },
  titleText: { flex: 1, gap: spacing.xs },
  title: { fontFamily: fontFamily.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.3, color: colors.primary },
  photoHint: { ...type.caption, color: colors.inkMuted },
  thumb: { width: 92, height: 92, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.primarySoft },
  thumbImage: { width: '100%', height: '100%' },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1, borderColor: colors.outlineSoft, borderStyle: 'dashed', backgroundColor: colors.surface },
  thumbEmptyText: { fontFamily: fontFamily.label, fontSize: 13, color: colors.primary },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md },
  chosenName: { fontFamily: fontFamily.label, fontSize: 14, color: colors.primary },
  segmented: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surface, overflow: 'hidden' },
  segment: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  segmentDivider: { borderLeftWidth: 1, borderLeftColor: colors.outline },
  segmentSelected: { backgroundColor: colors.primary },
  segmentText: { flexShrink: 1, fontFamily: fontFamily.labelMedium, fontSize: 15, lineHeight: 19, color: colors.ink, textAlign: 'center' },
  segmentTextSelected: { fontFamily: fontFamily.label, color: colors.onPrimary },
  swatchRow: { flexDirection: 'row', justifyContent: 'space-between' },
  swatchHit: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  swatchRing: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  swatchRingSelected: { borderColor: colors.primary },
  dotLarge: { width: 32, height: 32, borderRadius: 16 },
  body: { width: '100%', maxWidth: 920, alignSelf: 'center', paddingHorizontal: layout.margin, paddingTop: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.xl },
  subtitle: { ...type.body, color: colors.inkMuted },
  state: { paddingVertical: spacing.xxl, alignItems: 'center' },
  section: { gap: spacing.xl },
  sectionTitle: { fontFamily: fontFamily.display, fontSize: 24, lineHeight: 30, color: colors.primary },
  fieldGroup: { gap: spacing.sm },
  dropdownGroup: {},
  label: { fontFamily: fontFamily.label, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  select: { minHeight: 52, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  selectText: { ...type.body, color: colors.ink, flexShrink: 1 },
  selectBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  selectDismissArea: { ...StyleSheet.absoluteFill },
  selectSheet: { width: '100%', maxWidth: 520, alignSelf: 'center', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.surface, paddingTop: spacing.xl, paddingBottom: spacing.xxl, overflow: 'hidden' },
  selectSheetTitle: { fontFamily: fontFamily.display, fontSize: 24, lineHeight: 30, color: colors.ink, paddingHorizontal: layout.margin, paddingBottom: spacing.md },
  selectOption: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: layout.margin, borderTopWidth: 1, borderTopColor: colors.border },
  selectOptionSelected: { backgroundColor: colors.primarySoft },
  selectOptionText: { ...type.body, color: colors.ink },
  selectOptionTextSelected: { fontFamily: fontFamily.label, color: colors.primary },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { flexGrow: 1, flexBasis: 92, minHeight: layout.minTouch, borderRadius: radius.md, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  choiceWithAdornment: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', paddingHorizontal: spacing.md },
  choiceSoftSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary, borderWidth: 2 },
  choiceTextSoftSelected: { fontFamily: fontFamily.label, color: colors.primary },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.outline, overflow: 'hidden', flexDirection: 'row' },
  dotHalf: { flex: 1 },
  choiceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { flexShrink: 1, fontFamily: fontFamily.labelMedium, fontSize: 15, lineHeight: 20, color: colors.ink, textAlign: 'center' },
  choiceTextSelected: { fontFamily: fontFamily.label, color: colors.onPrimary },
  input: { ...type.input, borderWidth: 1, borderColor: colors.outline, borderRadius: radius.sm, backgroundColor: colors.surface, color: colors.ink, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 48 },
  textArea: { minHeight: 112, lineHeight: 22 },
  inputError: { borderColor: colors.danger, borderWidth: 2, backgroundColor: '#fffaf9' },
  inputDisabled: { opacity: 0.65 },
  colorHint: { ...type.caption, color: colors.inkMuted },
  fieldError: { ...type.caption, fontSize: 13, color: colors.danger },
  caption: { ...type.caption, color: colors.inkMuted },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  privacyText: { flex: 1, gap: 2 },
  privacyTitle: { fontFamily: fontFamily.label, fontSize: 14, lineHeight: 19, color: colors.primary },
  privacyBody: { ...type.caption, color: colors.inkMuted },
  footer: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  footerInner: { width: '100%', maxWidth: 880, alignSelf: 'center' },
  submit: { borderRadius: 12 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  honeypot: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, left: -9999, top: -9999 },
  resultFull: { flex: 1, backgroundColor: colors.primary },
  resultFullBody: { flex: 1, justifyContent: 'space-between', padding: layout.margin, paddingTop: spacing.xxxl * 2, paddingBottom: spacing.xxxl, overflow: 'hidden' },
  resultPaw: { position: 'absolute', right: -60, top: '30%', opacity: 0.1, transform: [{ rotate: '-18deg' }] },
  pickerSheet: { paddingHorizontal: 0, paddingTop: spacing.xl, paddingBottom: spacing.xxl, gap: 0 },
  errorSheet: { paddingBottom: spacing.xxxl },
  errorBody: { gap: spacing.lg },
  resultBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  resultSheet: { width: '100%', maxWidth: 520, alignSelf: 'center', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.surface, padding: layout.margin, paddingBottom: spacing.xxxl, gap: spacing.xl },
  resultText: { gap: spacing.md, justifyContent: 'center', flexGrow: 1 },
  resultTitle: { fontFamily: fontFamily.display, fontSize: 44, lineHeight: 50, letterSpacing: -0.5, color: colors.onPrimary },
  resultTitleError: { fontFamily: fontFamily.display, fontSize: 30, lineHeight: 36, color: colors.danger },
  resultBody: { ...type.body, fontSize: 17, lineHeight: 25, color: colors.onForest, maxWidth: 420 },
  resultBodyError: { ...type.body, fontSize: 17, lineHeight: 25, color: colors.ink },
  resultActions: { gap: spacing.md },
});
