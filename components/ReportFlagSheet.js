import { useState, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FINAL_FLAG_OUTCOMES, sendReportFlag } from '../hooks/reportFlagSubmit.js';
import { getOrCreateDeviceFingerprint } from '../hooks/deviceFingerprint';
import { FLAG_DETAIL_MAX, FLAG_REASONS, flagDetailLength } from '../models/reportFlag.js';

const colors = { ink: '#191d17', primary: '#00450d', muted: '#5d6859', line: '#e0e0e0', error: '#ba1a1a', errorSoft: '#ffdad6', ok: '#e6f4e1' };

// Anonymous report flag form. Shows only neutral outcomes: never moderation status, counts or thresholds.
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
    <View style={styles.sheet} testID="flag-sheet">
      <View style={styles.grabber} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.title}>{t('flag.title')}</Text>
        {message ? (
          <View accessibilityRole="alert" style={[styles.notice, success && styles.noticeOk]}>
            <Text style={styles.noticeText}>{message}</Text>
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
                    <View style={[styles.radio, checked && styles.radioChecked]} />
                    <Text style={styles.reasonText}>{t(`flag.reasons.${value}`)}</Text>
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
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
              disabled={!canSubmit}
              onPress={submit}
              style={[styles.submit, !canSubmit && styles.submitDisabled]}
            >
              <Text style={styles.submitText}>{t(submitting ? 'flag.sending' : 'flag.submit')}</Text>
            </Pressable>
          </>
        )}
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>{t(done ? 'map.close' : 'flag.cancel')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 16, elevation: 12 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginTop: 10 },
  content: { padding: 20, gap: 8 },
  title: { color: colors.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20 },
  label: { color: colors.muted, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, marginTop: 4 },
  notice: { borderRadius: 12, backgroundColor: colors.errorSoft, padding: 12 },
  noticeOk: { backgroundColor: colors.ok },
  noticeText: { color: colors.ink, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14 },
  reasons: { gap: 4 },
  reason: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderColor: colors.line, borderWidth: 1, paddingHorizontal: 12 },
  reasonChecked: { borderColor: colors.primary, backgroundColor: '#f1f8ee' },
  radio: { width: 20, height: 20, borderRadius: 10, borderColor: colors.muted, borderWidth: 2 },
  radioChecked: { borderColor: colors.primary, backgroundColor: colors.primary },
  reasonText: { color: colors.ink, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, flexShrink: 1 },
  input: { minHeight: 80, borderRadius: 12, borderColor: colors.line, borderWidth: 1, padding: 12, color: colors.ink, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, textAlignVertical: 'top' },
  counter: { color: colors.muted, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, textAlign: 'right' },
  counterError: { color: colors.error, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12 },
  submit: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.error, marginTop: 4 },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: '#ffffff', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  closeButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderColor: colors.line, borderWidth: 1, marginTop: 6 },
  closeText: { color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
});
