import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  Pressable, Dimensions, NativeScrollEvent, NativeSyntheticEvent
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown, useAnimatedStyle, useSharedValue, withSpring, withTiming,
  interpolate, Extrapolation
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AdminHeader from '../../src/components/AdminHeader';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/hooks/useAuth';
import { FeeService as FeesService } from '../../src/services/feeService';
import { useTheme } from '../../src/hooks/useTheme';
import LogoLoader from '../../src/components/LogoLoader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AVATAR_PALETTE = ['#818CF8', '#22D3A0', '#F5C842', '#63B3ED', '#F2546A', '#A78BFA', '#34D399'];
const CARD_H_PAD = 20;
const GRID_GAP = 14;
const GRID_COLS = 3;
const GRID_ITEM_WIDTH =
  (SCREEN_WIDTH - CARD_H_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

// ─── Dot Grid Texture (pure View-based, no SVG needed) ────────────────────────
const DotGrid = () => {
  const dots = [];
  const cols = 5;
  const rows = 4;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push(
        <View
          key={`${r}-${c}`}
          style={{
            position: 'absolute',
            width: 2.5,
            height: 2.5,
            borderRadius: 1.5,
            backgroundColor: 'rgba(255,255,255,0.18)',
            top: r * 14 + 8,
            left: c * 13 + 6,
          }}
        />
      );
    }
  }
  return <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>{dots}</View>;
};

// ─── GridItem ─────────────────────────────────────────────────────────────────
const GridItem = ({ item, index, router, styles, isDark }: {
  item: any; index: number; router: any; styles: any; isDark: boolean;
}) => {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.88, { damping: 14, stiffness: 320 });
    glow.value = withTiming(1, { duration: 150 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 180 });
    glow.value = withTiming(0, { duration: 250 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(item.route);
  };

  const IconLib = item.library;
  // Derive a lighter accent for the icon ring from the first gradient color
  const accentLight = item.color[0] + '55';

  return (
    <Animated.View
      entering={FadeInDown.delay(300 + index * 55).duration(500).springify()}
      style={styles.gridItemWrapper}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <Pressable
          style={({ pressed }) => [styles.gridItem]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePress}>

          <LinearGradient
            colors={item.color as [string, string]}
            style={styles.gridGradient}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.95, y: 1 }}>

            {/* ── Dot grid texture ── */}
            <DotGrid />

            {/* ── Top-edge highlight stripe ── */}
            <View style={styles.topHighlight} />

            {/* ── Large background arc ── */}
            <View style={styles.bgArc} />

            {/* ── Small corner orb ── */}
            <View style={styles.cornerOrb} />

            {/* ── Press glow overlay ── */}
            <Animated.View style={[styles.pressGlow, glowStyle]} />

            {/* ── Icon container (glassmorphic ring) ── */}
            <View style={styles.iconRingOuter}>
              <View style={[styles.iconRingInner, { borderColor: 'rgba(255,255,255,0.40)' }]}>
                <IconLib name={item.icon as any} size={20} color="#fff" />
              </View>
            </View>

            {/* ── Label row ── */}
            <View style={styles.labelRow}>
              <Text style={styles.gridLabel} numberOfLines={2}>{item.title}</Text>
              {/* Tiny chevron to signal tappability */}
              <View style={styles.chevronWrap}>
                <Ionicons name="chevron-forward" size={9} color="rgba(255,255,255,0.65)" />
              </View>
            </View>

          </LinearGradient>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function AccountsDashboard() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const carouselRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { loadData(); }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await FeesService.getDashboardStats();
      setStatsData({
        totalCollection: `₹${data.monthly_collection.toLocaleString()}`,
        todaysCollection: `₹${data.today_collection.toLocaleString()}`,
        pendingDues: `₹${data.pending_dues.toLocaleString()}`
      });
      const mapped = data.recent_transactions.map((tx: any) => ({
        id: tx.id,
        name: tx.student_name,
        class: tx.class_name || 'N/A',
        type: tx.fee_type || 'Fee',
        amount: `+₹${tx.amount.toLocaleString()}`,
        time: new Date(tx.collected_at).toLocaleDateString()
      }));
      setTransactions(mapped);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const carouselCards = useMemo(() => [
    {
      id: 'monthly',
      label: t('accounts_dashboard.total_collection_month'),
      value: loading ? '—' : statsData?.totalCollection || '₹0',
      icon: 'wallet',
      grad: ['#1D4ED8', '#3B82F6'] as [string, string],
      showLive: true,
      watermark: 'chart-bar',
    },
    {
      id: 'today',
      label: t('accounts_dashboard.todays_collection'),
      value: loading ? '—' : statsData?.todaysCollection || '₹0',
      icon: 'wallet',
      grad: ['#059669', '#10B981'] as [string, string],
      showLive: false,
      watermark: 'arrow-circle-up',
    },
    {
      id: 'pending',
      label: t('accounts_dashboard.pending_dues'),
      value: loading ? '—' : statsData?.pendingDues || '₹0',
      icon: 'file-invoice-dollar',
      grad: ['#B91C1C', '#EF4444'] as [string, string],
      showLive: false,
      watermark: 'exclamation-circle',
    },
  ], [loading, statsData, t]);

  const startTimer = () => {
    stopTimer();
    timerRef.current = setInterval(() => {
      setActiveIndex(prev => {
        const next = (prev + 1) % carouselCards.length;
        carouselRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
        return next;
      });
    }, 5000);
  };
  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  useEffect(() => { startTimer(); return () => stopTimer(); }, [carouselCards.length]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(i);
    startTimer();
  };

  const quickActions = [
    { id: 'collect', title: t('accounts_dashboard.collect_fees', 'Collect Fees'), icon: 'cash', color: ['#10B981', '#059669'] as [string, string], route: '/accounts/fees', library: Ionicons },
    { id: 'expenses', title: t('accounts_dashboard.expenses', 'Expenses'), icon: 'receipt', color: ['#EF4444', '#B91C1C'] as [string, string], route: '/accounts/expenses', library: Ionicons },
    { id: 'payroll', title: t('accounts_dashboard.payroll', 'Payroll'), icon: 'people', color: ['#6366F1', '#4338CA'] as [string, string], route: '/accounts/payroll', library: Ionicons },
    { id: 'defaulters', title: t('accounts_dashboard.defaulters', 'Defaulters'), icon: 'alert-circle', color: ['#F59E0B', '#D97706'] as [string, string], route: '/accounts/defaulters', library: Ionicons },
    { id: 'invoices', title: t('accounts_dashboard.invoices', 'Invoices'), icon: 'document-text', color: ['#3B82F6', '#2563EB'] as [string, string], route: '/accounts/invoices', library: Ionicons },
    { id: 'receipts', title: t('accounts_dashboard.receipts', 'Receipts'), icon: 'documents', color: ['#0EA5E9', '#0284C7'] as [string, string], route: '/accounts/receipts', library: Ionicons },
    { id: 'staff', title: t('accounts_dashboard.addStaff', 'Add Staff'), icon: 'person-add', color: ['#8B5CF6', '#7C3AED'] as [string, string], route: '/accounts/addStaff', library: Ionicons },
    { id: 'student', title: t('accounts_dashboard.addStudent', 'Add Student'), icon: 'school', color: ['#F43F5E', '#E11D48'] as [string, string], route: '/accounts/addStudent', library: Ionicons },
    { id: 'pending_enrollments', title: t('accounts_dashboard.pending_enrollments', 'Pending Enrollments'), icon: 'person-add-outline', color: ['#8B5CF6', '#7C3AED'] as [string, string], route: '/accounts/pending-enrollments', library: Ionicons },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      <AdminHeader title="Accounts" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        overScrollMode="never"
        bounces>

        {/* ── GREETING ── */}
        <Animated.View entering={FadeInDown.duration(480)} style={styles.greetingContainer}>
          <Text style={styles.greetingEyebrow}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
          </Text>
          <Text style={styles.greetingText}>Hello, {user?.first_name || 'Admin'} 👋</Text>
          <Text style={styles.greetingSubText}>
            {t('accounts_dashboard.welcome_back', 'Here is your financial overview')}
          </Text>
        </Animated.View>

        {/* ── STATS CAROUSEL ── */}
        <Animated.View entering={FadeInDown.delay(80).springify()}>
          <ScrollView
            ref={carouselRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumEnd}
            onScrollBeginDrag={stopTimer}
            onScrollEndDrag={startTimer}
            decelerationRate="fast"
            bounces={false}
            overScrollMode="never"
            style={styles.carouselScroll}>
            {carouselCards.map((card) => (
              <View key={card.id} style={styles.carouselSlide}>
                <LinearGradient
                  colors={card.grad}
                  style={styles.carouselCard}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}>
                  <View style={styles.cardBlob1} />
                  <View style={styles.cardBlob2} />
                  <View style={styles.cardBlob3} />
                  <View style={styles.cardWatermark}>
                    <FontAwesome5 name={card.watermark as any} size={72} color="rgba(255,255,255,0.07)" />
                  </View>
                  <View style={styles.cardContent}>
                    <View style={styles.cardIconWrap}>
                      <FontAwesome5 name={card.icon as any} size={20} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardLabel}>{card.label}</Text>
                      <Text style={styles.cardValue}>{card.value}</Text>
                      {card.showLive && (
                        <View style={styles.liveBadge}>
                          <View style={styles.liveDot} />
                          <Text style={styles.liveText}>LIVE</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </LinearGradient>
              </View>
            ))}
          </ScrollView>
          <View style={styles.dotsRow}>
            {carouselCards.map((_, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  carouselRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: true });
                  setActiveIndex(i);
                  startTimer();
                }}>
                <View style={[styles.dot, i === activeIndex && styles.dotActive]} />
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* ── QUICK ACTIONS ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionAccentBar} />
            <Text style={styles.sectionTitle}>{t('dashboard.quick_actions', 'Quick Actions')}</Text>
          </View>
          <View style={styles.actionCountPill}>
            <Text style={styles.actionCountText}>{quickActions.length}</Text>
          </View>
        </View>

        <View style={styles.gridContainer}>
          {quickActions.map((action, index) => (
            <GridItem
              key={action.id}
              item={action}
              index={index}
              router={router}
              styles={styles}
              isDark={isDark}
            />
          ))}
        </View>

        {/* ── RECENT TRANSACTIONS ── */}
        <View style={[styles.sectionHeader, { marginTop: 4 }]}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionAccentBar, { backgroundColor: '#10B981' }]} />
            <Text style={styles.sectionTitle}>{t('dashboard.recent_transactions', 'Recent Transactions')}</Text>
          </View>
          <Pressable onPress={() => { }}>
            <Text style={styles.sectionLink}>View all →</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <LogoLoader size={30} color="#3B82F6" />
          </View>
        ) : (
          transactions.map((tx, index) => {
            const accent = AVATAR_PALETTE[index % AVATAR_PALETTE.length];
            return (
              <Animated.View
                key={tx.id}
                entering={FadeInDown.delay(380 + index * 70).springify()}
                style={styles.txCard}>
                <View style={styles.txLeft}>
                  <View style={[styles.avatar, { backgroundColor: accent + '15', borderColor: accent + '30' }]}>
                    <Text style={[styles.avatarText, { color: accent }]}>
                      {tx.name?.[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txName}>{tx.name}</Text>
                    <Text style={styles.txSub}>{tx.class} · {tx.type}</Text>
                  </View>
                </View>
                <View style={styles.txRight}>
                  <Text style={styles.txAmount}>{tx.amount}</Text>
                  <Text style={styles.txTime}>{tx.time}</Text>
                </View>
              </Animated.View>
            );
          })
        )}

        {!loading && transactions.length === 0 && (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyState}>
            <FontAwesome5 name="receipt" size={28} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>No recent transactions.</Text>
          </Animated.View>
        )}

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({

  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingTop: 8, paddingBottom: 52 },

  greetingContainer: { paddingHorizontal: 20, marginBottom: 20, marginTop: 14 },
  greetingEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 2.2, color: theme.colors.textSecondary, marginBottom: 7 },
  greetingText: { fontSize: 27, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.7, lineHeight: 33 },
  greetingSubText: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 5, fontWeight: '500' },

  // ── Carousel ──
  carouselScroll: { marginBottom: 10 },
  carouselSlide: { width: SCREEN_WIDTH, paddingHorizontal: 20 },
  carouselCard: {
    borderRadius: 26, height: 140, overflow: 'hidden',
    justifyContent: 'flex-end', padding: 22,
    shadowColor: '#000', shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.40, shadowRadius: 24, elevation: 14,
  },
  cardBlob1: { position: 'absolute', top: -40, right: -40, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.10)' },
  cardBlob2: { position: 'absolute', bottom: -24, left: -24, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.07)' },
  cardBlob3: { position: 'absolute', top: 20, right: 80, width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.06)' },
  cardWatermark: { position: 'absolute', right: 18, bottom: 10, opacity: 1 },
  cardContent: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cardIconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.20)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  cardLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.75)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 },
  cardValue: { fontSize: 32, fontWeight: '800', color: '#ffffff', letterSpacing: -1 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#86efac' },
  liveText: { fontSize: 9, fontWeight: '800', color: '#86efac', letterSpacing: 1.5 },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 30, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)' },
  dotActive: { width: 22, backgroundColor: '#3B82F6' },

  // ── Section header ──
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, marginBottom: 16,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionAccentBar: {
    width: 4, height: 18, borderRadius: 2,
    backgroundColor: '#3B82F6',
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.3 },
  sectionLink: { fontSize: 13, fontWeight: '700', color: '#3B82F6' },
  actionCountPill: {
    backgroundColor: isDark ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.10)',
    borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3,
    borderWidth: 1, borderColor: isDark ? 'rgba(59,130,246,0.30)' : 'rgba(59,130,246,0.20)',
  },
  actionCountText: { fontSize: 11, fontWeight: '800', color: '#3B82F6', letterSpacing: 0.2 },

  // ── Quick Action Grid ──
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: CARD_H_PAD,
    gap: GRID_GAP,
    marginBottom: 32,
  },

  gridItemWrapper: {
    width: GRID_ITEM_WIDTH,
    height: GRID_ITEM_WIDTH + 16,   // taller to accommodate label + icon comfortably
  },

  gridItem: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    // Rich shadow: two-layer effect via elevation + shadow props
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: isDark ? 0.55 : 0.28,
    shadowRadius: 18,
    elevation: 12,
  },

  gridGradient: {
    flex: 1,
    padding: 13,
    justifyContent: 'space-between',
    // Inner top border for the "glass edge" look
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.22)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.14)',
  },

  // Top-edge highlight — thin luminous stripe at the very top
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },

  // Large background arc — replaces dumb circles, sits bottom-right
  bgArc: {
    position: 'absolute',
    right: -28,
    bottom: -28,
    width: GRID_ITEM_WIDTH * 0.85,
    height: GRID_ITEM_WIDTH * 0.85,
    borderRadius: GRID_ITEM_WIDTH * 0.425,
    backgroundColor: 'rgba(255,255,255,0.09)',
    // Inner border on the arc for depth
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  // Small top-left orb
  cornerOrb: {
    position: 'absolute',
    left: -14,
    top: -14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // Press glow overlay
  pressGlow: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 24,
  },

  // Glassmorphic icon container: double-ring design
  iconRingOuter: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    // Subtle outer glow via shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.20,
    shadowRadius: 6,
    elevation: 4,
  },
  iconRingInner: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },

  // Label row with inline chevron
  labelRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 2,
  },
  gridLabel: {
    flex: 1,
    color: '#fff',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: -0.15,
    lineHeight: 15,
    textShadowColor: 'rgba(0,0,0,0.30)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  chevronWrap: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
    flexShrink: 0,
  },

  // ── Transactions ──
  txCard: {
    marginHorizontal: 20,
    backgroundColor: theme.colors.card,
    borderRadius: 18,
    paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: isDark ? 0.28 : 0.05,
    shadowRadius: 9,
    elevation: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  txLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 13, borderWidth: 1.5, flexShrink: 0,
  },
  avatarText: { fontSize: 16, fontWeight: '800' },
  txName: { fontSize: 15, fontWeight: '700', color: theme.colors.text, letterSpacing: -0.2 },
  txSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2, fontWeight: '500' },
  txRight: { alignItems: 'flex-end', flexShrink: 0 },
  txAmount: { fontSize: 15, fontWeight: '800', color: theme.colors.success, letterSpacing: -0.3 },
  txTime: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 3, fontWeight: '500' },

  loaderWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 36, gap: 12 },
  emptyText: { textAlign: 'center', color: theme.colors.textSecondary, fontSize: 14, fontWeight: '500' },
});