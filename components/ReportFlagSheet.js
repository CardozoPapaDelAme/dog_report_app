/**
 * @module components/ReportFlagSheet
 * Bottom sheet for anonymously flagging a public report: reason, optional detail with a length
 * counter, and a neutral outcome message.
 */
import { useState, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FINAL_FLAG_OUTCOMES, sendReportFlag } from '../hooks/reportFlagSubmit.js';
import { getOrCreateDeviceFingerprint } from '../hooks/deviceFingerprint';
import { FLAG_DETAIL_MAX, FLAG_REASONS, flagDetailLength } from '../models/reportFlag.js';
import { colors, fontFamily, radius, spacing, type } from '../theme/index.js';
import { AppButton, Sheet } from './ui/index.js';

// Anonymous report flag form. Shows only neutral outcomes: never moderation status, counts or thresholds.
/**
 * @param {object} props
 * @param {import('../models/publicMap.js').PublicReport} props.report - Report being flagged.
 * @param {() => void} props.onClose
 * @param {(key: string, options?: object) => string} props.t - Translation function.
 * @param {typeof sendReportFlag} [props.send=sendReportFlag] - Submits the flag with the device fingerprint.
 * @returns {JSX.Element}
 */
export default function ReportFlagSheet({ report, onClose, t, send = sendReportFlag }) {
  const [reason, setReason] = useState(null);
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState(null);

  const length = flagDetailLength(detail.trim());
  const tooLong = length > FLAG_DETAIL_MAX;
  const done = outcome !== null && FINAL_FLAG_OUTCOMES.includes(outcome.key);
  const canSubmit = reason !== null && !tooLong && !submitting;

  // A ref blocks a second tap that lands before the `submitting` state re-renders.
  const inFlight = useRef(false);
  const submit = async () => {
    if (!canSubmit || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setOutcome(null);
    try {
      const result = await send({ reportId: report.report_id, reason, detail }, { getFingerprint: getOrCreateDeviceFingerprint });
      setOutcome(result);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const message = outcome ? t(`flag.outcome.${outcome.key}`, { minutes: outcome.retryAfterMinutes }) : null;
  const success = outcome?.key === 'submitted';
  return (
    <Sheet keyboardAware testID="flag-sheet" onClose={onClose} dismissable={!submitting} maxHeight="92%">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.title}>{t('flag.title')}</Text>
        {message ? (
          <View accessibilityRole="alert" style={[styles.notice, success && styles.noticeOk]}>
            <Text style={[styles.noticeText, success && styles.noticeTextOk]}>{message}</Text>
          </View>
        ) : null}
        {done ? null : (
          <>
            <Text style={styles.label}>{t('flag.reasonLabel')}</Text>
            <View accessibilityRole="radiogroup" style={styles.reasons}>
              {FLAG_REASONS.map((value) => {
                const checked = reason === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked, disabled: submitting }}
                    aria-checked={checked}
                    disabled={submitting}
                    onPress={() => setReason(value)}
                    style={[styles.reason, checked && styles.reasonChecked]}
                  >
                    <View style={[styles.radio, checked && styles.radioChecked]}>{checked ? <View style={styles.radioDot} /> : null}</View>
                    <Text style={[styles.reasonText, checked && styles.reasonTextChecked]}>{t(`flag.reasons.${value}`)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.label}>{t('flag.detailLabel')}</Text>
            <TextInput
              accessibilityLabel={t('flag.detailLabel')}
              editable={!submitting}
              multiline
              onChangeText={setDetail}
              style={styles.input}
              value={detail}
            />
            <Text style={[styles.counter, tooLong && styles.counterError]}>
              {t('flag.counter', { count: length, max: FLAG_DETAIL_MAX })}
            </Text>
            {tooLong ? <Text accessibilityRole="alert" style={styles.counterError}>{t('flag.tooLong', { max: FLAG_DETAIL_MAX })}</Text> : null}
            <AppButton
              title={t(submitting ? 'flag.sending' : 'flag.submit')}
              disabled={!canSubmit}
              onPress={submit}
              style={canSubmit ? styles.submit : styles.submitIdle}
            />
          </>
        )}
        <AppButton title={t(done ? 'map.close' : 'flag.cancel')} variant="secondary" onPress={onClose} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  title: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 32, color: colors.ink },
  label: { fontFamily: fontFamily.label, fontSize: 14, color: colors.inkMuted, marginTop: spacing.sm },
  notice: { borderRadius: radius.md, backgroundColor: colors.dangerSoft, padding: spacing.md },
  noticeOk: { backgroundColor: colors.primarySoft },
  noticeText: { fontFamily: fontFamily.label, fontSize: 14, color: colors.onDangerSoft },
  noticeTextOk: { color: colors.primary },
  reasons: { gap: spacing.sm },
  reason: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.md, borderColor: colors.outlineSoft, borderWidth: 1, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  reasonChecked: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderColor: colors.outline, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  radioChecked: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  reasonText: { ...type.body, fontSize: 15, color: colors.ink, flexShrink: 1 },
  reasonTextChecked: { fontFamily: fontFamily.label, color: colors.primary },
  input: { ...type.body, minHeight: 88, borderRadius: radius.sm, borderColor: colors.outline, borderWidth: 1, backgroundColor: colors.surface, padding: spacing.md, color: colors.ink, textAlignVertical: 'top' },
  counter: { fontFamily: fontFamily.labelMedium, fontVariant: ['tabular-nums'], fontSize: 12, color: colors.inkMuted, textAlign: 'right' },
  counterError: { fontFamily: fontFamily.label, fontSize: 12, color: colors.danger },
  submit: { backgroundColor: colors.danger, borderColor: colors.danger, marginTop: spacing.xs },
  submitIdle: { marginTop: spacing.xs },
});
