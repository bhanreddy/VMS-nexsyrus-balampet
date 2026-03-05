import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, StatusBar, Modal, Alert, KeyboardAvoidingView,
  Platform, ScrollView, Pressable, Dimensions,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, {
  FadeInDown, FadeIn, Layout,
  useAnimatedStyle, useSharedValue,
  withTiming, withSpring, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useExpenses } from '../../src/hooks/useExpenses';
import { useAuth } from '../../src/hooks/useAuth';
import { CreateExpenseRequest, Expense } from '../../src/types/expenses';
import { PolicyService } from '../../src/services/policyService';
import NetBalanceTab from '../../src/components/NetBalanceTab';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';

const { width: SW } = Dimensions.get('window');

// ─── Category config ──────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { icon: string; color: string; grad: [string, string] }> = {
  Education: { icon: 'book-outline', color: '#3B82F6', grad: ['#1D4ED8', '#3B82F6'] },
  Maintenance: { icon: 'construct-outline', color: '#F59E0B', grad: ['#B45309', '#F59E0B'] },
  Sports: { icon: 'football-outline', color: '#10B981', grad: ['#065F46', '#10B981'] },
  Utility: { icon: 'flash-outline', color: '#8B5CF6', grad: ['#5B21B6', '#8B5CF6'] },
  Events: { icon: 'calendar-outline', color: '#EC4899', grad: ['#9D174D', '#EC4899'] },
  Salary: { icon: 'cash-outline', color: '#14B8A6', grad: ['#0F766E', '#14B8A6'] },
  Other: { icon: 'ellipsis-horizontal-outline', color: '#6B7280', grad: ['#374151', '#6B7280'] },
};
const CATEGORIES = Object.keys(CATEGORY_CONFIG);

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending: { color: '#F59E0B', bg_light: '#FEF3C7', bg_dark: '#451A03', label: 'PENDING', icon: 'time-outline' },
  approved: { color: '#10B981', bg_light: '#D1FAE5', bg_dark: '#052E16', label: 'APPROVED', icon: 'checkmark-circle-outline' },
  paid: { color: '#3B82F6', bg_light: '#DBEAFE', bg_dark: '#172554', label: 'PAID', icon: 'card-outline' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }); }
  catch { return d; }
};

// ─── Animated Tab Bar ─────────────────────────────────────────────────────────
const TabBar = ({ active, onChange, isDark }: { active: 'list' | 'balance'; onChange: (t: any) => void; isDark: boolean }) => {
  const tabs = [
    { key: 'list', label: 'Expenses', icon: 'receipt-outline' },
    { key: 'balance', label: 'Net Balance', icon: 'stats-chart-outline' },
  ];
  const offset = useSharedValue(active === 'list' ? 0 : 1);
  useEffect(() => { offset.value = withSpring(active === 'list' ? 0 : 1, { damping: 16, stiffness: 220 }); }, [active]);
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(offset.value, [0, 1], [0, (SW - 40) / 2], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={[tabSt.wrap, { backgroundColor: isDark ? '#111827' : '#F1F5F9', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
      <Animated.View style={[tabSt.indicator, { width: (SW - 40) / 2 }, indicatorStyle]}>
        <LinearGradient colors={['#4F46E5', '#6366F1']} style={tabSt.indicatorGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
      </Animated.View>
      {tabs.map(tab => {
        const isActive = active === tab.key;
        return (
          <Pressable key={tab.key} style={tabSt.tab} onPress={() => onChange(tab.key)}>
            <Ionicons name={tab.icon as any} size={16} color={isActive ? '#fff' : (isDark ? '#475569' : '#94A3B8')} />
            <Text style={[tabSt.label, { color: isActive ? '#fff' : (isDark ? '#475569' : '#94A3B8') }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};
const tabSt = StyleSheet.create({
  wrap: { flexDirection: 'row', marginHorizontal: 20, marginTop: 14, marginBottom: 4, borderRadius: 16, padding: 4, borderWidth: 1, position: 'relative', overflow: 'hidden' },
  indicator: { position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: 13, overflow: 'hidden', zIndex: 0 },
  indicatorGrad: { flex: 1, borderRadius: 13 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, zIndex: 1 },
  label: { fontSize: 13, fontWeight: '700', letterSpacing: 0.1 },
});

// ─── Search Bar ───────────────────────────────────────────────────────────────
const SearchBar = ({ value, onChange, isDark }: any) => {
  const focused = useSharedValue(0);
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: focused.value === 1 ? '#6366F1' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
    borderWidth: focused.value === 1 ? 1.5 : 1,
  }));
  return (
    <Animated.View style={[srchSt.wrap, { backgroundColor: isDark ? '#111827' : '#fff' }, borderStyle]}>
      <Ionicons name="search-outline" size={18} color={isDark ? '#475569' : '#94A3B8'} style={{ marginRight: 10 }} />
      <TextInput
        style={[srchSt.input, { color: isDark ? '#E2E8F0' : '#0F172A' }]}
        placeholder="Search expenses…"
        placeholderTextColor={isDark ? '#374151' : '#CBD5E1'}
        value={value}
        onChangeText={onChange}
        onFocus={() => { focused.value = withTiming(1, { duration: 160 }); }}
        onBlur={() => { focused.value = withTiming(0, { duration: 180 }); }}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange('')}>
          <Ionicons name="close-circle" size={18} color={isDark ? '#475569' : '#94A3B8'} />
        </Pressable>
      )}
    </Animated.View>
  );
};
const srchSt = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginVertical: 14, borderRadius: 14, paddingHorizontal: 14, height: 46 },
  input: { flex: 1, fontSize: 15, fontWeight: '500' },
});

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status, isDark }: { status: string; isDark: boolean }) => {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  return (
    <View style={[badgeSt.wrap, { backgroundColor: isDark ? cfg.bg_dark : cfg.bg_light }]}>
      <Ionicons name={cfg.icon as any} size={10} color={cfg.color} />
      <Text style={[badgeSt.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};
const badgeSt = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  text: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
});

// ─── Expense Card ─────────────────────────────────────────────────────────────
const ExpenseCard = ({ item, index, onPress, isDark }: { item: Expense; index: number; onPress: () => void; isDark: boolean }) => {
  const cat = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.Other;
  const scale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 55).duration(430).springify()}
      style={cardStyle}
    >
      <Pressable
        style={({ pressed }) => [
          cardSt.card,
          { backgroundColor: isDark ? '#111827' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
          pressed && { opacity: 0.92 },
        ]}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 14, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 200 }); }}
        onPress={onPress}
      >
        {/* Category accent bar */}
        <View style={[cardSt.accentBar, { backgroundColor: cat.color }]} />

        <View style={cardSt.inner}>
          {/* Top row */}
          <View style={cardSt.topRow}>
            <LinearGradient colors={cat.grad} style={cardSt.iconWrap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Ionicons name={cat.icon as any} size={16} color="#fff" />
            </LinearGradient>

            <View style={cardSt.titleArea}>
              <Text style={[cardSt.title, { color: isDark ? '#E2E8F0' : '#0F172A' }]} numberOfLines={1}>{item.title}</Text>
              <Text style={[cardSt.meta, { color: isDark ? '#475569' : '#94A3B8' }]}>
                {fmtDate(item.expense_date)} · {item.category}
              </Text>
            </View>

            <Text style={[cardSt.amount, { color: '#EF4444' }]}>{fmtINR(item.amount)}</Text>
          </View>

          {/* Bottom row */}
          <View style={cardSt.bottomRow}>
            {item.description
              ? <Text style={[cardSt.desc, { color: isDark ? '#374151' : '#CBD5E1' }]} numberOfLines={1}>{item.description}</Text>
              : <View style={{ flex: 1 }} />
            }
            <StatusBadge status={item.status} isDark={isDark} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};
const cardSt = StyleSheet.create({
  card: {
    flexDirection: 'row', borderRadius: 20, marginBottom: 12, overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 4,
  },
  accentBar: { width: 4 },
  inner: { flex: 1, padding: 15 },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 12 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  titleArea: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginBottom: 2 },
  meta: { fontSize: 12, fontWeight: '500' },
  amount: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, flexShrink: 0 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  desc: { fontSize: 12, fontWeight: '500', flex: 1, marginRight: 8 },
});

// ─── Summary Strip ────────────────────────────────────────────────────────────
const SummaryStrip = ({ expenses, isDark }: { expenses: Expense[]; isDark: boolean }) => {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const pending = expenses.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0);
  const paid = expenses.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0);
  const items = [
    { label: 'Total', value: fmtINR(total), color: '#6366F1' },
    { label: 'Pending', value: fmtINR(pending), color: '#F59E0B' },
    { label: 'Paid', value: fmtINR(paid), color: '#10B981' },
  ];
  return (
    <View style={[stripSt.wrap, { backgroundColor: isDark ? '#111827' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          <View style={stripSt.item}>
            <Text style={[stripSt.val, { color: item.color }]}>{item.value}</Text>
            <Text style={[stripSt.lbl, { color: isDark ? '#475569' : '#94A3B8' }]}>{item.label}</Text>
          </View>
          {i < items.length - 1 && <View style={[stripSt.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} />}
        </React.Fragment>
      ))}
    </View>
  );
};
const stripSt = StyleSheet.create({
  wrap: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 14, borderRadius: 18, padding: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  val: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  lbl: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
  divider: { width: 1, marginVertical: 4 },
});

// ─── Bottom-Sheet Modal wrapper ───────────────────────────────────────────────
const BottomSheet = ({ visible, onClose, children, isDark, title, subtitle }: any) => (
  <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
    <Pressable style={sheetSt.overlay} onPress={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={sheetSt.kvWrap}>
        <Pressable style={[sheetSt.sheet, { backgroundColor: isDark ? '#111827' : '#fff' }]} onPress={() => { }}>
          <View style={sheetSt.handle} />
          <View style={sheetSt.headerRow}>
            <View>
              <Text style={[sheetSt.title, { color: isDark ? '#E2E8F0' : '#0F172A' }]}>{title}</Text>
              {subtitle && <Text style={[sheetSt.subtitle, { color: isDark ? '#475569' : '#94A3B8' }]}>{subtitle}</Text>}
            </View>
            <Pressable style={[sheetSt.closeBtn, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]} onPress={onClose}>
              <Ionicons name="close" size={18} color={isDark ? '#94A3B8' : '#64748B'} />
            </Pressable>
          </View>
          {children}
        </Pressable>
      </KeyboardAvoidingView>
    </Pressable>
  </Modal>
);
const sheetSt = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  kvWrap: { justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 22, paddingBottom: 36 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, marginTop: 3, fontWeight: '500' },
  closeBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
});

// ─── Form Input ───────────────────────────────────────────────────────────────
const FormInput = ({ label, value, onChange, placeholder, multiline = false, keyboardType = 'default', isDark, required = false }: any) => {
  const focused = useSharedValue(0);
  const bStyle = useAnimatedStyle(() => ({
    borderColor: focused.value === 1 ? '#6366F1' : (isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)'),
    borderWidth: focused.value === 1 ? 1.5 : 1,
  }));
  return (
    <View style={formSt.group}>
      <Text style={[formSt.label, { color: isDark ? '#64748B' : '#64748B' }]}>
        {label}{required && <Text style={{ color: '#EF4444' }}> *</Text>}
      </Text>
      <Animated.View style={[formSt.wrap, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }, multiline && { height: 90, alignItems: 'flex-start', paddingVertical: 12 }, bStyle]}>
        <TextInput
          style={[formSt.input, { color: isDark ? '#E2E8F0' : '#0F172A' }, multiline && { textAlignVertical: 'top', height: 66 }]}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#374151' : '#CBD5E1'}
          value={value}
          onChangeText={onChange}
          multiline={multiline}
          keyboardType={keyboardType}
          onFocus={() => { focused.value = withTiming(1, { duration: 160 }); }}
          onBlur={() => { focused.value = withTiming(0, { duration: 180 }); }}
        />
      </Animated.View>
    </View>
  );
};
const formSt = StyleSheet.create({
  group: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 7, letterSpacing: 0.1 },
  wrap: { borderRadius: 13, paddingHorizontal: 14, height: 48, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontSize: 15, fontWeight: '500' },
});

// ─── Category Chip Row ────────────────────────────────────────────────────────
const CategoryChips = ({ value, onChange, isDark }: any) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={[formSt.label, { color: isDark ? '#64748B' : '#64748B' }]}>Category</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginLeft: -2 }}>
      {CATEGORIES.map(cat => {
        const cfg = CATEGORY_CONFIG[cat];
        const active = value === cat;
        return (
          <Pressable
            key={cat}
            style={({ pressed }) => [
              chipSt.chip,
              { backgroundColor: active ? cfg.color + '18' : (isDark ? '#1E293B' : '#F8FAFC') },
              { borderColor: active ? cfg.color : (isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)') },
              { borderWidth: active ? 1.5 : 1 },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => onChange(cat)}
          >
            <View style={[chipSt.iconWrap, { backgroundColor: active ? cfg.color : (isDark ? '#0F172A' : '#E2E8F0') }]}>
              <Ionicons name={cfg.icon as any} size={12} color={active ? '#fff' : (isDark ? '#475569' : '#94A3B8')} />
            </View>
            <Text style={[chipSt.text, { color: active ? cfg.color : (isDark ? '#475569' : '#94A3B8'), fontWeight: active ? '800' : '600' }]}>{cat}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  </View>
);
const chipSt = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, marginRight: 8 },
  iconWrap: { width: 22, height: 22, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 12, letterSpacing: 0.1 },
});

// ─── Detail Row ───────────────────────────────────────────────────────────────
const DetailRow = ({ label, children, isDark }: any) => (
  <View style={[dtSt.row, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
    <Text style={[dtSt.label, { color: isDark ? '#475569' : '#94A3B8' }]}>{label}</Text>
    <View style={dtSt.valWrap}>{children}</View>
  </View>
);
const dtSt = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1 },
  label: { fontSize: 13, fontWeight: '600' },
  valWrap: { alignItems: 'flex-end', flex: 1, marginLeft: 20 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AccountsExpenses() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const { expenses, loading, fetchExpenses, createExpense, updateStatus } = useExpenses();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'balance'>('list');
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [newAmount, setNewAmount] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (activeTab === 'list') fetchExpenses(searchQuery);
  }, [searchQuery, activeTab]);

  const handleAddExpense = async () => {
    if (!newTitle || !newAmount) { Alert.alert('Required', 'Title and Amount are required.'); return; }
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) { Alert.alert('Invalid Amount', 'Enter a valid positive number.'); return; }
    setIsSubmitting(true);
    const success = await createExpense({
      title: newTitle, category: newCategory, amount,
      expense_date: new Date().toISOString().split('T')[0], description: newDescription,
    });
    setIsSubmitting(false);
    if (success) { setIsAddModalVisible(false); resetForm(); }
  };

  const resetForm = () => { setNewTitle(''); setNewCategory(CATEGORIES[0]); setNewAmount(''); setNewDescription(''); };

  const handleApprove = (expense: Expense) => {
    Alert.alert('Approve Expense', `Approve "${expense.title}" for ${fmtINR(expense.amount)}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => { const ok = await updateStatus(expense.id, 'approved'); if (ok) setSelectedExpense(null); } },
    ]);
  };
  const handlePay = (expense: Expense) => {
    Alert.alert('Mark as Paid', `Confirm payment of ${fmtINR(expense.amount)}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark Paid', onPress: async () => { const ok = await updateStatus(expense.id, 'paid'); if (ok) setSelectedExpense(null); } },
    ]);
  };
  const confirmDelete = async () => {
    if (!selectedExpense || !deleteReason.trim()) { Alert.alert('Required', 'Please state a reason.'); return; }
    setDeleting(true);
    try {
      await PolicyService.deleteWithReason('expenses', selectedExpense.id, deleteReason);
      setIsDeleteModalVisible(false); setSelectedExpense(null); setDeleteReason('');
      fetchExpenses(searchQuery);
    } catch { Alert.alert('Error', 'Failed to delete expense.'); }
    finally { setDeleting(false); }
  };

  const renderItem = ({ item, index }: { item: Expense; index: number }) => (
    <ExpenseCard item={item} index={index} onPress={() => setSelectedExpense(item)} isDark={isDark} />
  );

  const selectedCat = selectedExpense ? CATEGORY_CONFIG[selectedExpense.category] || CATEGORY_CONFIG.Other : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#0A0F1E' : '#F1F5F9'} />
      <AdminHeader title="Expense Tracker" showBackButton />

      {/* Tab bar */}
      <TabBar active={activeTab} onChange={setActiveTab} isDark={isDark} />

      {activeTab === 'list' ? (
        <>
          <SearchBar value={searchQuery} onChange={setSearchQuery} isDark={isDark} />

          {/* Summary strip */}
          {!loading && expenses.length > 0 && (
            <Animated.View entering={FadeInDown.duration(400)}>
              <SummaryStrip expenses={expenses} isDark={isDark} />
            </Animated.View>
          )}

          {loading && expenses.length === 0 ? (
            <View style={styles.centered}><LogoLoader size={60} color="#6366F1" /></View>
          ) : (
            <FlatList
              data={expenses}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshing={loading}
              onRefresh={() => fetchExpenses(searchQuery)}
              ListEmptyComponent={
                <Animated.View entering={FadeIn.duration(400)} style={styles.emptyWrap}>
                  <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? '#1E293B' : '#EEF2FF' }]}>
                    <FontAwesome5 name="receipt" size={28} color={isDark ? '#374151' : '#A5B4FC'} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: isDark ? '#475569' : '#64748B' }]}>No expenses yet</Text>
                  <Text style={[styles.emptySub, { color: isDark ? '#374151' : '#94A3B8' }]}>Tap + to record a new expense</Text>
                </Animated.View>
              }
            />
          )}

          {/* FAB */}
          <Pressable
            style={({ pressed }) => [styles.fabWrap, pressed && { opacity: 0.88 }]}
            onPress={() => setIsAddModalVisible(true)}
          >
            <LinearGradient colors={['#4F46E5', '#6366F1']} style={styles.fab} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} style={styles.fabGloss} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
              <Ionicons name="add" size={28} color="#fff" />
            </LinearGradient>
          </Pressable>
        </>
      ) : <NetBalanceTab />}

      {/* ── ADD EXPENSE SHEET ── */}
      <BottomSheet
        visible={isAddModalVisible}
        onClose={() => { setIsAddModalVisible(false); resetForm(); }}
        isDark={isDark}
        title="New Expense"
        subtitle="Record a school expenditure"
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <FormInput label="Title" value={newTitle} onChange={setNewTitle} placeholder="e.g. Lab Equipment" isDark={isDark} required />

          {/* Amount with ₹ prefix */}
          <View style={formSt.group}>
            <Text style={[formSt.label, { color: isDark ? '#64748B' : '#64748B' }]}>Amount <Text style={{ color: '#EF4444' }}>*</Text></Text>
            <View style={[formSt.wrap, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)' }]}>
              <View style={[{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: isDark ? '#0F172A' : '#E2E8F0', marginRight: 8 }]}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: isDark ? '#64748B' : '#475569' }}>₹</Text>
              </View>
              <TextInput
                style={[formSt.input, { color: isDark ? '#E2E8F0' : '#0F172A' }]}
                placeholder="0.00" placeholderTextColor={isDark ? '#374151' : '#CBD5E1'}
                keyboardType="numeric" value={newAmount} onChangeText={setNewAmount}
              />
            </View>
          </View>

          <CategoryChips value={newCategory} onChange={setNewCategory} isDark={isDark} />
          <FormInput label="Description" value={newDescription} onChange={setNewDescription}
            placeholder="Optional notes…" multiline isDark={isDark} />

          {/* Submit */}
          <Pressable
            style={({ pressed }) => [styles.submitWrap, pressed && { opacity: 0.88 }]}
            onPress={handleAddExpense} disabled={isSubmitting}
          >
            <LinearGradient colors={['#4F46E5', '#6366F1']} style={styles.submitBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <LinearGradient colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0)']} style={styles.submitGloss} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
              {isSubmitting
                ? <LogoLoader color="#fff" size={22} />
                : <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.submitTxt}>Submit Expense</Text>
                </>
              }
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </BottomSheet>

      {/* ── EXPENSE DETAILS SHEET ── */}
      <BottomSheet
        visible={!!selectedExpense}
        onClose={() => setSelectedExpense(null)}
        isDark={isDark}
        title="Expense Details"
        subtitle={selectedExpense ? `${selectedExpense.category} · ${fmtDate(selectedExpense.expense_date)}` : ''}
      >
        {selectedExpense && selectedCat && (
          <>
            {/* Amount hero */}
            <LinearGradient colors={selectedCat.grad} style={styles.amountHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
              <View style={[styles.amountHeroIcon, { backgroundColor: 'rgba(255,255,255,0.20)' }]}>
                <Ionicons name={selectedCat.icon as any} size={22} color="#fff" />
              </View>
              <Text style={styles.amountHeroVal}>{fmtINR(selectedExpense.amount)}</Text>
              <Text style={styles.amountHeroTitle} numberOfLines={1}>{selectedExpense.title}</Text>
            </LinearGradient>

            {/* Detail rows */}
            <DetailRow label="Category" isDark={isDark}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: selectedCat.color }]} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#E2E8F0' : '#0F172A' }}>{selectedExpense.category}</Text>
              </View>
            </DetailRow>
            <DetailRow label="Date" isDark={isDark}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#E2E8F0' : '#0F172A' }}>{fmtDate(selectedExpense.expense_date)}</Text>
            </DetailRow>
            <DetailRow label="Status" isDark={isDark}>
              <StatusBadge status={selectedExpense.status} isDark={isDark} />
            </DetailRow>
            {selectedExpense.description && (
              <View style={[styles.descBox, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]}>
                <Text style={[styles.descBoxText, { color: isDark ? '#94A3B8' : '#475569' }]}>{selectedExpense.description}</Text>
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.actionRow}>
              {selectedExpense.status === 'pending' && (
                <>
                  {(user?.role === 'admin' || selectedExpense.created_by !== user?.id) && (
                    <Pressable style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]} onPress={() => handleApprove(selectedExpense)}>
                      <LinearGradient colors={['#065F46', '#10B981']} style={styles.actionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Ionicons name="checkmark" size={18} color="#fff" />
                        <Text style={styles.actionTxt}>Approve</Text>
                      </LinearGradient>
                    </Pressable>
                  )}
                  <Pressable style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]} onPress={() => setIsDeleteModalVisible(true)}>
                    <LinearGradient colors={['#991B1B', '#EF4444']} style={styles.actionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Ionicons name="trash-outline" size={18} color="#fff" />
                      <Text style={styles.actionTxt}>Delete</Text>
                    </LinearGradient>
                  </Pressable>
                </>
              )}
              {selectedExpense.status === 'approved' && (
                <Pressable style={[styles.actionBtn, { flex: 1 }]} onPress={() => handlePay(selectedExpense)}>
                  <LinearGradient colors={['#1D4ED8', '#3B82F6']} style={styles.actionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Ionicons name="card-outline" size={18} color="#fff" />
                    <Text style={styles.actionTxt}>Mark as Paid</Text>
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          </>
        )}
      </BottomSheet>

      {/* ── DELETE CONFIRM SHEET ── */}
      <BottomSheet
        visible={isDeleteModalVisible}
        onClose={() => setIsDeleteModalVisible(false)}
        isDark={isDark}
        title="Delete Expense"
        subtitle="This action is permanent and logged in the audit trail."
      >
        {/* Warning banner */}
        <View style={[styles.warnBanner, { backgroundColor: isDark ? '#450A0A' : '#FEF2F2', borderColor: '#EF4444' }]}>
          <Ionicons name="warning-outline" size={18} color="#EF4444" />
          <Text style={[styles.warnText, { color: '#EF4444' }]}>Reason is required for compliance</Text>
        </View>
        <FormInput label="Reason" value={deleteReason} onChange={setDeleteReason}
          placeholder="e.g. Duplicate entry, Data error…" multiline isDark={isDark} required />
        <View style={styles.deleteActions}>
          <Pressable style={[styles.cancelBtn, { borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }]} onPress={() => setIsDeleteModalVisible(false)}>
            <Text style={[styles.cancelTxt, { color: isDark ? '#94A3B8' : '#64748B' }]}>Cancel</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.85 }]} onPress={confirmDelete} disabled={deleting}>
            <LinearGradient colors={['#991B1B', '#EF4444']} style={styles.deleteBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {deleting
                ? <LogoLoader color="#fff" size={22} />
                : <>
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                  <Text style={styles.deleteTxt}>Delete Permanently</Text>
                </>
              }
            </LinearGradient>
          </Pressable>
        </View>
      </BottomSheet>

    </View>
  );
}

// ─── Root Styles ──────────────────────────────────────────────────────────────
const getStyles = (theme: Theme, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? '#0A0F1E' : '#F1F5F9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 20, paddingBottom: 110 },

  // Empty state
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyIconWrap: { width: 70, height: 70, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  emptySub: { fontSize: 13, fontWeight: '500' },

  // FAB
  fabWrap: {
    position: 'absolute', bottom: 32, right: 24,
    borderRadius: 28,
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45, shadowRadius: 20, elevation: 16,
  },
  fab: { width: 60, height: 60, borderRadius: 28, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  fabGloss: { position: 'absolute', top: 0, left: 0, right: 0, height: 30, borderRadius: 28 },

  // Submit
  submitWrap: {
    borderRadius: 16, marginTop: 6, marginBottom: 8,
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.30, shadowRadius: 16, elevation: 10,
  },
  submitBtn: { height: 54, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, overflow: 'hidden' },
  submitGloss: { position: 'absolute', top: 0, left: 0, right: 0, height: 28, borderRadius: 16 },
  submitTxt: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },

  // Amount hero in details
  amountHero: {
    borderRadius: 20, padding: 22, flexDirection: 'row', alignItems: 'center',
    gap: 14, marginBottom: 6, overflow: 'hidden',
  },
  amountHeroIcon: { width: 48, height: 48, borderRadius: 15, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  amountHeroVal: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.8, flex: 1 },
  amountHeroTitle: { fontSize: 13, color: 'rgba(255,255,255,0.72)', fontWeight: '600', position: 'absolute', bottom: 14, left: 84, right: 20 },

  // Description box
  descBox: { borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 1, marginBottom: 4 },
  descBoxText: { fontSize: 14, fontWeight: '500', lineHeight: 21 },

  // Action row
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  actionBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  actionGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14 },
  actionTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },

  // Warning banner
  warnBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1 },
  warnText: { fontSize: 13, fontWeight: '700' },

  // Delete actions
  deleteActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  cancelTxt: { fontSize: 15, fontWeight: '700' },
  deleteBtn: { flex: 2, borderRadius: 14, overflow: 'hidden', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 },
  deleteBtnGrad: { height: 50, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderRadius: 14 },
  deleteTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
});