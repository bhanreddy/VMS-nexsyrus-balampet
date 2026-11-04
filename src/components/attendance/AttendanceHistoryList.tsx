import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View, ViewToken } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { useAttendanceHistory } from '../../hooks/useAttendanceHistory';
import type { AttendanceRecord } from '../../types/models';
import type { Theme } from '../../theme/themes';
import { getAttendanceStatusColors } from './ParentAttendanceCalendar';

const STATUS_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  present: 'checkmark-circle', absent: 'close-circle', holiday: 'calendar', half_day: 'time', leave: 'time', late: 'alert-circle',
};
const STATUS_LABELS: Record<string, string> = { present: 'Present', absent: 'Absent', holiday: 'Holiday', half_day: 'Half Day', leave: 'On Leave', late: 'Late' };

const HistoryCard = memo(function HistoryCard({ record, revealed, dateLocale }: { record: AttendanceRecord; revealed: boolean; dateLocale: string }) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();
  // Cards remain readable even if a platform delays viewability events.
  const progress = useSharedValue(1);
  const animatedOnce = useRef(revealed);
  useEffect(() => {
    if (revealed && !animatedOnce.current) {
      animatedOnce.current = true;
      progress.value = 0;
      progress.value = withTiming(1, { duration: 320, reduceMotion: ReduceMotion.System });
    }
  }, [revealed, progress]);
  const animation = useAnimatedStyle(() => ({ opacity: 0.75 + progress.value * 0.25, transform: [{ translateY: (1 - progress.value) * 18 }] }));
  const [year, month, day] = record.attendance_date.slice(0, 10).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const status = record.status.toLowerCase();
  const color = getAttendanceStatusColors(theme.dark)[status] ?? theme.colors.textSecondary;
  return (
    <Animated.View style={[styles.card, animation]}>
      <View style={[styles.dateBox, { backgroundColor: color + (theme.dark ? '24' : '15') }]}>
        <Text style={[styles.weekday, { color }]}>{date.toLocaleDateString(dateLocale, { weekday: 'short' })}</Text>
        <Text style={[styles.day, { color }]}>{date.getDate()}</Text>
      </View>
      <View style={styles.description}>
        <Text style={styles.secondary}>{date.toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        <Text style={[styles.status, { color }]}>{t(`attendance_screen.${status}`, STATUS_LABELS[status] ?? record.status)}</Text>
      </View>
      <Ionicons name={STATUS_ICONS[status] ?? 'help-circle'} size={28} color={color} />
    </Animated.View>
  );
});

interface Props {
  studentId?: string;
  userId?: string;
  enabled: boolean;
  dateLocale: string;
  header: React.ReactElement;
  onRefresh: () => Promise<void>;
}

export default function AttendanceHistoryList({ studentId, userId, enabled, dateLocale, header, onRefresh }: Props) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();
  const history = useAttendanceHistory(studentId, userId, enabled);
  const refreshHistory = history.refresh;
  const [refreshing, setRefreshing] = useState(false);
  const seen = useRef(new Set<string>());
  const [revealed, setRevealed] = useState(new Set<string>());
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<AttendanceRecord>[] }) => {
    let changed = false;
    for (const token of viewableItems) {
      if (token.isViewable && !seen.current.has(token.item.attendance_date)) {
        seen.current.add(token.item.attendance_date);
        changed = true;
      }
    }
    if (changed) setRevealed(new Set(seen.current));
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 15 }).current;
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await Promise.all([onRefresh(), refreshHistory()]); }
    finally { setRefreshing(false); }
  }, [onRefresh, refreshHistory]);

  return (
    <FlatList
      style={{ flex: 1 }}
      removeClippedSubviews={false}
      data={history.records}
      keyExtractor={item => item.attendance_date.slice(0, 10)}
      renderItem={({ item }) => <HistoryCard record={item} dateLocale={dateLocale} revealed={revealed.has(item.attendance_date)} />}
      extraData={revealed}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={<View style={styles.header}>{header}<View style={styles.historyHeading}><Text accessibilityRole="header" style={styles.title}>{t('attendance_screen.year_history', 'Academic year attendance')}</Text><Text style={styles.secondary}>{history.academicYear ? `${history.academicYear} · ` : ''}{t('attendance_screen.year_history_hint', 'Current academic year · newest first')}</Text></View></View>}
      ListFooterComponent={<View style={styles.footer}>
        {!enabled ? null : history.loading ? <ActivityIndicator color={theme.colors.primary} accessibilityLabel={t('attendance_screen.loading_history', 'Loading attendance history')} /> : history.error ? <><Text style={styles.secondary}>{t('attendance_screen.history_error', 'Could not load attendance history.')}</Text><Pressable accessibilityRole="button" accessibilityLabel={t('attendance_screen.retry_history', 'Retry attendance history')} onPress={history.retry} style={styles.retry}><Text style={styles.retryText}>{t('attendance_screen.retry', 'Try again')}</Text></Pressable></> : history.records.length === 0 ? <Text style={styles.secondary}>{t('attendance_screen.no_records', 'No attendance records found.')}</Text> : !history.hasMore ? <Text style={styles.secondary}>{t('attendance_screen.year_history_end', 'All attendance records for this academic year are shown.')}</Text> : <Pressable accessibilityRole="button" onPress={history.loadMore} style={styles.retry}><Text style={styles.retryText}>{t('attendance_screen.load_more', 'Load older records')}</Text></Pressable>}
      </View>}
      onScroll={({ nativeEvent: { contentOffset, layoutMeasurement, contentSize } }) => {
        // Web may delay FlatList's end-reached measurement behind a tall header.
        if (layoutMeasurement.height > 0 && contentOffset.y + layoutMeasurement.height >= contentSize.height - 240) history.loadMore();
      }}
      scrollEventThrottle={100}
      onEndReached={history.loadMore}
      onEndReachedThreshold={0.4}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
      // Keep fetched year records mounted on web: its viewport measurements can
      // stall below a tall calendar header. Requests remain paginated.
      initialNumToRender={Platform.OS === 'web' ? Math.max(20, history.records.length) : 8}
      maxToRenderPerBatch={20}
      windowSize={7}
    />
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 48, width: '100%', maxWidth: 572, alignSelf: 'center' },
  header: { gap: 22, marginBottom: 12 },
  historyHeading: { gap: 5 },
  title: { color: theme.colors.textStrong, fontSize: 16, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 12, marginBottom: 12, borderRadius: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, shadowColor: '#17132B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: theme.dark ? 0.12 : 0.04, shadowRadius: 4, elevation: 1 },
  dateBox: { width: 60, height: 60, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 2 },
  weekday: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  day: { fontSize: 22, fontWeight: '700' },
  description: { flex: 1, gap: 5 },
  secondary: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 },
  status: { fontSize: 16, fontWeight: '600' },
  footer: { alignItems: 'center', padding: 16, gap: 8 },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  retryText: { color: theme.colors.primary, fontWeight: '600' },
});
