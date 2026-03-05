import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, BackHandler, Pressable, Dimensions, FlatList, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, withSpring, withRepeat, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import AdminHeader from '../../src/components/AdminHeader';
import { useAuth } from '../../src/hooks/useAuth';
import { AdminDashboardStats } from '../../src/types/models';
import { AdminService } from '../../src/services/adminService';
import { AccessControlService } from '../../src/services/accessControlService';
import { supabase } from '../../src/services/supabaseConfig';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import ResponsiveCard from '../../src/components/ResponsiveCard';
type IconName = React.ComponentProps<typeof Ionicons>['name'];
interface ActionItem {
  title: string;
  icon: IconName;
  route: string;
  gradient: [string, string];
  badge?: number;
}
interface StatItem {
  label: string;
  value: string | number;
  icon: IconName;
  color: string;
  bg: string;
  route: string;
  trend: string;
  trendColor: string;
  trendBg: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTAINER_PADDING = 20;
const CARD_MARGIN = 16;
const MAX_CONTENT_WIDTH = 1000;
const ACTUAL_WIDTH = Math.min(SCREEN_WIDTH, MAX_CONTENT_WIDTH);
const CARD_WIDTH = ACTUAL_WIDTH - CONTAINER_PADDING * 2;

/* ------------------------------- GRID ITEM ------------------------------- */

const GridItem = React.memo(({ item, index }: { item: ActionItem; index: number; }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const isFullWidth = index % 3 === 0;
  const widthPercent = isFullWidth ? '100%' : '48%';

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify().damping(14).mass(0.9)} style={[styles.gridWrapper, { width: widthPercent as any, minWidth: isFullWidth ? '100%' : Math.min((SCREEN_WIDTH - CONTAINER_PADDING * 2 - 20) / 2, 160) }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => {
          scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 300 });
        }}
        onPress={() => router.push(item.route as any)}>

        <Animated.View style={[styles.gridItem, isFullWidth && styles.gridItemFull, animatedStyle]}>
          <LinearGradient colors={item.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gridGradient}>

            {/* Distinctive Geometric Background Layer */}
            <View style={styles.decorativeShape1} />
            <View style={styles.decorativeShape2} />
            <View style={styles.decorativeLine} />
            {isFullWidth && <View style={styles.decorativeShapeFull} />}

            <View style={styles.gridContent}>
              <View style={styles.gridHeader}>
                <View style={[styles.iconBox, isFullWidth && styles.iconBoxFull]}>
                  <Ionicons name={item.icon} size={isFullWidth ? 32 : 24} color="#fff" />
                </View>
                {isFullWidth &&
                  <View style={styles.pillBadge}>
                    <Text style={styles.pillText}>{t('common.manage', 'Manage')}</Text>
                  </View>
                }
                {item.badge !== undefined && item.badge > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>{item.badge > 99 ? '99+' : item.badge}</Text>
                  </View>
                )}
              </View>
              <View style={[styles.textContainer, { width: '100%' }]}>
                <Text numberOfLines={isFullWidth ? 2 : 2} style={[styles.gridTitle, isFullWidth && styles.gridTitleFull]}>
                  {item.title}
                </Text>
                <View style={styles.actionRowContainer}>
                  {!isFullWidth && <View style={styles.divider} />}
                  {isFullWidth && <View style={{ flex: 1 }} />}
                  <View style={styles.arrowContainer}>
                    <Ionicons
                      name="arrow-forward"
                      size={isFullWidth ? 20 : 16}
                      color={item.gradient[0]}
                      style={{ marginLeft: 2 }} />

                  </View>
                </View>
              </View>
            </View>
            {/* Premium Glass-like Inner Border */}
            <View style={styles.glassBorder} />
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>);

});

/* ------------------------------ DASHBOARD CARD --------------------------- */

const DashboardCard = React.memo(({ item, onPress }: { item: StatItem; index: number; onPress: () => void; }) => {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }]
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 12, stiffness: 200 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
  };

  return (
    <View style={styles.statCardWrapper}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}>

        <Animated.View style={[styles.statCard, animatedStyle]}>
          <View style={styles.statCardHeader}>
            <View style={[styles.statIcon, { backgroundColor: item.bg }]}>
              <Ionicons name={item.icon} size={28} color={item.color} />
            </View>
            <View style={[styles.trendDot, { backgroundColor: item.color }]} />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statLabel}>{item.label}</Text>
            <Text style={styles.statValue}>{item.value}</Text>
          </View>
          <View style={styles.statFooter}>
            <Text style={[styles.statActionText, { color: item.color }]}>{t('common.view_details', 'View Details')}</Text>
            <Ionicons name="arrow-forward" size={16} color={item.color} />
          </View>
        </Animated.View>
      </Pressable>
    </View>);

});

/* -------------------------------------------------------------------------- */
/*                                  COMPONENT                                 */
/* -------------------------------------------------------------------------- */

export default function AdminDashboard() {
  const {
    user
  } = useAuth();
  const router = useRouter();
  const {
    t
  } = useTranslation();
  const [dashboardData, setDashboardData] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    // ... rest of file

    // Listen for access requests
    const fetchPendingCount = async () => {
      try {
        const requests = await AccessControlService.getPendingRequests();
        setPendingRequestsCount(requests.length);
      } catch (e) {
        console.error(e);
      }
    };
    fetchPendingCount();

    const channel = supabase
      .channel('access_req_badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'access_requests' }, fetchPendingCount)
      .subscribe();

    (async () => {
      try {
        // Determine logic based on silent?
        const data = await AdminService.getDashboardStats({
          silent: true
        });
        setDashboardData(data);
      } catch (err: any) {
        // Suppress expected error when switching roles
        if (err?.message?.includes('Student profile not found')) {

        } else {

        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);
  useFocusEffect(React.useCallback(() => {
    const onBackPress = () => {
      BackHandler.exitApp();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []));

  useEffect(() => {
    return () => {
      supabase.removeChannel(supabase.channel('access_req_badge'));
    };
  }, []);

  const {
    theme,
    isDark
  } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  /* --------------------------------- STATS -------------------------------- */

  const stats: StatItem[] = React.useMemo(() => [{
    label: t('admin_dashboard_v2.total_students', 'Total Students'),
    value: loading ? '—' : dashboardData?.totalStudents ?? 0,
    icon: 'people-outline',
    color: '#3B82F6',
    bg: '#EFF6FF',
    route: '/admin/students',
    trend: '', trendColor: '', trendBg: ''
  }, {
    label: t('admin_dashboard_v2.staff_present', 'Staff Present'),
    value: loading ? '—' : `${dashboardData?.staffPresent ?? 0} / ${dashboardData?.totalStaff ?? 0}`,
    icon: 'id-card-outline',
    color: '#10B981',
    bg: '#ECFDF5',
    route: '/admin/attendance',
    trend: '', trendColor: '', trendBg: ''
  }, {
    label: t('admin_dashboard_v2.collection', 'Collection'),
    value: loading ? '—' : `₹${(dashboardData?.collection ?? 0).toLocaleString()}`,
    icon: 'wallet-outline',
    color: '#F59E0B',
    bg: '#FFFBEB',
    route: '/admin/finance',
    trend: '', trendColor: '', trendBg: ''
  }, {
    label: t('admin_dashboard_v2.complaints', 'Complaints'),
    value: loading ? '—' : dashboardData?.complaints ?? 0,
    icon: 'alert-circle-outline',
    color: '#EF4444',
    bg: '#FEF2F2',
    route: '/admin/complaints',
    trend: '', trendColor: '', trendBg: ''
  }], [t, loading, dashboardData]);

  /* ------------------------------ QUICK ACTIONS ---------------------------- */

  /* ------------------------------ QUICK ACTIONS ---------------------------- */

  const quickActions: ActionItem[] = [
    // ─── Daily Use ───────────────────────────────────────────
    {
      title: t('admin_dashboard_v2.expense_tracker', 'Expense Tracker'),
      icon: 'receipt-outline',
      route: '/admin/expenses',
      gradient: ['#6366F1', '#4F46E5']
    }, {
      title: t('admin_dashboard_v2.notices', 'Notices'),
      icon: 'megaphone-outline',
      route: '/admin/notices',
      gradient: ['#F472B6', '#EC4899']
    }, {
      title: t('admin_dashboard_v2.leaves', 'Leaves'),
      icon: 'document-text-outline',
      route: '/admin/leaves',
      gradient: ['#818CF8', '#6366F1']
    }, {
      title: t('admin_dashboard_v2.complaints', 'Complaints'),
      icon: 'chatbubble-ellipses-outline',
      route: '/admin/complaints',
      gradient: ['#F87171', '#EF4444']
    }, {
      title: 'Access Requests', // Use raw string if translation doesn't exist
      icon: 'key-outline',
      route: '/admin/access-requests',
      gradient: ['#10B981', '#059669'],
      badge: pendingRequestsCount
    }, {
      title: t('admin_dashboard_v2.timetable_manager', 'Timetable Manager'),
      icon: 'calendar-outline',
      route: '/admin/timetable',
      gradient: ['#EA580C', '#F97316']
    },

    // ─── Weekly / Regular Use ────────────────────────────────
    {
      title: t('admin_dashboard_v2.view_reports', 'View Reports'),
      icon: 'bar-chart-outline',
      route: '/admin/reports',
      gradient: ['#60A5FA', '#3B82F6']
    }, {
      title: t('admin_dashboard_v2.smart_insights', 'Smart Insights'),
      icon: 'bulb-outline',
      route: '/admin/smart-insights',
      gradient: ['#6EE7B7', '#34D399']
    }, {
      title: t('admin_dashboard_v2.manage_staff', 'Manage Staff'),
      icon: 'people-outline',
      route: '/admin/manage-staff',
      gradient: ['#A78BFA', '#8B5CF6']
    }, {
      title: t('admin_dashboard_v2.transport', 'Transport'),
      icon: 'bus-outline',
      route: '/admin/transport',
      gradient: ['#FB923C', '#F97316']
    }, {
      title: t('admin_dashboard_v2.manage_content', 'Manage Content'),
      icon: 'library-outline',
      route: '/admin/manage-content',
      gradient: ['#14B8A6', '#0D9488']
    },

    // ─── Periodic / One-Time Setup ───────────────────────────
    {
      title: t('admin_dashboard_v2.progress_reports', 'Progress Reports'),
      icon: 'stats-chart-outline',
      route: '/admin/progress-report-generator',
      gradient: ['#C4B5FD', '#8B5CF6']
    }, {
      title: t('admin_dashboard_v2.certificates', 'Certificates'),
      icon: 'ribbon-outline',
      route: '/admin/certificate-generator',
      gradient: ['#22D3EE', '#06B6D4']
    }, {
      title: t('admin_dashboard_v2.academic_structure', 'Academic Structure'),
      icon: 'school-outline',
      route: '/admin/academics',
      gradient: ['#3B82F6', '#2DD4BF']
    }, {
      title: t('admin_dashboard_v2.fee_structure', 'Fee Structure'),
      icon: 'wallet-outline',
      route: '/admin/fees/set-class-fee',
      gradient: ['#6366F1', '#A855F7']
    }, {
      title: t('admin_dashboard_v2.add_accounts_staff', 'Add Accounts Staff'),
      icon: 'person-add-outline',
      route: '/admin/add-accounts-staff',
      gradient: ['#FBBF24', '#F59E0B']
    }];

  /* ---------------------------------- UI ---------------------------------- */

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event: any) => {
      scrollY.value = event.contentOffset.y;
    }
  });

  const pulse1 = useSharedValue(1);
  const pulse2 = useSharedValue(1);

  useEffect(() => {
    pulse1.value = withRepeat(withTiming(1.2, { duration: 4000 }), -1, true);
    pulse2.value = withRepeat(withTiming(1.3, { duration: 5000 }), -1, true);
  }, []);

  const blob1Style = useAnimatedStyle(() => ({ transform: [{ scale: pulse1.value }] }));
  const blob2Style = useAnimatedStyle(() => ({ transform: [{ scale: pulse2.value }] }));

  const carouselRef = React.useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const infiniteStats = useMemo(() => {
    if (!stats.length) return [];
    // Creates a long array of repeating stats for the illusion of an infinite loop
    return Array(200).fill(stats).flat();
  }, [stats]);

  useEffect(() => {
    if (!stats.length) return;

    // Start somewhere in the middle to allow seamless loop feeling
    const startIdx = Math.floor(100) * stats.length;
    setCurrentIndex(startIdx);
    setTimeout(() => {
      // Instantly snap to middle without animation on mount
      carouselRef.current?.scrollToOffset({
        offset: startIdx * (CARD_WIDTH + CARD_MARGIN),
        animated: false
      });
    }, 100);

    const autoScrollTimer = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        carouselRef.current?.scrollToOffset({
          offset: next * (CARD_WIDTH + CARD_MARGIN),
          animated: true
        });
        return next;
      });
    }, 3000);

    return () => clearInterval(autoScrollTimer);
  }, [stats.length]);

  return <View style={styles.container}>
    <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />

    {/* Animated Background Atmostphere */}
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.bgBlob, styles.bgBlob1, blob1Style, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)' }]} />
      <Animated.View style={[styles.bgBlob, styles.bgBlob2, blob2Style, { backgroundColor: isDark ? 'rgba(236, 72, 153, 0.15)' : 'rgba(236, 72, 153, 0.1)' }]} />
      <Animated.View style={[styles.bgBlob, styles.bgBlob3, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)' }]} />
    </View>

    <AdminHeader title={t('Dashboard')} showNotification scrollY={scrollY} />

    <Animated.ScrollView contentContainerStyle={[styles.content, {
      paddingTop: 100
    }]} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
      <ResponsiveCard maxWidth={1000}>
        {/* Greeting */}
        <View style={styles.greeting}>
          <Animated.View entering={FadeInDown.delay(100).springify().damping(15)}>
            <View style={styles.greetingLabelRow}>
              <View style={styles.greetingIndicator} />
              <Text style={styles.greetingSub}>{t('dashboard.good_morning', 'GOOD MORNING')}</Text>
            </View>
            <Text style={styles.greetingTitle}>
              {user?.display_name || 'Admin User'}
              <Text style={styles.greetingDot}>.</Text>
            </Text>
            <Text style={styles.greetingDate}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
          </Animated.View>
        </View>

        {/* Stats - Horizontal Auto-scroll */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <FlatList
            ref={carouselRef}
            data={infiniteStats}
            horizontal
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => `stat-${i}`}
            contentContainerStyle={styles.statsScrollContainer}
            renderItem={({ item, index }) =>
              <DashboardCard key={`card-${index}`} index={index % stats.length} item={item} onPress={() => router.push(item.route as any)} />
            }
            getItemLayout={(_, index) => ({
              length: CARD_WIDTH + CARD_MARGIN,
              offset: (CARD_WIDTH + CARD_MARGIN) * index,
              index
            })} />

        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Text style={styles.sectionTitle}>{t('dashboard.quick_actions', 'Quick Actions')}</Text>
        </Animated.View>

        <View style={styles.grid}>
          {quickActions.map((item, index) => <GridItem key={index} item={item} index={index} />)}
        </View>

        <View style={{ height: 40 }} />
      </ResponsiveCard>
    </Animated.ScrollView>
  </View>;
}

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                   STYLES                                   */
/* -------------------------------------------------------------------------- */
const getStyles = (theme: Theme, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  bgBlob: {
    position: 'absolute',
    borderRadius: 9999
  },
  bgBlob1: {
    width: 300,
    height: 300,
    top: -50,
    right: -50
  },
  bgBlob2: {
    width: 400,
    height: 400,
    top: '30%',
    left: -150
  },
  bgBlob3: {
    width: 250,
    height: 250,
    bottom: -50,
    right: -50
  },
  content: {
    padding: 20,
    paddingBottom: 40
  },
  /* Greeting */
  greeting: {
    marginBottom: 36,
    paddingHorizontal: 8,
    paddingTop: 10
  },
  greetingLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  greetingIndicator: {
    width: 4,
    height: 14,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
    marginRight: 8
  },
  greetingSub: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase'
  },
  greetingTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: -1.2,
    lineHeight: 48
  },
  greetingDot: {
    color: theme.colors.primary,
    fontSize: 46,
    lineHeight: 48
  },
  greetingDate: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginTop: 8,
    fontWeight: '600',
    letterSpacing: 0.3,
    opacity: 0.8
  },
  /* Stats */
  statsScrollContainer: {
    paddingRight: CONTAINER_PADDING,
    paddingBottom: 40
  },
  statCardWrapper: {
    width: CARD_WIDTH,
    marginRight: CARD_MARGIN
  },
  statCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 32,
    padding: 24,
    paddingBottom: 20,
    shadowColor: isDark ? '#000' : theme.colors.primary,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: isDark ? 0.3 : 0.06,
    shadowRadius: 32,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.05)',
    height: 220,
    justifyContent: 'space-between'
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  statIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  trendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 6
  },
  statTextContainer: {
    flex: 1,
    justifyContent: 'center',
    marginTop: 16
  },
  statLabel: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 8
  },
  statValue: {
    fontSize: 42,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: -1.5,
    lineHeight: 48
  },
  statFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.08)'
  },
  statActionText: {
    fontSize: 14,
    fontWeight: '800',
    marginRight: 6
  },
  /* Section */
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 20,
    paddingHorizontal: 4,
    letterSpacing: -0.3
  },
  /* Grid */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  gridWrapper: {
    marginBottom: 20
  },
  gridItem: {
    height: 170,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: isDark ? '#000' : theme.colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: isDark ? 0.3 : 0.15,
    shadowRadius: 24,
    elevation: 8
  },
  gridItemFull: {
    height: 180
  },
  gridGradient: {
    flex: 1,
    padding: 22,
    position: 'relative'
  },
  gridContent: {
    flex: 1,
    justifyContent: 'space-between',
    zIndex: 3
  },
  gridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 10
  },
  iconBoxFull: {
    width: 60,
    height: 60,
    borderRadius: 22
  },
  pillBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  pillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  notificationBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fff',
    position: 'absolute',
    top: -8,
    right: -8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    marginTop: 12
  },
  gridTitle: {
    fontSize: SCREEN_WIDTH < 400 ? 15 : 17, // Scaled down slightly for very narrow mobile devices
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.2,
    lineHeight: SCREEN_WIDTH < 400 ? 20 : 22
  },
  gridTitleFull: {
    fontSize: SCREEN_WIDTH < 400 ? 20 : 24,
    letterSpacing: -0.5,
    lineHeight: SCREEN_WIDTH < 400 ? 26 : 30,
    marginBottom: 10,
    // On web, if container limits it, force it to wrap instead of clip
    flexShrink: Platform.OS === 'web' ? 1 : 0,
    flexWrap: 'wrap'
  },
  actionRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto'
  },
  divider: {
    flex: 1,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginRight: 16,
    borderRadius: 2
  },
  arrowContainer: {
    width: 32,
    height: 32,
    backgroundColor: '#fff',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3
  },
  /* Decoration */
  decorativeShape1: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.1)',
    transform: [{ scaleX: 1.2 }, { rotate: '45deg' }],
    zIndex: 1
  },
  decorativeShape2: {
    position: 'absolute',
    bottom: -50,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
    transform: [{ rotate: '25deg' }],
    zIndex: 1
  },
  decorativeLine: {
    position: 'absolute',
    top: '40%',
    right: -40,
    width: 180,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    transform: [{ rotate: '-35deg' }],
    zIndex: 1
  },
  decorativeShapeFull: {
    position: 'absolute',
    top: -80,
    right: '15%',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255,255,255,0.08)',
    zIndex: 1
  },
  glassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 32,
    zIndex: 4,
    pointerEvents: 'none'
  }
});