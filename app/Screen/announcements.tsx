import { TourTarget } from '@/src/features/app-tour';
import React, { useMemo, useCallback, useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn, Layout } from 'react-native-reanimated';
import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import type { Notice } from '../../src/services/commonServices';
import { useTheme } from '../../src/hooks/useTheme';
import type { SchoolTheme } from '../../src/hooks/useTheme';
import { t_field } from '../../src/utils/lang';
import LogoLoader from '../../src/components/LogoLoader';
import { useStudentQuery } from '../../src/hooks/useStudentQuery';
import { useAuth } from '../../src/hooks/useAuth';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import ReadAloudButton from '../../src/components/ReadAloudButton';
import { readAloudService } from '../../src/services/readAloudService';
import { useFocusEffect } from 'expo-router';
import * as Haptics from '../../src/utils/haptics';
import { schoolColorWithAlpha } from '../../src/constants/schoolConfig';

type FilterId = 'all' | 'important';

interface UINotice {
  id: string;
  title: string;
  title_te?: string;
  message: string;
  message_te?: string;
  date: string;
  time: string;
  important: boolean;
  authorName?: string;
  priority?: Notice['priority'];
}

type ListRow =
  | { kind: 'month'; id: string; label: string }
  | { kind: 'notice'; id: string; item: UINotice; isLast: boolean };

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const COLLAPSED_LINES = 3;

const noticeSortKeyMs = (n: Notice): number =>
  new Date(n.published_at || n.publish_at || n.created_at).getTime();

const sortNoticesNewestFirst = (data: Notice[]): Notice[] =>
  [...data].sort((a, b) => noticeSortKeyMs(b) - noticeSortKeyMs(a));

const ymdFromIso = (iso?: string): string => {
  if (!iso) return '';
  const stamp = iso.split('T')[0];
  return stamp || '';
};

const formatClock = (iso?: string, allDayLabel = 'All day'): string => {
  if (!iso || !iso.includes('T')) return allDayLabel;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return allDayLabel;
  const hours = date.getHours();
  const minutes = date.getMinutes();
  if (hours === 0 && minutes === 0) return allDayLabel;
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

const mapNoticesToUi = (data: Notice[], allDayLabel: string): UINotice[] =>
  data.map((n) => {
    const iso = n.published_at || n.publish_at || n.created_at;
    return {
      id: n.id,
      title: n.title,
      title_te: n.title_te,
      message: n.content,
      message_te: n.content_te,
      date: ymdFromIso(iso),
      time: formatClock(iso, allDayLabel),
      important: Boolean(n.is_pinned || n.priority === 'urgent' || n.priority === 'high'),
      authorName: n.author_name,
      priority: n.priority,
    };
  });

const startOfLocalDay = (value: Date) => {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const relativeDayKey = (ymd: string): 'today' | 'yesterday' | null => {
  if (!ymd || ymd.includes('/')) return null;
  const parts = ymd.split('-');
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) return null;
  const target = startOfLocalDay(new Date(year, month - 1, day));
  const today = startOfLocalDay(new Date());
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  return null;
};

const formatMonthLabel = (ymd: string, locale: string): string => {
  const parts = ymd.split('-');
  if (parts.length < 2) return ymd;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!year || !month) return ymd;
  try {
    return new Date(year, month - 1, 1).toLocaleDateString(locale.startsWith('te') ? 'te-IN' : 'en-IN', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return `${MONTHS[month - 1] || ''} ${year}`.trim();
  }
};

const buildListRows = (notices: UINotice[], locale: string): ListRow[] => {
  const rows: ListRow[] = [];
  let lastMonth = '';
  notices.forEach((item, index) => {
    const monthKey = item.date.slice(0, 7);
    if (monthKey && monthKey !== lastMonth) {
      lastMonth = monthKey;
      rows.push({
        kind: 'month',
        id: `month-${monthKey}`,
        label: formatMonthLabel(item.date, locale),
      });
    }
    rows.push({
      kind: 'notice',
      id: item.id,
      item,
      isLast: index === notices.length - 1,
    });
  });
  return rows;
};

const DateCol = memo(function DateCol({
  item,
  styles,
  todayLabel,
  yesterdayLabel,
}: {
  item: UINotice;
  styles: ReturnType<typeof getStyles>;
  todayLabel: string;
  yesterdayLabel: string;
}) {
  const { i18n } = useTranslation();
  const parts = useMemo(() => {
    if (!item.date || item.date.includes('/')) return null;
    const p = item.date.split('-');
    if (p.length !== 3) return null;
    const year = parseInt(p[0], 10);
    const monthNum = parseInt(p[1], 10);
    const day = parseInt(p[2], 10);
    if (!year || !monthNum || !day) return null;
    return {
      day,
      month: new Date(year, monthNum - 1, day).toLocaleDateString(i18n.language.startsWith('te') ? 'te-IN' : 'en-IN', { month: 'short' }),
      year,
      relative: relativeDayKey(item.date),
    };
  }, [item.date, i18n.language]);

  if (!parts) {
    return (
      <View style={styles.leftCol}>
        <Text style={styles.dateFallbackText}>{item.date}</Text>
      </View>
    );
  }

  const relative = parts.relative === 'today' ? todayLabel : parts.relative === 'yesterday' ? yesterdayLabel : null;

  return (
    <View
      style={[styles.leftCol, item.important && styles.leftColImportant]}
      accessibilityLabel={`${relative || `${parts.month} ${parts.day}, ${parts.year}`}, ${item.time}`}
    >{[
      relative ? (
        <Text key="relative" style={[styles.dateRelative, item.important && styles.dateRelativeImportant]}>
          {relative}
        </Text>
      ) : null,
      <View
        key="pill"
        style={styles.calendarPill}
      >{[
        <Text
          key="month"
          style={[styles.calendarMonth, item.important && styles.calendarMonthImportant]}
        >
          {parts.month}
        </Text>,
        <Text
          key="day"
          style={[styles.calendarDay, item.important && styles.calendarDayImportant]}
        >
          {parts.day}
        </Text>,
        <Text key="year" style={styles.calendarYear}>{parts.year}</Text>,
      ]}</View>,
    ]}</View>
  );
});

const MonthHeader = memo(function MonthHeader({
  label,
  styles,
}: {
  label: string;
  styles: ReturnType<typeof getStyles>;
}) {
  const { theme, isDark } = useTheme();
  return (
    <View style={styles.monthRow}>{[
      <View key="icon" style={styles.monthIcon}>
        <Ionicons
          name="calendar-clear-outline"
          size={13}
          color={isDark ? theme.colors.primaryLight : theme.colors.primary}
        />
      </View>,
      <Text key="label" style={styles.monthLabel}>{label}</Text>,
      <View key="rule-end" style={styles.monthRule} />,
    ]}</View>
  );
});

const NoticeTimelineRow = memo(function NoticeTimelineRow({
  item,
  index,
  isLast,
  styles,
}: {
  item: UINotice;
  index: number;
  isLast: boolean;
  styles: ReturnType<typeof getStyles>;
}) {
  const { t } = useTranslation();
  const { isDark, theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [textOverflows, setTextOverflows] = useState(false);

  const localizedTitle = t_field(item.title, item.title_te);
  const localizedMessage = t_field(item.message, item.message_te);
  const bodyDuplicatesTitle =
    localizedMessage.trim().length > 0 &&
    localizedMessage.trim().toLowerCase() === localizedTitle.trim().toLowerCase();
  const showBody = localizedMessage.trim().length > 0 && !bodyDuplicatesTitle;
  const speechParts = useMemo(
    () => [localizedTitle, bodyDuplicatesTitle ? undefined : localizedMessage],
    [localizedMessage, localizedTitle, bodyDuplicatesTitle]
  );

  const accentColor = item.important ? (isDark ? '#FDA4AF' : '#BE3456') : (isDark ? '#C4B5FD' : theme.colors.primaryDark);
  const canExpand = showBody && (textOverflows || localizedMessage.length > 180);
  const onToggle = useCallback(() => {
    Haptics.selectionAsync();
    setExpanded(previous => !previous);
  }, []);
  const onBodyLayout = useCallback((event: { nativeEvent: { lines: { text: string }[] } }) => {
    if (!expanded && event.nativeEvent.lines.length >= COLLAPSED_LINES) setTextOverflows(true);
  }, [expanded]);

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 5) * 35).duration(320)}
      layout={Layout.duration(220)}
      style={[styles.timelineItem, isLast && styles.timelineItemLast]}
    >
      <View style={[styles.card, item.important && styles.cardImportant]}>
        <LinearGradient pointerEvents="none" colors={item.important
          ? (isDark ? ['#3E253C', '#231F33'] : ['#FFF3F5', '#FFFFFF'])
          : (isDark ? ['#2B2944', '#1F2236'] : ['#F7F3FF', '#FFFFFF'])}
          start={{ x: 1, y: 0 }} end={{ x: 0.2, y: 0.8 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
        <View style={styles.compactCardRow}>
          <DateCol item={item} styles={styles} todayLabel={t('announcements.today', 'Today')} yesterdayLabel={t('announcements.yesterday', 'Yesterday')} />
          <View style={styles.cardCopy}>
            <View style={styles.cardTopline}>
              <View style={[styles.categoryBadge, item.important && styles.categoryBadgeImportant]}>
                <Ionicons name={item.important ? 'alert-circle' : 'megaphone-outline'} size={10} color={accentColor} />
                <Text style={[styles.categoryText, { color: accentColor }]}>{item.important ? t('announcements.important', 'Important') : t('announcements.schoolUpdate', 'School update')}</Text>
              </View>
              <Text style={styles.timeText}>{item.time}</Text>
            </View>
            <Text style={styles.cardTitle}>{localizedTitle}</Text>
            {showBody && <Text style={styles.message} numberOfLines={expanded || !canExpand ? undefined : COLLAPSED_LINES} onTextLayout={onBodyLayout}>{localizedMessage}</Text>}
            {canExpand && <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={`${expanded ? t('announcements.showLess', 'Show less') : t('announcements.readMore', 'Read more')}: ${localizedTitle}`} accessibilityState={{ expanded }} style={({ pressed }) => [styles.expandButton, pressed && { opacity: 0.6 }]}>
              <Text style={[styles.readMore, { color: accentColor }]}>{expanded ? t('announcements.showLess', 'Show less') : t('announcements.readMore', 'Read more')}</Text><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={accentColor} />
            </Pressable>}
            <View style={styles.authorWrap}>
              <Ionicons name="school-outline" size={12} color={theme.colors.textMuted} />
              <Text style={styles.authorText} numberOfLines={1}>{item.authorName || t('announcements.schoolOffice', 'School office')}</Text>
            </View>
          </View>
          <ReadAloudButton id={`announcement-${item.id}`} text={speechParts} color={accentColor} size={38} />
        </View>
      </View>
    </Animated.View>
  );
});

function AnnouncementsScreenInner() {
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterId>('all');

  useFocusEffect(useCallback(() => () => {
    void readAloudService.stop();
  }, []));

  const { data: noticePayload, loading, isRefreshing, error, refetch } = useStudentQuery<Notice[]>(
    '/notices',
    'notices:students',
    2 * 60 * 1000,
    user?.userId,
    { enabled: true, query: { audience: 'students' } }
  );

  const allDayLabel = t('announcements.allDay', 'All day');
  const notices = useMemo(
    () => mapNoticesToUi(sortNoticesNewestFirst(noticePayload ?? []), allDayLabel),
    [noticePayload, allDayLabel]
  );

  const importantCount = useMemo(
    () => notices.filter((item) => item.important).length,
    [notices]
  );

  const visibleNotices = useMemo(
    () => (filter === 'important' ? notices.filter((item) => item.important) : notices),
    [filter, notices]
  );

  const rows = useMemo(
    () => buildListRows(visibleNotices, i18n.language),
    [visibleNotices, i18n.language]
  );

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const onSelectFilter = useCallback((next: FilterId) => {
    if (next === filter) return;
    Haptics.selectionAsync();
    setFilter(next);
  }, [filter]);

  const renderItem = useCallback(
    ({ item, index }: { item: ListRow; index: number }) => {
      if (item.kind === 'month') {
        return <MonthHeader label={item.label} styles={styles} />;
      }
      return (
        <NoticeTimelineRow
          item={item.item}
          index={index}
          isLast={item.isLast}
          styles={styles}
        />
      );
    },
    [styles]
  );

  const keyExtractor = useCallback((item: ListRow) => item.id, []);

  const emptyList = useCallback(() => (
    <Animated.View entering={FadeIn.duration(280)} style={styles.emptyWrap}>{[
      <View key="icon" style={styles.emptyIconWell}>
        <Ionicons
          name={filter === 'important' ? 'bookmark-outline' : 'megaphone-outline'}
          size={28}
          color={theme.colors.primary}
        />
      </View>,
      <Text key="title" style={styles.emptyTitle}>
        {error ? t('announcements.loadErrorTitle', 'Unable to load notices') : t('announcements.emptyTitle', "You're all caught up")}
      </Text>,
      <Text key="sub" style={styles.emptySubtitle}>
        {error ? t('announcements.loadErrorHint', 'Check your connection and try again.') : filter === 'important'
          ? t('announcements.emptyImportant', 'No important notices right now.')
          : t('announcements.emptySubtitle', 'New school notices will appear here.')}
      </Text>,
      error ? (
        <Pressable key="retry" onPress={onRefresh} style={styles.retryBtn}>
          <Text style={styles.retryText}>{t('announcements.retry', 'Try again')}</Text>
        </Pressable>
      ) : null,
    ]}</Animated.View>
  ), [error, filter, onRefresh, styles, t, theme.colors.primary]);

  const filters: { id: FilterId; label: string; count: number }[] = [
    { id: 'all', label: t('announcements.all', 'All'), count: notices.length },
    { id: 'important', label: t('announcements.pinned', 'Important'), count: importantCount },
  ];

  return (
    <ScreenLayout style={{ backgroundColor: isDark ? '#111321' : '#F6F4FA' }}>{[
      <StudentHeader
        key="screen-hdr"
        showBackButton={true}
        title={t('announcements.shortTitle', 'Notices')}
      />,
      <View key="screen-body" style={styles.container}>{[
        <View key="hero" style={styles.heroCard}>{[
          <LinearGradient
            key="hero-bg"
            colors={isDark
              ? [theme.colors.primaryDark, '#17152E']
              : [theme.colors.primaryDark, theme.colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />,
          <View key="glow-one" style={styles.heroGlowOne} />,
          <View key="glow-two" style={styles.heroGlowTwo} />,
          <View key="hero-top" style={styles.heroTop}>
            <View style={styles.heroIcon}><Ionicons name="megaphone" size={18} color="#FFFFFF" /></View>
            <View style={styles.heroCopy}>
              <Text style={styles.pageTitle}>{t('announcements.board', 'Notice board')}</Text>
              <Text style={styles.heroMeta}>
                {t('announcements.updates', { count: notices.length, defaultValue: `${notices.length} updates` })}
                {'  ·  '}
                {t('announcements.pinnedCount', { count: importantCount, defaultValue: `${importantCount} important` })}
              </Text>
            </View>
          </View>,
        ]}</View>,
        <View key="filters" style={styles.filterRow}>
          {filters.map((chip) => {
            const active = filter === chip.id;
            return (
              <Pressable
                key={chip.id}
                onPress={() => onSelectFilter(chip.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${chip.label}, ${chip.count}`}
                style={({ pressed }) => [
                  styles.filterChip,
                  active && styles.filterChipActive,
                  pressed && styles.filterChipPressed,
                ]}
              >{[
                <Ionicons
                  key="icon"
                  name={chip.id === 'all' ? 'albums-outline' : 'alert-circle-outline'}
                  size={16}
                  color={active
                    ? (isDark ? '#FFFFFF' : theme.colors.primaryDark)
                    : theme.colors.textMuted}
                />,
                <Text
                  key="label"
                  style={[styles.filterChipText, active && styles.filterChipTextActive]}
                >
                  {chip.label}
                </Text>,
                <View
                  key="count"
                  style={[styles.filterCount, active && styles.filterCountActive]}
                >
                  <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>
                    {chip.count}
                  </Text>
                </View>,
              ]}</Pressable>
            );
          })}
        </View>,
        error && notices.length > 0 ? (
          <Pressable key="error-banner" onPress={onRefresh} style={styles.errorBanner}>
            <Ionicons name="cloud-offline-outline" size={15} color={theme.colors.warning} />
            <Text style={styles.errorBannerText}>
              {t('announcements.offlineHint', 'Showing saved updates. Tap to refresh.')}
            </Text>
            <Ionicons name="refresh" size={15} color={theme.colors.warning} />
          </Pressable>
        ) : null,
        loading ? (
          <LogoLoader key="loader" size={60} color={theme.colors.primary} style={styles.loader} />
        ) : (
          <FlatList
            key="list"
            data={rows}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            initialNumToRender={Platform.OS === 'web' ? Math.max(10, rows.length) : 10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            ListEmptyComponent={emptyList}
            refreshControl={(
              <RefreshControl
                refreshing={Boolean(isRefreshing)}
                onRefresh={onRefresh}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
              />
            )}
          />
        ),
      ]}</View>,
    ]}</ScreenLayout>
  );
}

export default function AnnouncementsScreen() {
  return <TourTarget id="screen.screen-announcements.overview" style={{ flex: 1 }}><TourTarget id="screen.screen-announcements.workspace" style={{ flex: 1 }}><ErrorBoundary><AnnouncementsScreenInner /></ErrorBoundary></TourTarget></TourTarget>;
}

const getStyles = (theme: SchoolTheme, isDark: boolean) => {
  const c = theme.colors;
  const ink = isDark ? '#F5F2FC' : '#2B223D';
  const muted = isDark ? '#B7AEC8' : '#766D84';
  return StyleSheet.create({
    container: { flex: 1 },
    heroCard: { marginTop: 12, marginBottom: 10, padding: 15, borderRadius: 20, overflow: 'hidden', width: '92%', maxWidth: 640, alignSelf: 'center', ...Platform.select({ ios: { shadowColor: c.primaryDark, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16 }, android: { elevation: 4 }, web: { boxShadow: `0 12px 30px -18px ${schoolColorWithAlpha(c.primaryDark, 0.65)}` } as object }) },
    heroGlowOne: { position: 'absolute', width: 190, height: 190, borderRadius: 95, right: -65, top: -90, backgroundColor: '#FFFFFF10', borderWidth: 1, borderColor: '#FFFFFF15' },
    heroGlowTwo: { position: 'absolute', width: 140, height: 140, borderRadius: 70, left: -80, bottom: -95, backgroundColor: '#FFFFFF10' },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    heroIcon: { width: 38, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF18', borderWidth: 1, borderColor: '#FFFFFF30' },
    heroCopy: { flex: 1, minWidth: 0 },
    heroMeta: { color: '#EEE4F8', fontSize: 11, lineHeight: 17, marginTop: 3 },
    pageTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.7, color: '#FFFFFF' },
    filterRow: { flexDirection: 'row', padding: 5, marginBottom: 6, gap: 5, borderRadius: 15, backgroundColor: isDark ? '#222237' : '#EAE5F1', width: '92%', maxWidth: 640, alignSelf: 'center' },
    filterChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 8, borderRadius: 12, gap: 7 },
    filterChipActive: { backgroundColor: isDark ? '#443359' : '#FFFFFF', ...Platform.select({ web: { boxShadow: isDark ? 'none' : '0 2px 6px #3320470C' } as object }) },
    filterChipPressed: { opacity: 0.75 },
    filterChipText: { fontSize: 13, fontWeight: '700', color: muted },
    filterChipTextActive: { color: isDark ? '#F1E8FF' : c.primaryDark },
    filterCount: { minWidth: 23, height: 23, paddingHorizontal: 6, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#FFFFFF10' : '#DCD5E6' },
    filterCountActive: { backgroundColor: isDark ? '#AE8BE0' : c.primary },
    filterCountText: { fontSize: 11, fontWeight: '800', color: muted },
    filterCountTextActive: { color: isDark ? '#251638' : '#FFFFFF' },
    errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, marginBottom: 8, borderRadius: 12, backgroundColor: isDark ? '#3B3022' : '#FFF5DF', width: '92%', maxWidth: 640, alignSelf: 'center' },
    errorBannerText: { flex: 1, color: isDark ? '#FDE68A' : '#92400E', fontSize: 12 },
    loader: { marginTop: 56, alignSelf: 'center' },
    listContainer: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 48, flexGrow: 1, width: '100%', maxWidth: 672, alignSelf: 'center' },
    monthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 6, gap: 8 },
    monthIcon: { width: 23, height: 23, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: schoolColorWithAlpha(c.primary, isDark ? 0.18 : 0.08) },
    monthRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: isDark ? '#FFFFFF18' : '#DCD5E6' },
    monthLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: muted },
    timelineItem: { marginBottom: 10 },
    timelineItemLast: { marginBottom: 8 },
    leftCol: { width: 44, minHeight: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 5, backgroundColor: isDark ? '#FFFFFF08' : '#FFFFFFCC', borderWidth: 1, borderColor: isDark ? '#FFFFFF15' : '#E8DFF1' },
    leftColImportant: { backgroundColor: isDark ? '#FCA5A50C' : '#FFFFFFDD', borderColor: isDark ? '#FDA4AF25' : '#F3D8DF' },
    dateFallbackText: { fontSize: 12, fontWeight: '700', color: ink },
    dateRelative: { marginBottom: 3, fontSize: 8, lineHeight: 10, fontWeight: '700', textTransform: 'uppercase', color: isDark ? c.primaryLight : c.primary },
    dateRelativeImportant: { color: isDark ? '#FDA4AF' : '#BE3456' },
    calendarPill: { alignItems: 'center', justifyContent: 'center' },
    calendarMonth: { textTransform: 'uppercase', color: isDark ? '#C4B5FD' : c.primaryDark, fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 1 },
    calendarMonthImportant: { color: isDark ? '#FDA4AF' : '#BE3456' },
    calendarDay: { fontSize: 21, lineHeight: 24, fontWeight: '800', color: ink, letterSpacing: -0.8 },
    calendarDayImportant: { color: isDark ? '#FCE7EB' : '#9B2947' },
    calendarYear: { fontSize: 8, lineHeight: 12, fontWeight: '600', color: muted },
    card: { borderRadius: 18, padding: 13, borderWidth: 1, borderColor: isDark ? '#49405B' : '#E5DBEF', backgroundColor: isDark ? '#1F2236' : '#FFFFFF', overflow: 'hidden', ...Platform.select({ ios: { shadowColor: '#392347', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 14 }, android: { elevation: 2 }, web: { boxShadow: isDark ? '0 8px 22px #00000018' : '0 8px 22px -12px #49335F28' } as object }) },
    cardImportant: { borderColor: isDark ? '#6B394F' : '#EFCAD4' },
    cardAccent: { position: 'absolute', top: 0, left: 24, width: 42, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
    cardTopline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 6, rowGap: 3, marginBottom: 5 },
    categoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 3, backgroundColor: isDark ? '#C4B5FD12' : '#EFE8FA' },
    categoryBadgeImportant: { backgroundColor: isDark ? '#FDA4AF14' : '#FCE5EC' },
    categoryText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.2 },
    timeText: { fontSize: 9, color: muted },
    compactCardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cardCopy: { flex: 1, minWidth: 0 },
    cardTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', letterSpacing: -0.45, color: ink },
    message: { fontSize: 13, lineHeight: 19, color: isDark ? '#C9C1D8' : '#6B6278', marginTop: 5 },
    expandButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, minHeight: 44, paddingRight: 12 },
    readMore: { fontSize: 12, fontWeight: '700' },
    authorWrap: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0, marginTop: 6 },
    authorText: { flex: 1, fontSize: 10, lineHeight: 15, fontWeight: '600', color: isDark ? '#DCD3E9' : '#675A79' },
    emptyWrap: { alignItems: 'center', paddingTop: 56, paddingHorizontal: 28 },
    emptyIconWell: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 14, backgroundColor: schoolColorWithAlpha(c.primary, isDark ? 0.16 : 0.1) },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: ink, textAlign: 'center' },
    emptySubtitle: { marginTop: 6, fontSize: 14, lineHeight: 20, color: muted, textAlign: 'center' },
    retryBtn: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: c.primary },
    retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  });
};
