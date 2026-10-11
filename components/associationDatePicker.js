/**
 * @module components/associationDatePicker
 * Presentational modal month calendar for picking one day between five years ago and today.
 */
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

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

  const monthLabel = month.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const firstWeekday = month.getDay();
  const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: dayCount }, (_, index) => index + 1)];
  while (cells.length % 7) cells.push(null);
  const previousMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const monthBeforeMinimum = nextMonth <= monthStart(earliest);
  const monthAfterMaximum = monthStart(today) <= month;

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <View accessibilityViewIsModal style={styles.dialog}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.monthRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={previousMonthLabel} disabled={monthBeforeMinimum}
            onPress={() => setMonth(previousMonth)} style={[styles.navButton, monthBeforeMinimum && styles.disabled]}>
            <Text style={styles.navText}>‹</Text>
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={styles.monthLabel}>{monthLabel}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={nextMonthLabel} disabled={monthAfterMaximum}
            onPress={() => setMonth(nextMonth)} style={[styles.navButton, monthAfterMaximum && styles.disabled]}>
            <Text style={styles.navText}>›</Text>
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
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(16, 28, 16, 0.45)' },
  dialog: { width: '100%', maxWidth: 380, padding: 20, borderRadius: 18, backgroundColor: '#fff' },
  title: { color: '#172117', fontSize: 18, fontWeight: '700', marginBottom: 14 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#edf4ea' },
  navText: { color: '#005a25', fontSize: 27, lineHeight: 30 },
  monthLabel: { color: '#172117', fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', paddingVertical: 8, color: '#61705e', textAlign: 'center', fontSize: 12, fontWeight: '600' },
  dayCell: { width: '14.2857%', height: 42, alignItems: 'center', justifyContent: 'center' },
  dayButton: { borderRadius: 21 },
  dayText: { color: '#172117', fontSize: 14 },
  selectedDay: { backgroundColor: '#005a25' },
  selectedDayText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.35 },
  cancelButton: { alignSelf: 'flex-end', paddingVertical: 10, paddingHorizontal: 14, marginTop: 12 },
  cancelText: { color: '#005a25', fontWeight: '700' },
});
