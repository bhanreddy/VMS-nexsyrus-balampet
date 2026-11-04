import { TourTarget } from '@/src/features/app-tour';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from 'expo-router';
import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import { useAuth } from '../../src/hooks/useAuth';
import { useStudentQuery } from '../../src/hooks/useStudentQuery';
import { useTheme } from '../../src/hooks/useTheme';
import type { Theme } from '../../src/theme/themes';
import type { Complaint, Student } from '../../src/types/models';
import { t_field } from '../../src/utils/lang';
import LogoLoader from '../../src/components/LogoLoader';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import ReadAloudButton from '../../src/components/ReadAloudButton';
import { readAloudService } from '../../src/services/readAloudService';
import * as Haptics from '../../src/utils/haptics';

const FILTERS = ['all', 'high', 'medium', 'low'] as const;
type Severity = Exclude<typeof FILTERS[number], 'all'>;
const severityOf = (record: Complaint): Severity => record.priority === 'high' || record.priority === 'urgent' ? 'high' : record.priority === 'medium' ? 'medium' : 'low';
const isResolved = (record: Complaint) => record.status === 'resolved' || record.status === 'closed';
const SEVERITY_LABELS = { all: 'All', high: 'High', medium: 'Medium', low: 'Low' };
const STATUS_LABELS: Record<string, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed', pending: 'Pending' };
const CATEGORY_LABELS: Record<string, string> = { academic: 'Academic', fee: 'Fees', transport: 'Transport', hostel: 'Hostel', other: 'General', disciplinary: 'Disciplinary', food: 'Food' };
const severityColor = (severity: Severity, dark: boolean) => severity === 'high' ? (dark ? '#FDA4AF' : '#B93955') : severity === 'medium' ? (dark ? '#F6CE85' : '#95641D') : (dark ? '#9EC9FF' : '#3C6CA3');

const ComplaintCard = memo(function ComplaintCard({ record, index, dateLocale }: { record: Complaint; index: number; dateLocale: string }) {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const severity = severityOf(record);
  const accent = severityColor(severity, isDark);
  const title = t_field(record.title || t('complaints.report', 'Behaviour report'), record.title_te);
  // Some older records use a legacy description field.
  const legacy = record as Complaint & { details?: string; remark?: string; complaint_text?: string; body?: string; note?: string };
  const description = t_field(record.description ?? legacy.details ?? legacy.remark ?? legacy.complaint_text ?? legacy.body ?? legacy.note ?? '', record.description_te);
  const showDescription = !!description.trim() && description.trim().toLowerCase() !== title.trim().toLowerCase();
  const expandable = showDescription && (description.length > 130 || overflows);
  const speech = useMemo(() => [title, showDescription ? description : undefined], [title, description, showDescription]);
  const resolved = isResolved(record);
  const statusColor = resolved ? (isDark ? '#7AD9B3' : '#237B5C') : record.status === 'in_progress' ? (isDark ? '#C4B5FD' : '#7352A0') : theme.colors.textSecondary;
  const category = record.category || 'other';
  const date = record.created_at ? new Date(record.created_at) : null;
  const dateLabel = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 4) * 35).duration(280).reduceMotion(ReduceMotion.System)} style={styles.cardShadow}>
      <View style={styles.card}>
        <LinearGradient pointerEvents="none" colors={isDark ? ['#30283D70', '#20223600'] : ['#F5EFF980', '#FFFFFF00']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 0.9 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.accentMark, { backgroundColor: accent }]} />
        <View style={styles.cardMeta}>
          <View style={styles.categoryRow}>
            <Text style={styles.category}>{t(`complaints.categories.${category}`, CATEGORY_LABELS[category] ?? category.replace(/_/g, ' '))}</Text>
            {!!record.ticket_no && <Text style={styles.ticket} numberOfLines={1}>#{record.ticket_no}</Text>}
          </View>
          <View style={[styles.severity, { backgroundColor: accent + '12' }]}>
            <Ionicons name={severity === 'high' ? 'alert-circle' : severity === 'medium' ? 'warning-outline' : 'information-circle-outline'} size={11} color={accent} />
            <Text style={[styles.severityText, { color: accent }]}>{t(`complaints.severity.${severity}`, SEVERITY_LABELS[severity])}</Text>
          </View>
        </View>
        <View style={styles.contentRow}>
          <View style={styles.copy}>
            <Text style={styles.cardTitle}>{title}</Text>
            {showDescription && <Text style={styles.description} numberOfLines={expanded || !expandable ? undefined : 2} onTextLayout={event => { if (!expanded && event.nativeEvent.lines.length > 2) setOverflows(true); }}>{description}</Text>}
          </View>
          <ReadAloudButton id={`complaint-${record.id}`} text={speech} color={accent} size={38} />
        </View>
        {expandable && <Pressable onPress={() => { Haptics.selectionAsync(); setExpanded(value => !value); }} accessibilityRole="button" accessibilityLabel={`${expanded ? t('complaints.showLess', 'Show less') : t('complaints.readMore', 'Read more')}: ${title}`} accessibilityState={{ expanded }} style={styles.expandButton}><Text style={styles.expandText}>{expanded ? t('complaints.showLess', 'Show less') : t('complaints.readMore', 'Read more')}</Text><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={theme.colors.primary} /></Pressable>}
        <View style={styles.cardFooter}>
          <View style={styles.reporter}>
            <Ionicons name="person-circle-outline" size={16} color={theme.colors.textSecondary} />
            <View style={styles.copy}><Text style={styles.reporterName} numberOfLines={1}>{record.raised_by_name || t('complaints.staffMember', 'Staff member')}</Text>{!!dateLabel && <Text style={styles.date}>{dateLabel}</Text>}</View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusColor + '12' }]}><View style={[styles.statusDot, { backgroundColor: statusColor }]} /><Text style={[styles.statusText, { color: statusColor }]}>{t(`complaints.status.${record.status}`, STATUS_LABELS[record.status] ?? record.status)}</Text></View>
        </View>
      </View>
    </Animated.View>
  );
});

function ComplaintsScreenInner() {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language.startsWith('te') ? 'te-IN' : 'en-IN';
  const [filter, setFilter] = useState<typeof FILTERS[number]>('all');
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(useCallback(() => () => { void readAloudService.stop(); }, []));
  const profileQuery = useStudentQuery<Student>('/students/profile/me', 'profile:me', 5 * 60 * 1000, user?.userId, { enabled: !!user?.userId });
  const studentId = profileQuery.data?.id;
  const complaintQuery = useStudentQuery<Complaint[]>('/complaints', `complaints:raised-for-me:${studentId}`, 2 * 60 * 1000, user?.userId, { enabled: !!user?.userId && !!studentId, query: { raised_for_student_id: studentId } });
  const records = useMemo(() => [...(complaintQuery.data ?? [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [complaintQuery.data]);
  const counts = useMemo(() => ({ all: records.length, high: records.filter(record => severityOf(record) === 'high').length, medium: records.filter(record => severityOf(record) === 'medium').length, low: records.filter(record => severityOf(record) === 'low').length }), [records]);
  const resolved = records.filter(isResolved).length;
  const visible = useMemo(() => records.filter(record => filter === 'all' || severityOf(record) === filter), [records, filter]);
  const loading = profileQuery.loading || complaintQuery.loading;
  const error = profileQuery.error || complaintQuery.error;
  const refetchComplaints = complaintQuery.refetch;
  const refetchProfile = profileQuery.refetch;
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { if (studentId) await refetchComplaints(); else await refetchProfile(); }
    finally { setRefreshing(false); }
  }, [studentId, refetchComplaints, refetchProfile]);

  const header = <View style={styles.listHeader}>
    <LinearGradient colors={isDark ? ['#352746', '#242139'] : ['#4A276C', '#765096']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summary}>
      <View style={styles.summaryIcon}><Ionicons name="shield-checkmark-outline" size={22} color="#F2E8FC" /></View>
      <View style={styles.copy}><Text style={styles.summaryTitle}>{t('complaints.overview', 'Behaviour reports')}</Text><Text style={styles.summarySubtitle}>{t('complaints.highCount', { count: counts.high, defaultValue: `${counts.high} high priority` })}{' · '}{t('complaints.resolvedCount', { count: resolved, defaultValue: `${resolved} resolved` })}</Text></View>
      <View style={styles.summaryTotal}><Text style={styles.totalValue}>{loading && !records.length ? '—' : records.length}</Text><Text style={styles.totalLabel}>{t('complaints.total', 'Total')}</Text></View>
    </LinearGradient>

    <View style={styles.filters}>
      {FILTERS.map(key => <Pressable key={key} onPress={() => { Haptics.selectionAsync(); setFilter(key); }} accessibilityRole="button" accessibilityLabel={`${t(`complaints.severity.${key}`, SEVERITY_LABELS[key])}, ${counts[key]}`} accessibilityState={{ selected: filter === key }} style={({ pressed }) => [styles.filter, filter === key && styles.activeFilter, pressed && { opacity: 0.7 }]}><Text style={[styles.filterText, filter === key && styles.activeFilterText]}>{t(`complaints.severity.${key}`, SEVERITY_LABELS[key])}</Text><Text style={[styles.filterCount, filter === key && styles.activeFilterText]}>{counts[key]}</Text></Pressable>)}
    </View>
    <View style={styles.sectionHeading}><Text accessibilityRole="header" style={styles.sectionTitle}>{t('complaints.reports', 'Reports')}</Text><Text style={styles.secondary}>{t('complaints.newestFirst', 'Newest first')}</Text></View>
    {!!error && records.length > 0 && <Pressable accessibilityRole="button" onPress={onRefresh} style={styles.errorBanner}><Ionicons name="cloud-offline-outline" size={16} color={theme.colors.warning} /><Text style={styles.secondary}>{t('complaints.savedHint', 'Showing saved reports. Tap to retry.')}</Text></Pressable>}
  </View>;

  return (
    <ScreenLayout style={{ backgroundColor: isDark ? '#111321' : '#F6F4F9' }}>
      <StudentHeader showBackButton title={t('complaints.title', 'Complaints')} />
      <FlatList
        style={{ flex: 1 }} data={visible} keyExtractor={record => record.id}
        renderItem={({ item, index }) => <ComplaintCard record={item} index={index} dateLocale={dateLocale} />}
        contentContainerStyle={styles.container} ListHeaderComponent={header} showsVerticalScrollIndicator={false}
        initialNumToRender={Platform.OS === 'web' ? Math.max(10, visible.length) : 10} maxToRenderPerBatch={10} windowSize={5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
        ListEmptyComponent={loading ? <LogoLoader size={48} color={theme.colors.primary} style={styles.loader} /> : <View style={styles.empty}>
          <View style={styles.emptyIcon}><Ionicons name={error ? 'cloud-offline-outline' : 'shield-checkmark-outline'} size={27} color={theme.colors.primary} /></View>
          <Text style={styles.emptyTitle}>{error ? t('complaints.loadError', 'Unable to load reports') : t('complaints.emptyTitle', 'No reports to show')}</Text>
          <Text style={styles.emptyText}>{error ? t('complaints.retryHint', 'Check your connection and try again.') : filter !== 'all' ? t('complaints.emptyFilter', 'No reports match this severity.') : t('complaints.emptyHint', 'Reports from the school will appear here.')}</Text>
          {!!error && <Pressable onPress={onRefresh} accessibilityRole="button" style={styles.retry}><Text style={styles.expandText}>{t('complaints.retry', 'Try again')}</Text></Pressable>}
        </View>}
      />
    </ScreenLayout>
  );
}

export default function ComplaintsScreen() {
  return <TourTarget id="screen.screen-complaints.overview" style={{ flex: 1 }}><TourTarget id="screen.screen-complaints.workspace" style={{ flex: 1 }}><ErrorBoundary><ComplaintsScreenInner /></ErrorBoundary></TourTarget></TourTarget>;
}

function getStyles(theme: Theme, dark: boolean) {
  return StyleSheet.create({
    container: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 732, alignSelf: 'center', flexGrow: 1 },
    listHeader: { gap: 12, marginBottom: 10 },
    copy: { flex: 1, minWidth: 0 },
    summary: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 20, borderWidth: 1, borderColor: dark ? '#5E486E' : '#FFFFFF20' },
    summaryIcon: { width: 40, height: 42, borderRadius: 13, backgroundColor: '#FFFFFF12', alignItems: 'center', justifyContent: 'center' },
    summaryTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', letterSpacing: -0.4 },
    summarySubtitle: { color: '#E8DFF0', fontSize: 11, lineHeight: 16, marginTop: 3 },
    summaryTotal: { alignItems: 'center', paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: '#FFFFFF25', minWidth: 40 },
    totalValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', lineHeight: 27 },
    totalLabel: { color: '#E8DFF0', fontSize: 9 },
    secondary: { color: theme.colors.textSecondary, fontSize: 11, lineHeight: 16 },
    filters: { flexDirection: 'row', gap: 3, padding: 4, borderRadius: 14, backgroundColor: dark ? '#252338' : '#EAE5F0' },
    filter: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 3 },
    activeFilter: { backgroundColor: dark ? '#4E3C65' : '#FFFFFF' },
    filterText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600', flexShrink: 1 },
    activeFilterText: { color: dark ? '#EADAFB' : '#663E86' },
    filterCount: { color: theme.colors.textTertiary, fontSize: 10, fontWeight: '700' },
    sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 3, marginTop: 2 },
    sectionTitle: { color: theme.colors.textStrong, fontSize: 13, fontWeight: '700' },
    cardShadow: { marginBottom: 12, borderRadius: 19, shadowColor: '#392347', shadowOffset: { width: 0, height: 4 }, shadowOpacity: dark ? 0.12 : 0.05, shadowRadius: 10, elevation: 2 },
    card: { padding: 14, borderRadius: 19, borderWidth: 1, borderColor: dark ? '#41384F' : '#E3DAEB', backgroundColor: theme.colors.card, overflow: 'hidden' },
    accentMark: { position: 'absolute', width: 3, top: 16, bottom: 16, left: 0, borderRadius: 2 },
    cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
    categoryRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', columnGap: 7, rowGap: 3, alignItems: 'center' },
    category: { color: dark ? '#C9B5DD' : '#7D6191', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    ticket: { color: theme.colors.textTertiary, fontSize: 9, flexShrink: 1 },
    severity: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4 },
    severityText: { fontSize: 10, fontWeight: '700' },
    contentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    cardTitle: { color: theme.colors.textStrong, fontSize: 17, fontWeight: '700', lineHeight: 23, letterSpacing: -0.3 },
    description: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4 },
    expandButton: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', minHeight: 44 },
    expandText: { color: theme.colors.primary, fontSize: 12, fontWeight: '600' },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 11, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
    reporter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
    reporterName: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: '600' },
    date: { color: theme.colors.textTertiary, fontSize: 10, lineHeight: 15, marginTop: 2 },
    statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 8, flexShrink: 1 },
    statusDot: { width: 4, height: 4, borderRadius: 2 },
    statusText: { fontSize: 10, fontWeight: '600', flexShrink: 1 },
    errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, backgroundColor: dark ? '#372E22' : '#FFF5E2' },
    loader: { marginVertical: 36, alignSelf: 'center' },
    empty: { padding: 30, alignItems: 'center', gap: 8 },
    emptyIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? '#352C46' : '#ECE4F4' },
    emptyTitle: { color: theme.colors.textStrong, fontSize: 16, fontWeight: '600' },
    emptyText: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center' },
    retry: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
  });
}
