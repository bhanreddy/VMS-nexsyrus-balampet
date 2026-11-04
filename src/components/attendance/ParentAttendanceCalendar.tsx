import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import type { AttendanceRecord } from '../../types/models';

export const attendanceDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const attendanceStatusColors: Record<string, string> = {
  present: '#55F294',
  absent: '#FF5268',
  leave: '#7DD3FC',
  late: '#FFB64D',
  half_day: '#FFD35D',
  holiday: '#BC9BFF',
};

const lightStatusColors: Record<string, string> = {
  present: '#14815B', absent: '#CE4058', leave: '#147CA8',
  late: '#A16814', half_day: '#A7790D', holiday: '#7951B0',
};

export const getAttendanceStatusColors = (dark: boolean) => dark ? attendanceStatusColors : lightStatusColors;

const getCalendarPalette = (dark: boolean) => ({
  dark,
  surface: dark ? ['#39385F', '#252D55', '#1C2549', '#343059'] as const : ['#FFFFFF', '#F8F7FD', '#F0EFF9', '#F8F6FC'] as const,
  sheen: dark ? ['#CCB5DD35', '#9B91D910', '#6587FF00'] as const : ['#E4DCF530', '#FFFFFF10', '#FFFFFF00'] as const,
  arrows: dark ? ['#536CBA', '#253C79', '#1B2B58'] as const : ['#FFFFFF', '#F0ECFA', '#E7E0F5'] as const,
  day: dark ? ['#3B456680', '#26345199', '#1B294780'] as const : ['#FFFFFF', '#F2F0F8', '#ECEAF5'] as const,
  presentDay: dark ? ['#314C64', '#233D53', '#1B2C47'] as const : ['#EFFAF4', '#E4F4EC', '#DCEFE5'] as const,
  absentDay: dark ? ['#BA4268', '#D62D51', '#70244E'] as const : ['#FFF2F4', '#FCE5EA', '#F8D8E1'] as const,
  text: dark ? '#F5F1FF' : '#30284C',
  secondary: dark ? '#CFD3EE' : '#625B7B',
  muted: dark ? '#9B9FC1' : '#817B95',
  border: dark ? '#BBC3FF55' : '#DDD8EC',
  dayBorder: dark ? '#C5D5FF15' : '#E5E0EF',
  arrowBorder: dark ? '#A6BAFF55' : '#DDD6ED',
  icon: dark ? '#E2D4FF' : '#7960AC',
  today: dark ? '#B9B4EF' : '#9A82CA',
  absentBorder: dark ? '#F86A8E80' : '#EAB1BF',
});

const statusFallbacks: Record<string, string> = {
  present: 'Present', absent: 'Absent', leave: 'On Leave',
  late: 'Late', half_day: 'Half Day', holiday: 'Holiday',
};

interface Props {
  month: Date;
  selectedDate: string;
  records: readonly AttendanceRecord[];
  dateLocale: string;
  loading?: boolean;
  onMonthChange: (month: Date) => void;
  onSelectDate: (date: string) => void;
}

function ParentAttendanceCalendar({ month, selectedDate, records, dateLocale, loading, onMonthChange, onSelectDate }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const palette = useMemo(() => getCalendarPalette(theme.dark), [theme.dark]);
  const styles = useMemo(() => getStyles(palette), [palette]);
  const statusColors = getAttendanceStatusColors(theme.dark);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const monthLabel = month.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' });
  const recordsByDate = useMemo(() => new Map(records.map(record => [record.attendance_date.slice(0, 10), record])), [records]);
  const days = useMemo(() => {
    const offset = new Date(year, monthIndex, 1).getDay();
    const count = Math.ceil((offset + new Date(year, monthIndex + 1, 0).getDate()) / 7) * 7;
    return Array.from({ length: count }, (_, index) => new Date(year, monthIndex, index - offset + 1));
  }, [year, monthIndex]);
  const legendStatuses = ['present', 'absent', ...['leave', 'late', 'half_day', 'holiday'].filter(status => records.some(record => record.status === status))];

  return (
    <View style={styles.shadow}>
      <LinearGradient colors={palette.surface} locations={[0, 0.35, 0.7, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <LinearGradient pointerEvents="none" colors={palette.sheen} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.header}>
          <View style={styles.heading}>
            <View style={styles.calendarIcon}><Ionicons name="calendar" size={19} color={palette.icon} /></View>
            <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.month}>{monthLabel}</Text>
          </View>
          <View style={styles.navigation}>
            {([-1, 1] as const).map(direction => (
              <Pressable key={direction} accessibilityRole="button" accessibilityLabel={direction < 0 ? t('attendance_screen.previous_month', 'Previous month') : t('attendance_screen.next_month', 'Next month')} onPress={() => onMonthChange(new Date(year, monthIndex + direction, 1))} style={({ pressed }) => [styles.arrowTarget, pressed && styles.pressed]}>
                <LinearGradient colors={palette.arrows} style={styles.arrow}>
                  <Ionicons name={direction < 0 ? 'chevron-back' : 'chevron-forward'} size={19} color={palette.text} />
                </LinearGradient>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.weekdays}>
          {Array.from({ length: 7 }, (_, day) => (
            <Text key={day} style={styles.weekday}>{new Date(2026, 10, 1 + day).toLocaleDateString(dateLocale, { weekday: 'short' })}</Text>
          ))}
        </View>
        <View style={styles.grid} accessibilityLabel={monthLabel} accessibilityState={{ busy: !!loading }}>
          {days.map(date => {
            const dateKey = attendanceDateKey(date);
            const inMonth = date.getMonth() === monthIndex;
            const status = inMonth ? recordsByDate.get(dateKey)?.status.toLowerCase() : undefined;
            const selected = inMonth && dateKey === selectedDate;
            const color = status ? getAttendanceStatusColors(theme.dark || selected)[status] : undefined;
            const absent = status === 'absent';
            const today = dateKey === attendanceDateKey(new Date());
            const colors: readonly [string, string, string] = selected ? ['#3D9AFF', '#1263FF', '#172BBE']
              : absent ? palette.absentDay
              : status === 'present' ? palette.presentDay
              : palette.day;
            const statusLabel = status ? t(`attendance_screen.${status}`, statusFallbacks[status] ?? status) : t('attendance_screen.not_recorded', 'No attendance recorded');
            return (
              <View key={dateKey} style={styles.daySlot}>
                <Pressable disabled={!inMonth || loading} accessibilityRole="button" accessibilityState={{ selected, disabled: !inMonth || !!loading }} accessibilityLabel={`${date.toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })}, ${statusLabel}`} onPress={() => onSelectDate(dateKey)} style={({ pressed }) => [styles.dayPressable, !inMonth && styles.outsideMonth, selected && styles.selectedGlow, absent && !selected && styles.absentGlow, pressed && styles.pressed]}>
                  <LinearGradient colors={colors} style={[styles.day, selected && styles.selectedDay, absent && !selected && styles.absentDay, today && !selected && styles.todayDay]}>
                    <Text style={[styles.dayNumber, !inMonth && styles.mutedNumber, selected && styles.selectedNumber]}>{date.getDate()}</Text>
                    <View style={styles.dotSlot}>{color && <View style={[styles.dot, { backgroundColor: color, shadowColor: color }]} />}</View>
                  </LinearGradient>
                </Pressable>
              </View>
            );
          })}
        </View>
        <View style={styles.legend}>
          {legendStatuses.map(status => (
            <View key={status} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: statusColors[status] }]} />
              <Text style={styles.legendLabel}>{t(`attendance_screen.${status}`, statusFallbacks[status])}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </View>
  );
}

export default memo(ParentAttendanceCalendar);

const getStyles = (palette: ReturnType<typeof getCalendarPalette>) => StyleSheet.create({
  shadow: { borderRadius: 25, shadowColor: '#6656BD', shadowOffset: { width: 0, height: 9 }, shadowOpacity: palette.dark ? 0.2 : 0.08, shadowRadius: 16, elevation: 5 },
  card: { borderRadius: 25, borderWidth: 1, borderColor: palette.border, padding: 12, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  calendarIcon: { width: 27, height: 29, alignItems: 'center', justifyContent: 'center', shadowColor: palette.icon, shadowOpacity: palette.dark ? 0.9 : 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  month: { color: palette.text, fontWeight: '700', fontSize: 18, flexShrink: 1 },
  navigation: { flexDirection: 'row', gap: 2 },
  arrowTarget: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  arrow: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderColor: palette.arrowBorder },
  pressed: { opacity: 0.7 },
  weekdays: { flexDirection: 'row', marginBottom: 7 },
  weekday: { width: '14.285714%', textAlign: 'center', fontSize: 11, color: palette.secondary, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  daySlot: { width: '14.285714%', paddingHorizontal: 3, paddingVertical: 2 },
  dayPressable: { borderRadius: 11, minHeight: 40 },
  day: { minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingTop: 2, borderTopWidth: 1, borderColor: palette.dayBorder },
  dayNumber: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: palette.text },
  mutedNumber: { color: palette.muted },
  outsideMonth: { opacity: palette.dark ? 0.48 : 0.7 },
  dotSlot: { height: 8, justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, shadowOffset: { width: 0, height: 0 }, shadowOpacity: palette.dark ? 1 : 0, shadowRadius: 5, elevation: palette.dark ? 2 : 0 },
  selectedGlow: { shadowColor: '#246BFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: palette.dark ? 1 : 0.25, shadowRadius: palette.dark ? 10 : 5, elevation: 4 },
  todayDay: { borderWidth: 1, borderColor: palette.today },
  selectedDay: { borderWidth: 1, borderColor: '#64C5FF' },
  selectedNumber: { color: '#FFFFFF', fontWeight: '700' },
  absentGlow: { shadowColor: '#FF3D66', shadowOffset: { width: 0, height: 0 }, shadowOpacity: palette.dark ? 0.65 : 0, shadowRadius: 7, elevation: palette.dark ? 3 : 0 },
  absentDay: { borderWidth: 1, borderColor: palette.absentBorder },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 15, rowGap: 8, marginTop: 13, paddingBottom: 5 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendLabel: { fontSize: 11, color: palette.secondary, fontWeight: '500' },
});
