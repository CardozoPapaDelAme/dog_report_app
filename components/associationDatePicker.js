/**
 * @module components/associationDatePicker
 * Presentational modal month calendar for picking one day between five years ago and today.
 */
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from './ui/Icon.js';
import { colors, fontFamily, radius, spacing } from '../theme/index.js';

/** Formats a local date as `YYYY-MM-DD`. */
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthStart(value) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {string} props.value - Selected day, `YYYY-MM-DD`.
 * @param {string} props.title
 * @param {string} props.locale - Locale for month, weekday and day labels.
 * @param {string} props.previousMonthLabel - Accessibility label.
 * @param {string} props.nextMonthLabel - Accessibility label.
 * @param {string} props.cancelLabel
 * @param {(day: string) => void} props.onSelect - Receives the chosen day as `YYYY-MM-DD`.
 * @param {() => void} props.onClose
 * @returns {JSX.Element}
 */
export default function AssociationDatePicker({ visible, value, title, locale, previousMonthLabel, nextMonthLabel, cancelLabel, onSelect, onClose }) {
  const selected = useMemo(() => new Date(`${value}T12:00:00`), [value]);
  const [month, setMonth] = useState(() => monthStart(selected));
  const today = useMemo(() => new Date(), []);
  const earliest = useMemo(() => new Date(today.getFullYear() - 5, today.getMonth(), today.getDate()), [today]);

  useEffect(() => {
    if (visible) setMonth(monthStart(selected));
  }, [visible, selected]);

  const rawMonthLabel = month.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const monthLabel = rawMonthLabel.charAt(0).toUpperCase() + rawMonthLabel.slice(1);
  const firstWeekday = month.getDay();
  const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: dayCount }, (_, index) => index + 1)];
  while (cells.length % 7) cells.push(null);
  const previousMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const monthBeforeMinimum = nextMonth <= monthStart(earliest);
  const monthAfterMaximum = monthStart(today) <= month;

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <Pressable accessible={false} aria-hidden importantForAccessibility="no" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View accessibilityViewIsModal style={styles.dialog}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.monthRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={previousMonthLabel} disabled={monthBeforeMinimum}
            onPress={() => setMonth(previousMonth)} style={[styles.navButton, monthBeforeMinimum && styles.disabled]}>
            <Icon name="back" size={22} color={colors.primary} />
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={styles.monthLabel}>{monthLabel}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={nextMonthLabel} disabled={monthAfterMaximum}
            onPress={() => setMonth(nextMonth)} style={[styles.navButton, monthAfterMaximum && styles.disabled]}>
            <Icon name="forward" size={22} color={colors.primary} />
          </Pressable>
        </View>
        <View style={styles.grid}>
          {Array.from({ length: 7 }, (_, index) => {
            const weekday = new Date(2023, 0, 1 + index).toLocaleDateString(locale, { weekday: 'short' });
            return <Text key={`weekday-${index}`} style={styles.weekday}>{weekday}</Text>;
          })}
          {cells.map((day, index) => {
            if (day === null) return <View key={`blank-${index}`} style={styles.dayCell} />;
            const date = new Date(month.getFullYear(), month.getMonth(), day);
            const key = dateKey(date);
            const disabled = date < earliest || date > today;
            const active = key === value;
            const dayLabel = date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
            return <Pressable key={key} accessibilityRole="button" accessibilityLabel={dayLabel}
              accessibilityState={{ selected: active, disabled }} disabled={disabled} onPress={() => onSelect(key)}
              style={[styles.dayCell, styles.dayButton, active && styles.selectedDay, disabled && styles.disabled]}>
              <Text style={[styles.dayText, active && styles.selectedDayText]}>{day}</Text>
            </Pressable>;
          })}
        </View>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelButton}>
          <Text style={styles.cancelText}>{cancelLabel}</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  dialog: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: spacing.xl, paddingBottom: spacing.xxxl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.surface },
  title: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 32, color: colors.ink, marginBottom: spacing.lg },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  navButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  monthLabel: { fontFamily: fontFamily.displayMedium, fontSize: 18, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', paddingVertical: spacing.sm, color: colors.inkMuted, textAlign: 'center', fontFamily: fontFamily.label, fontSize: 12 },
  dayCell: { width: '14.2857%', height: 44, alignItems: 'center', justifyContent: 'center' },
  dayButton: { borderRadius: 22 },
  dayText: { fontFamily: fontFamily.labelMedium, fontVariant: ['tabular-nums'], fontSize: 15, color: colors.ink },
  selectedDay: { backgroundColor: colors.primary },
  selectedDayText: { color: colors.onPrimary, fontFamily: fontFamily.number },
  disabled: { opacity: 0.35 },
  cancelButton: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.md },
  cancelText: { fontFamily: fontFamily.label, fontSize: 15, color: colors.primary },
});
