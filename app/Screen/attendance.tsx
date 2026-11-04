import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TourTarget } from '@/src/features/app-tour';
import * as Haptics from '@/src/utils/haptics';
import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import ParentAttendanceCalendar, { attendanceDateKey, getAttendanceStatusColors } from '../../src/components/attendance/ParentAttendanceCalendar';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import AttendanceHistoryList from '../../src/components/attendance/AttendanceHistoryList';
import LogoLoader from '../../src/components/LogoLoader';
import { useAuth } from '../../src/hooks/useAuth';
import { useStudentQuery } from '../../src/hooks/useStudentQuery';
import { useTheme } from '../../src/hooks/useTheme';
import type { AttendanceResponse, Student } from '../../src/types/models';
import type { Theme } from '../../src/theme/themes';
import { isTelugu } from '../../src/utils/lang';
import { isStudentRole } from '../../src/utils/roleHelpers';

const STATUS_FALLBACKS: Record<string, string> = {
  present: 'Present', absent: 'Absent', leave: 'On Leave',
  holiday: 'Holiday', late: 'Late', half_day: 'Half Day',
};

function AttendanceScreenInner() {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const statusColors = getAttendanceStatusColors(theme.dark);
  const { t, i18n } = useTranslation();
  const dateLocale = isTelugu(i18n.language) ? 'te-IN' : 'en-IN';
  const { user, role } = useAuth();
  const portalEligible = isStudentRole(role);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [pickedDate, setSelectedDate] = useState<string | null>(() => attendanceDateKey(new Date()));
  const fromDate = attendanceDateKey(month);
  const toDate = attendanceDateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));

  const { data: profile, loading: profileLoading, error: profileError, refetch: refetchProfile } = useStudentQuery<Student>(
    '/students/profile/me', 'profile', 3 * 60 * 1000, user?.userId,
    { enabled: !!user?.userId && portalEligible }
  );
  const pid = profile?.id;
  const { data: attendance, loading: attendanceLoading, error: attendanceError, refetch } = useStudentQuery<AttendanceResponse>(
    pid ? `/students/${pid}/attendance` : '/notices',
    `attendance:${pid}:${fromDate}`, 90 * 1000, user?.userId,
    { enabled: !!pid && portalEligible, query: { from_date: fromDate, to_date: toDate } }
  );

  // Keep cached records scoped to the visible month during navigation.
  const records = useMemo(() => (attendance?.records ?? []).filter(record => {
    const date = record.attendance_date.slice(0, 10);
    return date >= fromDate && date <= toDate;
  }).sort((a, b) => b.attendance_date.localeCompare(a.attendance_date)), [attendance?.records, fromDate, toDate]);
  const todayKey = attendanceDateKey(new Date());
  const currentMonth = todayKey.slice(0, 7) === fromDate.slice(0, 7);
  const latestRecordDate = records.map(record => record.attendance_date.slice(0, 10)).sort().at(-1);
  const selectedDate = pickedDate ?? (currentMonth ? todayKey : latestRecordDate ?? fromDate);
  const monthLabel = month.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' });
  const selectedRecord = records.find(record => record.attendance_date.slice(0, 10) === selectedDate);
  const status = selectedRecord?.status.toLowerCase();
  const loading = profileLoading || attendanceLoading;
  const error = profileError || attendanceError;
  const stats = attendance?.summary;
  const effectivePresent = Number(stats?.effective_present ?? (Number(stats?.present || 0) + Number(stats?.late || 0) + Number(stats?.half_day || 0) * 0.5));
  const percentage = stats?.total ? Math.max(0, Math.min(100, Math.round(Number(stats.attendance_percentage ?? effectivePresent / stats.total * 100)))) : 0;
  const statusColor = statusColors[status ?? ''] ?? (theme.dark ? '#C8C0FF' : '#7161B5');
  // Parse date-only strings as local dates, so a timezone offset cannot shift the day.
  const [year, monthNumber, day] = selectedDate.split('-').map(Number);
  const selectedLabel = new Date(year, monthNumber - 1, day).toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const onMonthChange = useCallback((nextMonth: Date) => {
    setMonth(nextMonth);
    const today = new Date();
    setSelectedDate(today.getFullYear() === nextMonth.getFullYear() && today.getMonth() === nextMonth.getMonth() ? attendanceDateKey(today) : null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const goToToday = () => {
    const today = new Date();
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(attendanceDateKey(today));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (pid) await refetch();
    else await refetchProfile();
  }, [pid, refetch, refetchProfile]);

  const header = (
    <View style={styles.workspace}>
      <View style={styles.toolbar}>
        <View style={styles.toolbarText}><Text style={styles.eyebrow}>{t('attendance_screen.overview', 'Daily attendance')}</Text><Text style={styles.secondary}>{t('attendance_screen.tap_hint', 'Tap a date to see the details')}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('attendance_screen.go_today', 'Go to today')} onPress={goToToday} style={({ pressed }) => [styles.todayButton, pressed && { opacity: 0.65 }]}><Ionicons name="today-outline" size={16} color={theme.dark ? '#C8C0FF' : '#6554A3'} /><Text style={styles.todayText}>{t('attendance_screen.today', 'Today')}</Text></Pressable>
      </View>
      <ParentAttendanceCalendar month={month} selectedDate={selectedDate} records={records} dateLocale={dateLocale} loading={loading} onMonthChange={onMonthChange} onSelectDate={setSelectedDate} />
      {loading ? <LogoLoader size={48} color={theme.colors.primary} style={styles.loader} /> : error ? (
        <View style={styles.message}>
          <Text style={styles.secondary}>{t('attendance_screen.load_error', 'Could not load attendance. Pull down to try again.')}</Text>
          <Pressable accessibilityRole="button" onPress={onRefresh} style={styles.retry}><Text style={styles.retryText}>{t('attendance_screen.retry', 'Try again')}</Text></Pressable>
        </View>
      ) : (
        <>
          <View style={styles.detail} accessibilityLiveRegion="polite">
            <View style={[styles.detailIcon, { backgroundColor: status ? statusColor + (theme.dark ? '24' : '14') : theme.dark ? '#292A46' : '#EEEEFA' }]}><Ionicons name={status === 'present' ? 'checkmark-circle-outline' : status === 'absent' ? 'close-circle-outline' : 'calendar-outline'} size={25} color={statusColor} /></View>
            <View style={styles.detailText}>
              <Text style={styles.detailDate}>{selectedLabel}</Text>
              <Text style={styles.detailStatus}>{status ? t(`attendance_screen.${status}`, STATUS_FALLBACKS[status] ?? status) : t('attendance_screen.not_recorded', 'No attendance recorded')}</Text>
              {!status && <Text style={styles.secondary}>{selectedDate > todayKey ? t('attendance_screen.future_hint', 'Attendance will appear after this day is marked.') : t('attendance_screen.unmarked_hint', 'This date has not been marked by the school.')}</Text>}
            </View>
          </View>
          <View style={styles.summary}>
            <Text style={styles.eyebrow}>{t('attendance_screen.month_summary', 'Monthly summary')}</Text>
            <View style={styles.summaryHeading}>
              <View style={styles.detailText}><Text style={styles.summaryTitle}>{monthLabel}</Text><Text style={styles.secondary}>{stats?.total ?? 0} {t('attendance_screen.recorded_days', 'recorded days')}</Text></View>
              <View style={styles.rate}><Text style={styles.percentage}>{stats?.total ? `${percentage}%` : '—'}</Text><Text style={styles.secondary}>{t('attendance_screen.rate', 'Attendance')}</Text></View>
            </View>
            <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityLabel={t('attendance_screen.rate', 'Attendance')} accessibilityValue={stats?.total ? { min: 0, max: 100, now: percentage } : { text: t('attendance_screen.not_recorded', 'No attendance recorded') }}><View style={[styles.progressFill, { width: `${percentage}%` }]} /></View>
            <View style={styles.statRow}>
              {(['present', 'absent', 'half_day', ...(stats?.late ? ['late' as const] : [])] as const).map(key => (
                <View key={key} style={[styles.statItem, stats?.late ? { flexBasis: '44%' } : undefined]}>
                  <View style={styles.statLabelRow}><View style={[styles.statDot, { backgroundColor: statusColors[key] }]} /><Text style={styles.secondary}>{t(`attendance_screen.${key}`, STATUS_FALLBACKS[key])}</Text></View>
                  <Text style={styles.statValue}>{stats?.[key] ?? 0}</Text>
                </View>
              ))}
            </View>
            {!!stats?.half_day && <Text style={styles.calculationHint}>{t('attendance_screen.half_day_hint', 'A half day counts as ½ day of attendance.')}</Text>}
          </View>
          {records.length === 0 && <Text style={styles.empty}>{t('attendance_screen.no_month_records', 'No attendance records for this month.')}</Text>}
        </>
      )}
    </View>
  );

  return (
    <ScreenLayout style={{ backgroundColor: theme.dark ? '#101426' : '#F6F5FA' }}>
      <StudentHeader showBackButton title={t('attendance_screen.short_title', 'Attendance')} />
      <AttendanceHistoryList key={`${user?.userId}:${pid}`} studentId={pid} userId={user?.userId ?? undefined} enabled={portalEligible && !!pid} dateLocale={dateLocale} header={header} onRefresh={onRefresh} />
    </ScreenLayout>
  );
}

export default function AttendanceScreen() {
  return (
    <TourTarget id="screen.screen-attendance.overview" style={{ flex: 1 }}>
      <TourTarget id="screen.screen-attendance.workspace" style={{ flex: 1 }}>
        <ErrorBoundary><AttendanceScreenInner /></ErrorBoundary>
      </TourTarget>
    </TourTarget>
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  workspace: { width: '100%', maxWidth: 540, alignSelf: 'center', gap: 16 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toolbarText: { flex: 1, gap: 4 },
  eyebrow: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  todayButton: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: theme.dark ? '#2C2845' : '#ECE8F6' },
  todayText: { fontSize: 13, fontWeight: '700', color: theme.dark ? '#C8C0FF' : '#6554A3' },
  loader: { marginTop: 15, alignSelf: 'center' },
  summary: { backgroundColor: theme.colors.card, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: theme.colors.border },
  summaryHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 12, marginBottom: 16 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textStrong },
  rate: { alignItems: 'flex-end', gap: 2 },
  percentage: { color: theme.dark ? '#BFB5F5' : '#6554A3', fontSize: 30, fontWeight: '700', letterSpacing: -1 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: theme.dark ? '#34304B' : '#EDE9F5', overflow: 'hidden', marginBottom: 18 },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: theme.dark ? '#B6A4EB' : '#8C7AC8' },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statItem: { flexGrow: 1, flexBasis: '28%', borderRadius: 13, padding: 12, backgroundColor: theme.dark ? '#202438' : '#F7F6FA', gap: 8 },
  statValue: { color: theme.colors.textStrong, fontSize: 23, fontWeight: '700' },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statDot: { width: 6, height: 6, borderRadius: 3 },
  secondary: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, flexShrink: 1 },
  calculationHint: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 14 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  detailIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  detailText: { flex: 1, gap: 5 },
  detailDate: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 },
  detailStatus: { color: theme.colors.textStrong, fontSize: 16, fontWeight: '600' },
  empty: { color: theme.colors.textSecondary, fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  message: { alignItems: 'center', gap: 12, padding: 12 },
  retry: { padding: 12 },
  retryText: { color: theme.colors.primary, fontWeight: '600' },
});
