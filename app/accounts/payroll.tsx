import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, StatusBar, Alert, Pressable, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, {
  FadeInDown, FadeIn,
  useAnimatedStyle, useSharedValue,
  withSpring, withTiming, withSequence, withRepeat,
  interpolate, Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { usePayroll } from '../../src/hooks/usePayroll';
import { PayrollEntry } from '../../src/types/payroll';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';

const { width: SW } = Dimensions.get('window');

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Designation color map ────────────────────────────────────────────────────
const DESIG_CONFIG: Record<string, { color: string; grad: [string, string]; icon: string }> = {
  Principal: { color: '#8B5CF6', grad: ['#5B21B6', '#8B5CF6'], icon: 'star-outline' },
  Teacher: { color: '#3B82F6', grad: ['#1D4ED8', '#3B82F6'], icon: 'book-outline' },
  Admin: { color: '#10B981', grad: ['#065F46', '#10B981'], icon: 'shield-outline' },
  Accountant: { color: '#F59E0B', grad: ['#B45309', '#F59E0B'], icon: 'calculator-outline' },
  Librarian: { color: '#EC4899', grad: ['#9D174D', '#EC4899'], icon: 'library-outline' },
  Driver: { color: '#EF4444', grad: ['#991B1B', '#EF4444'], icon: 'car-outline' },
  Staff: { color: '#6366F1', grad: ['#4338CA', '#6366F1'], icon: 'people-outline' },
};
const getDesig = (name?: string) => DESIG_CONFIG[name || ''] || DESIG_CONFIG.Staff;

const fmtINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const fmtDate = (d?: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }); }
  catch { return d; }
};

// ─── Skeleton Pulse ───────────────────────────────────────────────────────────
const Skeleton = ({ style }: { style: any }) => {
  const op = useSharedValue(0.35);
  useEffect(() => {
    op.value = withRepeat(
      withSequence(withTiming(0.9, { duration: 650 }), withTiming(0.35, { duration: 650 })),
      -1, false
    );
  }, []);
  return <Animated.View style={[style, useAnimatedStyle(() => ({ opacity: op.value }))]} />;
};

// ─── Month Navigator ──────────────────────────────────────────────────────────
const MonthNav = ({ month, year, onPrev, onNext, isDark }: any) => {
  const pressL = useSharedValue(1);
  const pressR = useSharedValue(1);

  return (
    <Animated.View entering={FadeInDown.duration(420)} style={[navSt.wrap, { backgroundColor: isDark ? '#111827' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }]}>
      {/* Prev */}
      <Pressable
        style={({ pressed }) => [navSt.arrow, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }, pressed && { opacity: 0.7 }]}
        onPress={onPrev}
      >
        <Ionicons name="chevron-back" size={18} color={isDark ? '#94A3B8' : '#64748B'} />
      </Pressable>

      {/* Month + year */}
      <View style={navSt.center}>
        <Text style={[navSt.monthTxt, { color: isDark ? '#E2E8F0' : '#0F172A' }]}>{MONTHS[month - 1]}</Text>
        <View style={[navSt.yearPill, { backgroundColor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.10)' }]}>
          <Text style={navSt.yearTxt}>{year}</Text>
        </View>
      </View>

      {/* Next */}
      <Pressable
        style={({ pressed }) => [navSt.arrow, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }, pressed && { opacity: 0.7 }]}
        onPress={onNext}
      >
        <Ionicons name="chevron-forward" size={18} color={isDark ? '#94A3B8' : '#64748B'} />
      </Pressable>
    </Animated.View>
  );
};
const navSt = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginTop: 16, borderRadius: 18, padding: 10, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  arrow: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  center: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthTxt: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  yearPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  yearTxt: { fontSize: 13, fontWeight: '700', color: '#6366F1' },
});

// ─── Summary Cards ────────────────────────────────────────────────────────────
const SummaryCards = ({ summary, total, count, isDark }: any) => {
  const cards = [
    { label: 'Total Payroll', value: fmtINR(summary.total_paid + summary.total_pending), icon: 'wallet-outline', grad: ['#4338CA', '#6366F1'] as [string, string] },
    { label: 'Disbursed', value: fmtINR(summary.total_paid), icon: 'checkmark-circle-outline', grad: ['#065F46', '#10B981'] as [string, string] },
    { label: 'Pending', value: fmtINR(summary.total_pending), icon: 'time-outline', grad: ['#B45309', '#F59E0B'] as [string, string] },
  ];
  return (
    <Animated.View entering={FadeInDown.delay(80).duration(440)}>
      <View style={sumSt.row}>
        {cards.map((c, i) => (
          <LinearGradient key={c.label} colors={c.grad} style={sumSt.card} start={{ x: 0.1, y: 0 }} end={{ x: 1, y: 1 }}>
            {/* Gloss */}
            <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} style={sumSt.gloss} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
            {/* Blob */}
            <View style={sumSt.blob} />
            <View style={sumSt.iconWrap}>
              <Ionicons name={c.icon as any} size={14} color="#fff" />
            </View>
            <Text style={sumSt.val}>{c.value}</Text>
            <Text style={sumSt.lbl}>{c.label}</Text>
          </LinearGradient>
        ))}
      </View>

      {/* Completion bar */}
      <Animated.View entering={FadeInDown.delay(140).duration(440)}>
        <CompletionBar paid={summary.total_paid} total={summary.total_paid + summary.total_pending} count={count} isDark={isDark} />
      </Animated.View>
    </Animated.View>
  );
};
const sumSt = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 16 },
  card: { flex: 1, borderRadius: 18, padding: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 8 },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: 40, borderRadius: 18 },
  blob: { position: 'absolute', right: -18, bottom: -18, width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.10)' },
  iconWrap: { width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.22)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  val: { fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: -0.4, marginBottom: 3 },
  lbl: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.72)', letterSpacing: 0.4, textTransform: 'uppercase' },
});

// ─── Animated Completion Bar ──────────────────────────────────────────────────
const CompletionBar = ({ paid, total, count, isDark }: any) => {
  const pct = total > 0 ? paid / total : 0;
  const width = useSharedValue(0);
  useEffect(() => { width.value = withTiming(pct, { duration: 900 }); }, [pct]);
  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%` as any,
  }));

  return (
    <View style={[barSt.wrap, { backgroundColor: isDark ? '#111827' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }]}>
      <View style={barSt.topRow}>
        <Text style={[barSt.title, { color: isDark ? '#E2E8F0' : '#0F172A' }]}>Payroll Progress</Text>
        <Text style={[barSt.pct, { color: '#6366F1' }]}>{Math.round(pct * 100)}%</Text>
      </View>
      <View style={[barSt.track, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
        <Animated.View style={[barSt.fill, barStyle]}>
          <LinearGradient colors={['#4338CA', '#6366F1']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
        </Animated.View>
      </View>
      <Text style={[barSt.sub, { color: isDark ? '#475569' : '#94A3B8' }]}>
        {count.paid} of {count.total} staff paid this month
      </Text>
    </View>
  );
};
const barSt = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginTop: 12, borderRadius: 18, padding: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 14, fontWeight: '700' },
  pct: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, minWidth: 10 },
  sub: { fontSize: 12, marginTop: 8, fontWeight: '500' },
});

// ─── Avatar with Initials Fallback ────────────────────────────────────────────
const StaffAvatar = ({ url, name, grad, size = 48 }: any) => {
  const [imgErr, setImgErr] = useState(false);
  const initials = name?.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  const r = size / 2;
  const innerR = (size - 4) / 2;

  if (!url || imgErr) {
    return (
      <LinearGradient colors={grad} style={[avSt.circle, { width: size, height: size, borderRadius: r }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
        <Text style={[avSt.initials, { fontSize: size * 0.30 }]}>{initials}</Text>
      </LinearGradient>
    );
  }
  return (
    <View style={[avSt.ring, { width: size + 4, height: size + 4, borderRadius: r + 2 }]}>
      <Image
        source={{ uri: url }}
        style={[avSt.img, { width: size, height: size, borderRadius: r }]}
        onError={() => setImgErr(true)}
      />
    </View>
  );
};
const avSt = StyleSheet.create({
  circle: { justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  initials: { color: '#fff', fontWeight: '900', letterSpacing: -0.5 },
  ring: { borderWidth: 2, borderColor: 'rgba(99,102,241,0.30)', justifyContent: 'center', alignItems: 'center' },
  img: { resizeMode: 'cover' },
});

// ─── Payroll Card ─────────────────────────────────────────────────────────────
const PayrollCard = ({
  item, index, onPay, isDark,
}: { item: PayrollEntry; index: number; onPay: () => void; isDark: boolean }) => {
  const person = item.staff?.person;
  const designation = item.staff?.designation?.name || 'Staff';
  const desig = getDesig(designation);
  const scale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isPaid = item.status === 'paid';
  const fullName = person?.display_name || `${person?.first_name || ''} ${person?.last_name || ''}`.trim() || 'Staff Member';

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(460).springify()}
      style={cardStyle}
    >
      <Pressable
        style={[
          crdSt.card,
          { backgroundColor: isDark ? '#111827' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
        ]}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 14, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 200 }); }}
      >
        {/* Left accent bar */}
        <View style={[crdSt.accentBar, { backgroundColor: desig.color }]} />

        <View style={crdSt.inner}>
          {/* Top: avatar + info + salary */}
          <View style={crdSt.topRow}>
            <StaffAvatar url={person?.photo_url} name={fullName} grad={desig.grad} size={46} />

            <View style={crdSt.infoArea}>
              <Text style={[crdSt.name, { color: isDark ? '#E2E8F0' : '#0F172A' }]} numberOfLines={1}>{fullName}</Text>
              <View style={crdSt.rolePill}>
                <View style={[crdSt.roleIcon, { backgroundColor: desig.color + '22' }]}>
                  <Ionicons name={desig.icon as any} size={10} color={desig.color} />
                </View>
                <Text style={[crdSt.roleText, { color: desig.color }]}>{designation}</Text>
              </View>
            </View>

            {/* Salary box */}
            <View style={[crdSt.salBox, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]}>
              <Text style={[crdSt.salLabel, { color: isDark ? '#475569' : '#94A3B8' }]}>NET</Text>
              <Text style={[crdSt.salary, { color: isDark ? '#E2E8F0' : '#0F172A' }]}>{fmtINR(item.net_salary)}</Text>
            </View>
          </View>

          {/* Breakdown row */}
          <View style={[crdSt.breakRow, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
            <View style={crdSt.breakItem}>
              <Text style={[crdSt.breakLabel, { color: isDark ? '#475569' : '#94A3B8' }]}>Base</Text>
              <Text style={[crdSt.breakVal, { color: isDark ? '#94A3B8' : '#475569' }]}>{fmtINR(item.base_salary ?? item.net_salary)}</Text>
            </View>
            <View style={[crdSt.breakDiv, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }]} />
            <View style={crdSt.breakItem}>
              <Text style={[crdSt.breakLabel, { color: isDark ? '#475569' : '#94A3B8' }]}>Deductions</Text>
              <Text style={[crdSt.breakVal, { color: '#EF4444' }]}>−{fmtINR(item.deductions ?? 0)}</Text>
            </View>
            <View style={[crdSt.breakDiv, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }]} />
            <View style={crdSt.breakItem}>
              <Text style={[crdSt.breakLabel, { color: isDark ? '#475569' : '#94A3B8' }]}>Bonus</Text>
              <Text style={[crdSt.breakVal, { color: '#10B981' }]}>+{fmtINR(item.bonus ?? 0)}</Text>
            </View>
          </View>

          {/* Footer: status + action */}
          <View style={crdSt.footer}>
            {isPaid ? (
              <>
                <View style={crdSt.paidBadge}>
                  <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                  <Text style={crdSt.paidBadgeText}>PAID</Text>
                </View>
                <Text style={[crdSt.dateText, { color: isDark ? '#475569' : '#94A3B8' }]}>
                  {fmtDate(item.payment_date ?? undefined)}
                </Text>
              </>
            ) : (
              <>
                <View style={crdSt.pendingBadge}>
                  <Ionicons name="time-outline" size={12} color="#F59E0B" />
                  <Text style={crdSt.pendingBadgeText}>PENDING</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [crdSt.payBtnWrap, pressed && { opacity: 0.85 }]}
                  onPress={onPay}
                >
                  <LinearGradient colors={['#4338CA', '#6366F1']} style={crdSt.payBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
                    <Ionicons name="card-outline" size={13} color="#fff" />
                    <Text style={crdSt.payBtnText}>Process Pay</Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};
const crdSt = StyleSheet.create({
  card: { flexDirection: 'row', borderRadius: 22, marginBottom: 13, overflow: 'hidden', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 5 },
  accentBar: { width: 4 },
  inner: { flex: 1, padding: 16, gap: 12 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  infoArea: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2, marginBottom: 5 },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  roleIcon: { width: 18, height: 18, borderRadius: 5, justifyContent: 'center', alignItems: 'center' },
  roleText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.1 },
  salBox: { borderRadius: 13, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', borderWidth: 1 },
  salLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  salary: { fontSize: 15, fontWeight: '900', letterSpacing: -0.4 },

  breakRow: { flexDirection: 'row', borderRadius: 12, padding: 10, borderWidth: 1 },
  breakItem: { flex: 1, alignItems: 'center', gap: 3 },
  breakLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  breakVal: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2 },
  breakDiv: { width: 1, marginVertical: 2 },

  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paidBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  paidBadgeText: { fontSize: 11, fontWeight: '800', color: '#065F46', letterSpacing: 0.8 },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  pendingBadgeText: { fontSize: 11, fontWeight: '800', color: '#92400E', letterSpacing: 0.8 },
  dateText: { fontSize: 12, fontWeight: '600' },
  payBtnWrap: { borderRadius: 12, overflow: 'hidden', shadowColor: '#4338CA', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  payBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12, overflow: 'hidden' },
  payBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },
});

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
const CardSkeleton = ({ isDark }: { isDark: boolean }) => (
  <View style={[crdSt.card, { backgroundColor: isDark ? '#111827' : '#fff', borderColor: 'transparent' }]}>
    <View style={[crdSt.accentBar, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]} />
    <View style={[crdSt.inner, { gap: 12 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
        <Skeleton style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton style={{ height: 14, width: '60%', borderRadius: 7, backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }} />
          <Skeleton style={{ height: 12, width: '35%', borderRadius: 6, backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }} />
        </View>
        <Skeleton style={{ width: 70, height: 48, borderRadius: 13, backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }} />
      </View>
      <Skeleton style={{ height: 44, borderRadius: 12, backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton style={{ width: 70, height: 28, borderRadius: 14, backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }} />
        <Skeleton style={{ width: 110, height: 36, borderRadius: 12, backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }} />
      </View>
    </View>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AccountsPayroll() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const {
    payrollData, loading, summary, selectedMonth, selectedYear,
    setSelectedMonth, setSelectedYear, fetchPayroll, markAsPaid,
  } = usePayroll();

  useEffect(() => { fetchPayroll(); }, [selectedMonth, selectedYear]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear((y: number) => y - 1); }
    else setSelectedMonth((m: number) => m - 1);
  };
  const handleNextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear((y: number) => y + 1); }
    else setSelectedMonth((m: number) => m + 1);
  };

  const handleProcessPay = (item: PayrollEntry) => {
    const name = item.staff?.person?.first_name || 'this staff member';
    Alert.alert(
      'Confirm Payment',
      `Release ${fmtINR(item.net_salary)} to ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Release', onPress: async () => {
            const ok = await markAsPaid(item.id);
            if (!ok) Alert.alert('Error', 'Failed to update payment status.');
          }
        },
      ]
    );
  };

  const paidCount = payrollData.filter(e => e.status === 'paid').length;
  const count = { paid: paidCount, total: payrollData.length };

  const renderItem = ({ item, index }: { item: PayrollEntry; index: number }) => (
    <PayrollCard item={item} index={index} onPay={() => handleProcessPay(item)} isDark={isDark} />
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#0A0F1E' : '#F1F5F9'} />
      <AdminHeader title="Payroll" showBackButton />

      <MonthNav month={selectedMonth} year={selectedYear} onPrev={handlePrevMonth} onNext={handleNextMonth} isDark={isDark} />

      <SummaryCards summary={summary} total={payrollData.length} count={count} isDark={isDark} />

      {loading ? (
        <FlatList
          data={[1, 2, 3, 4]}
          keyExtractor={i => String(i)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={() => <CardSkeleton isDark={isDark} />}
        />
      ) : (
        <FlatList
          data={payrollData}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={fetchPayroll}
          ListEmptyComponent={
            <Animated.View entering={FadeIn.duration(400)} style={styles.emptyWrap}>
              <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? '#1E293B' : '#EEF2FF' }]}>
                <Ionicons name="people-outline" size={32} color={isDark ? '#374151' : '#A5B4FC'} />
              </View>
              <Text style={[styles.emptyTitle, { color: isDark ? '#475569' : '#64748B' }]}>No payroll records</Text>
              <Text style={[styles.emptySub, { color: isDark ? '#374151' : '#94A3B8' }]}>Records will appear once generated</Text>
            </Animated.View>
          }
        />
      )}
    </View>
  );
}

// ─── Root Styles ──────────────────────────────────────────────────────────────
const getStyles = (theme: Theme, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? '#0A0F1E' : '#F1F5F9' },
  listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyIconWrap: { width: 76, height: 76, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  emptySub: { fontSize: 13, fontWeight: '500' },
});