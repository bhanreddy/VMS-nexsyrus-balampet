import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, RefreshControl, Pressable, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp, useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import HeaderCard from '../../src/components/HeaderCard';
import FeatureCard from '../../src/components/FeatureCard';
import { useAuth } from '../../src/hooks/useAuth';
import { NoticeService } from '../../src/services/commonServices';
import { StudentService } from '../../src/services/studentService';
import { Student, AttendanceSummary } from '../../src/types/models';
import { useTheme } from '../../src/hooks/useTheme';
import { Shadows, Radii, Spacing, Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';

const { width } = Dimensions.get('window');

interface HomeTab {
  key: string;
  title: string;
  translationKey?: string;
  icon: string;
  colors: string[];
  priority: string;
  isPrimary?: boolean;
  badgeCount?: number;
}

const homeTabs: HomeTab[] = [
{ key: 'messages', title: 'Announcements', translationKey: 'announcements.title', icon: 'ChatCircleDots', colors: ['#4F75CA', '#3B60B4'], isPrimary: true, priority: 'high' },
{ key: 'complaints', title: 'Complaints', translationKey: 'complaints.title', icon: 'WarningCircle', colors: ['#D65A5A', '#B94444'], isPrimary: true, priority: 'high' },
{ key: 'lifeValues', title: 'Life Values', translationKey: 'lifeValues', icon: 'Heart', colors: ['#3A9D82', '#2A8169'], isPrimary: true, priority: 'low' },
{ key: 'hostel', title: 'Hostel Services', translationKey: 'hostel', icon: 'Bed', colors: ['#3B9B93', '#2B837B'], priority: 'medium' },
{ key: 'busmap', title: 'Transport', translationKey: 'admin_dashboard.transport', icon: 'Bus', colors: ['#DA9B40', '#BB802D'], priority: 'medium' },
{ key: 'projects', title: 'Science Projects', translationKey: 'scienceProjects', icon: 'Flask', colors: ['#3395A6', '#267A8A'], priority: 'low' },
{ key: 'test', title: 'Exams', translationKey: 'exams', icon: 'FileText', colors: ['#AD56BD', '#9241A1'], priority: 'medium' },
{ key: 'profile', title: 'Student Profile', translationKey: 'menu.profile', icon: 'User', colors: ['#7D61D1', '#664BB3'], priority: 'medium' }];

const routeMap: Record<string, string> = {
  profile: '/Screen/profile',
  complaints: '/Screen/complaints',
  busmap: '/Screen/busMap',
  hostel: '/Screen/hostel',
  messages: '/Screen/announcements',
  lifeValues: '/Screen/lifeValues',
  projects: '/Screen/scienceProjects',
  test: '/Screen/weekendTest'
};

const HomeScreen = () => {
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data States
  const [student, setStudent] = useState<Student | null>(null);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceSummary | null>(null);
  const [todaysStatus, setTodaysStatus] = useState<string>('not_marked'); // present, absent, late, not_marked
  const [notices, setNotices] = useState<any[]>([]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':return '#16A34A'; // Green
      case 'absent':return '#DC2626'; // Red
      default:return '#9CA3AF'; // Grey
    }
  };

  const loadData = async () => {
    if (!user || user.role !== 'student') return;
    try {
      const profileData = await StudentService.getProfile();
      setStudent(profileData);

      const studentId = profileData?.id || user.id;

      const [noticesData, attendanceData] = await Promise.all([
      NoticeService.getAll({ audience: 'students' }).catch(() => []),
      StudentService.getAttendance(studentId, { limit: 1 }).catch(() => ({ summary: null, records: [] }))]
      );

      setNotices(noticesData || []);
      setAttendanceStats(attendanceData.summary);

      // Calculate Today's Status
      const todayStr = new Date().toISOString().split('T')[0];
      const latestRecord = attendanceData.records && attendanceData.records.length > 0 ? attendanceData.records[0] : null;

      if (latestRecord && (latestRecord as any).attendance_date.startsWith(todayStr)) {
        setTodaysStatus((latestRecord as any).status);
      } else {
        setTodaysStatus('not_marked');
      }

    } catch (e) {

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadData();
  };

  const handleNavigation = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const route = routeMap[key];
    if (route) {
      router.push(route as any);
    }
  };

  // Derived Attendance Stats
  const totalDays = Number(attendanceStats?.total || 0);
  const presentDays = Number(attendanceStats?.present || 0);
  const attPercentage = totalDays > 0 ?
  Math.round(presentDays / totalDays * 100) :
  0;

  // Attendance Card specific animations
  const attCardScale = useSharedValue(1);
  const attAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: attCardScale.value }] }));
  const handleAttPressIn = () => {attCardScale.value = withSpring(0.97, { damping: 15, mass: 0.8 });};
  const handleAttPressOut = () => {attCardScale.value = withSpring(1, { damping: 15, mass: 0.8 });};

  // Split notices: recent (≤2 days) shown above, older shown below feature cards
  const isRecentNotice = (notice: any) => {
    if (!notice?.created_at) return false;
    const created = new Date(notice.created_at);
    const now = new Date();
    const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 2;
  };
  const recentNotices = notices.filter(isRecentNotice);
  const olderNotices = notices.filter((n: any) => !isRecentNotice(n));

  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    }
  });

  return (
    <ScreenLayout>
            <StatusBar style="light" backgroundColor="transparent" translucent={true} />
            <StudentHeader scrollY={scrollY} />
            <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContainer, { backgroundColor: theme.colors.background }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="transparent" colors={['transparent']} progressBackgroundColor="transparent" />}>

                {refreshing &&
        <View style={{ width: '100%', alignItems: 'center', paddingVertical: 20 }}>
                        <LogoLoader size={30} />
                    </View>
        }
                {/* 1. TOP GREETING & HEADER CARD */}
                <View style={[styles.headerSection, { backgroundColor: '#05050A', paddingTop: Math.max(insets.top, 36) + 60 }]}>
                    <HeaderCard
            studentName={student?.display_name || user?.display_name || "Student"}
            classSec={student?.current_enrollment ? `${student.current_enrollment.class_code} - Sec ${student.current_enrollment.section_name?.replace(/Section\s*/i, '')}` : "Class N/A"}
            rollNo={student?.current_enrollment?.roll_number || "N/A"} />

                </View>
                {/* OVERLAPPING CONTENT BODY */}
                <View style={styles.bodyContainer}>
                    {/* 2. SNAPSHOT SECTION */}
                    <View style={styles.section}>
                        <Animated.View
              style={[
              styles.smartOverviewCard,
              {
                backgroundColor: isDark ? theme.colors.card : '#FFFFFF',
                borderColor: isDark ? theme.colors.border : 'rgba(0,0,0,0.04)'
              },
              attAnimStyle]
              }
              entering={FadeInUp.delay(300).duration(800).springify()}>

                            <Pressable
                onPressIn={handleAttPressIn}
                onPressOut={handleAttPressOut}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/Screen/attendance');
                }}
                style={styles.smartOverviewInner}>

                                <View style={styles.overviewHeader}>
                                    <View style={styles.overviewTitleWrap}>
                                        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(todaysStatus) }]} />
                                        <Text style={styles.overviewTitle}>{t('todaysSnapshot') || "Today's Snapshot"}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                                </View>
                                <View style={styles.overviewMetricsRow}>
                                    {/* Attendance Metric */}
                                    <View style={styles.metricBlock}>
                                        <Text style={styles.metricLabel}>{t('attendance') || "Attendance"}</Text>
                                        <View style={styles.metricValueRow}>
                                            <Text style={[styles.metricValue, { color: '#06B6D4' }]}>{attPercentage}%</Text>
                                        </View>
                                        <View style={styles.progressTrack}>
                                            <Animated.View style={[styles.progressFill, { width: `${attPercentage}%`, backgroundColor: '#06B6D4' }]} />
                                        </View>
                                    </View>
                                    <View style={styles.metricDivider} />
                                    {/* Today's Status */}
                                    <View style={[styles.metricBlock, { flex: 1.2, gap: 6 }]}>
                                        <Text style={styles.metricLabel}>{t('todaysStatus') || "Today's Status"}</Text>
                                        <View style={styles.statusBadgeRow}>
                                            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(todaysStatus) + '18' }]}>
                                                <View style={[styles.statusBadgeDot, { backgroundColor: getStatusColor(todaysStatus) }]} />
                                                <Text style={[styles.statusBadgeText, { color: getStatusColor(todaysStatus) }]}>
                                                    {todaysStatus === 'present' ? t('home.present') || 'Present' :
                          todaysStatus === 'absent' ? t('attendance_screen.absent') || 'Absent' :
                          todaysStatus === 'late' ? t('attendance_screen.late') || 'Late' :
                          todaysStatus === 'half_day' ? 'Half Day' : 'Not Marked'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </Pressable>
                        </Animated.View>
                    </View>
                    {/* 3. QUICK ACTIONS */}
                    <Animated.View style={styles.gridContainer} entering={FadeInUp.delay(500).duration(800).springify()}>
                        {homeTabs.map((item) =>
            <View key={item.key} style={{ marginBottom: 16 }}>
                                <FeatureCard
                title={item.translationKey ? t(item.translationKey) as string : item.title}
                icon={item.icon as any}
                colors={item.colors as [string, string, ...string[]]}
                badgeCount={item.badgeCount}
                isPrimary={item.isPrimary}
                priority={item.priority as any}
                onPress={() => handleNavigation(item.key)} />

                            </View>
            )}
                    </Animated.View>
                    {/* 4. ACADEMIC TOOLS */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeaderLine}>
                            <Text style={styles.sectionTitle}>{t('academicAdvisor') || "Academic Advisor"}</Text>
                        </View>
                        <Animated.View
              style={[styles.teacherCard, {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border
              }]}
              entering={FadeInUp.delay(600).duration(800).springify()}>

                            <View style={styles.teacherContent}>
                                <View style={styles.teacherAvatarBox}>
                                    <Ionicons name="person" size={24} color="#06B6D4" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.teacherName, { color: theme.colors.textStrong }]}>
                                        {student?.current_enrollment?.class_teacher || "Not Assigned"}
                                    </Text>
                                    <Text style={[styles.teacherSub, { color: theme.colors.textSecondary }]}>
                                        {t('common.class_teacher', 'Class Teacher')}
                                    </Text>
                                </View>
                                <Ionicons name="mail-outline" size={20} color="#94A3B8" />
                            </View>
                        </Animated.View>
                    </View>
                    {/* 5. RECENT UPDATES (Announcements) */}
                    {(recentNotices.length > 0 || olderNotices.length > 0) &&
          <View style={styles.section}>
                            <View style={styles.sectionHeaderLine}>
                                <Text style={styles.sectionTitle}>{recentNotices.length > 0 ? t('dashboard.recent_updates') || 'Recent Updates' : t('dashboard.previous_updates') || 'Previous Updates'}</Text>
                            </View>
                            <Animated.View
              style={[styles.announcementCard, {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border
              }]}
              entering={FadeInUp.delay(700).duration(800).springify()}>

                                <View style={styles.announcementHeader}>
                                    <View style={[styles.iconBoxSmall, { backgroundColor: '#F3F4F6' }]}>
                                        <Ionicons name="time" size={14} color="#6B7280" />
                                    </View>
                                </View>
                                <Text style={[styles.noticeTitle, { color: theme.colors.textStrong }]}>
                                    {(recentNotices.length > 0 ? recentNotices[0] : olderNotices[0])?.title || "Notice"}
                                </Text>
                                <Text numberOfLines={2} style={[styles.noticeBody, { color: theme.colors.textSecondary }]}>
                                    {(recentNotices.length > 0 ? recentNotices[0] : olderNotices[0])?.content}
                                </Text>
                            </Animated.View>
                        </View>
          }
                </View>
            </Animated.ScrollView>
        </ScreenLayout>);

};

export default HomeScreen;

/* ===================== STYLES ===================== */

const getStyles = (theme: Theme) => StyleSheet.create({
  scrollContainer: {
    paddingBottom: 40
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.xl,
    gap: 12 // Precisely 12px horizontal/vertical gap, matching FeatureCard bounds
  },

  /* ── Sections & Layout ── */
  headerSection: {
    paddingBottom: 40,
    paddingTop: 0,
    zIndex: 1
  },
  bodyContainer: {
    marginTop: -32,
    zIndex: 2,
    paddingHorizontal: 20,
    gap: 32 // Stronger spacing between major sections
  },
  section: {
    gap: 16
  },
  sectionHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)' // Subtle enterprise divider
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800', // Stronger section title weight
    color: '#475569', // Slate 600
    textTransform: 'uppercase',
    letterSpacing: 1.2
  },

  /* ── Smart Overview ── */
  smartOverviewCard: {
    borderRadius: 20,
    borderWidth: 1,
    ...Shadows.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3
  },
  smartOverviewInner: {
    padding: 18
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  overviewTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  overviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary
  },
  overviewMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  metricBlock: {
    flex: 1,
    gap: 4
  },
  metricDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginHorizontal: 16
  },
  metricLabel: {
    fontSize: 12,
    color: theme.colors.textTertiary
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 2
  },
  trendBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12
  },
  metricTextActive: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textStrong
  },
  metricSubtext: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B'
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8
  },
  statusBadgeDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  statusBadgeText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2
  },

  /* ── Announcements ── */
  announcementCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 12 },
      android: { elevation: 2 }
    })
  },
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  iconBoxSmall: {
    width: 28,
    height: 28,
    borderRadius: Radii.sm,
    justifyContent: 'center',
    alignItems: 'center'
  },
  announcementTime: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    fontWeight: '500'
  },

  /* ── Attendance ── */
  attContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg
  },
  attCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 5,
    justifyContent: 'center',
    alignItems: 'center'
  },
  attPercent: {
    fontSize: 18,
    fontWeight: '800'
  },
  attLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  attValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3
  },

  teacherCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 12 },
      android: { elevation: 2 }
    })
  },
  teacherContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  teacherAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFEFF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  teacherName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: 0.1
  },
  teacherSub: {
    fontSize: 13,
    fontWeight: '500'
  },

  /* ── Notice ── */
  noticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.1
  },
  noticeBody: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20
  }
});