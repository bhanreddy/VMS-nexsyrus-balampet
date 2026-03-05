import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, StatusBar, Alert, Platform, Dimensions } from
'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown, FadeIn, useSharedValue, useAnimatedStyle,
  withSpring, 
  Easing } from
'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import StaffHeader from '../../src/components/StaffHeader';
import { useAuth } from '../../src/hooks/useAuth';
import { LeaveService, LeaveApplication } from '../../src/services/commonServices';
import { useTheme } from '../../src/hooks/useTheme';

const { width } = Dimensions.get('window');
const FONT = Platform.OS === 'ios' ? 'SF Pro Display' : 'sans-serif';
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// ─── Leave Type Config ─────────────────────────────────────────────
const LEAVE_TYPES = [
{ label: 'Sick Leave', icon: 'local-hospital' as const, color: '#EF4444', bg: 'rgba(239,68,68,0.10)', key: 'sick' },
{ label: 'Casual Leave', icon: 'beach-access' as const, color: '#F97316', bg: 'rgba(249,115,22,0.10)', key: 'casual' },
{ label: 'Emergency', icon: 'warning' as const, color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)', key: 'other' }];

// ─── Status Config ─────────────────────────────────────────────────
const STATUS_CFG: Record<string, {color: string;bg: string;icon: string;}> = {
  Approved: { color: '#10B981', bg: 'rgba(16,185,129,0.12)', icon: 'check-circle' },
  Rejected: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', icon: 'cancel' },
  Pending: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', icon: 'hourglass-empty' }
};

// ─── Leave Type Chip ───────────────────────────────────────────────
const LeaveTypeChip = ({
  type, isActive, onPress, isDark
}: {type: typeof LEAVE_TYPES[0];isActive: boolean;onPress: () => void;isDark: boolean;}) => {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const handleIn = () => {scale.value = withSpring(0.94, { damping: 15, stiffness: 250 });};
  const handleOut = () => {scale.value = withSpring(1, { damping: 15, stiffness: 250 });};

  return (
    <AnimatedTouchable
      style={animStyle}
      onPressIn={handleIn}
      onPressOut={handleOut}
      onPress={onPress}
      activeOpacity={1}>

      <View style={[
      chipStyles.chip,
      {
        backgroundColor: isActive ? type.bg : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
        borderColor: isActive ? type.color + '50' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
      }]
      }>
        {isActive &&
        <View style={[chipStyles.chipGlow, { backgroundColor: type.color + '20' }]} />
        }
        <View style={[chipStyles.iconWrap, { backgroundColor: isActive ? type.color + '20' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
          <MaterialIcons name={type.icon} size={14} color={isActive ? type.color : isDark ? '#64748B' : '#94A3B8'} />
        </View>
        <Text style={[chipStyles.chipText, {
          color: isActive ? type.color : isDark ? '#64748B' : '#94A3B8',
          fontFamily: FONT,
          fontWeight: isActive ? '700' : '500'
        }]}>
          {type.label}
        </Text>
        {isActive && <View style={[chipStyles.activeDot, { backgroundColor: type.color }]} />}
      </View>
    </AnimatedTouchable>);

};

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    gap: 7,
    overflow: 'hidden',
    position: 'relative'
  },
  chipGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center'
  },
  chipText: {
    fontSize: 12,
    letterSpacing: -0.1
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginLeft: 2
  }
});

// ─── Styled Date Input ─────────────────────────────────────────────
const DateField = ({
  label, value, onChange, isDark, placeholder
}: {label: string;value: string;onChange: (v: string) => void;isDark: boolean;placeholder: string;}) => {
  const [focused, setFocused] = useState(false);
  const borderAnim = useSharedValue(0);

  return (
    <View style={dfStyles.wrap}>
      <Text style={[dfStyles.label, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>{label}</Text>
      <View style={[
      dfStyles.inputWrap,
      {
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        borderColor: focused ?
        isDark ? 'rgba(99,102,241,0.60)' : 'rgba(79,70,229,0.50)' :
        isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)'
      }]
      }>
        <Ionicons name="calendar-outline" size={15}
        color={focused ? isDark ? '#818CF8' : '#4F46E5' : isDark ? '#334155' : '#CBD5E1'} />

        <TextInput
          style={[dfStyles.input, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#2A3444' : '#C4CDD9'}
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)} />

      </View>
    </View>);

};

const dfStyles = StyleSheet.create({
  wrap: { flex: 1 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 13,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1
  },
  input: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2
  }
});

// ─── History Card ──────────────────────────────────────────────────
const HistoryCard = ({ item, index, isDark }: {item: any;index: number;isDark: boolean;}) => {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const cfg = STATUS_CFG[item.status] || STATUS_CFG.Pending;
  const leaveTypeCfg = LEAVE_TYPES.find((t) => t.label === item.type) || LEAVE_TYPES[0];

  return (
    <Animated.View
      entering={FadeInDown.delay(200 + index * 80).duration(320).easing(Easing.out(Easing.cubic))}>

      <AnimatedTouchable
        activeOpacity={0.85}
        onPressIn={() => {scale.value = withSpring(0.98, { damping: 18, stiffness: 220 });}}
        onPressOut={() => {scale.value = withSpring(1, { damping: 18, stiffness: 220 });}}
        style={animStyle}>

        <BlurView
          intensity={isDark ? 28 : 35}
          tint={isDark ? 'dark' : 'light'}
          style={[hcStyles.blurWrap, {
            borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.70)'
          }]}>

          <View style={[hcStyles.inner, {
            backgroundColor: isDark ? 'rgba(10,14,28,0.55)' : 'rgba(255,255,255,0.60)'
          }]}>
            {/* Accent bar */}
            <View style={[hcStyles.accentBar, { backgroundColor: leaveTypeCfg.color }]} />

            <View style={hcStyles.row}>
              {/* Icon */}
              <View style={[hcStyles.iconBox, { backgroundColor: leaveTypeCfg.bg }]}>
                <MaterialIcons name={leaveTypeCfg.icon} size={20} color={leaveTypeCfg.color} />
              </View>

              {/* Text */}
              <View style={hcStyles.textBlock}>
                <Text style={[hcStyles.type, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}>
                  {item.type}
                </Text>
                <View style={hcStyles.metaRow}>
                  <Ionicons name="calendar-outline" size={11} color={isDark ? '#475569' : '#94A3B8'} />
                  <Text style={[hcStyles.date, { color: isDark ? '#475569' : '#94A3B8', fontFamily: FONT }]}>
                    {item.range}
                  </Text>
                  <View style={[hcStyles.daysPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
                    <Text style={[hcStyles.daysText, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>
                      {item.days}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Status */}
              <View style={[hcStyles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.color + '30' }]}>
                <MaterialIcons name={cfg.icon as any} size={11} color={cfg.color} />
                <Text style={[hcStyles.statusText, { color: cfg.color, fontFamily: FONT }]}>{item.status}</Text>
              </View>
            </View>
          </View>
        </BlurView>
      </AnimatedTouchable>
    </Animated.View>);

};

const hcStyles = StyleSheet.create({
  blurWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth
  },
  inner: {
    borderRadius: 20,
    overflow: 'hidden'
  },
  accentBar: {
    position: 'absolute',
    left: 0, top: 10, bottom: 10,
    width: 3.5,
    borderRadius: 3
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingLeft: 18,
    paddingRight: 14
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  textBlock: { flex: 1, gap: 5 },
  type: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  date: {
    fontSize: 11,
    fontWeight: '500'
  },
  daysPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 2
  },
  daysText: {
    fontSize: 10,
    fontWeight: '700'
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  }
});

// ─── Submit Button ─────────────────────────────────────────────────
const SubmitButton = ({ onPress, loading }: {onPress: () => void;loading: boolean;isDark: boolean;}) => {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedTouchable
      activeOpacity={1}
      disabled={loading}
      onPressIn={() => {scale.value = withSpring(0.96, { damping: 15, stiffness: 220 });}}
      onPressOut={() => {scale.value = withSpring(1, { damping: 15, stiffness: 220 });}}
      onPress={onPress}
      style={[animStyle, { opacity: loading ? 0.7 : 1, marginTop: 8 }]}>

      <LinearGradient
        colors={['#4F46E5', '#7C3AED']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={sbStyles.btn}>

        {/* Shine overlay */}
        <View style={sbStyles.shine} />
        <Ionicons name={loading ? 'reload' : 'paper-plane'} size={16} color="#fff" style={{ marginRight: 8 }} />
        <Text style={[sbStyles.text, { fontFamily: FONT }]}>
          {loading ? 'Submitting…' : 'Submit Application'}
        </Text>
      </LinearGradient>
    </AnimatedTouchable>);

};

const sbStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative'
  },
  shine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)'
  },
  text: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2
  }
});

// ─── Main Screen ───────────────────────────────────────────────────
export default function ApplyLeave() {
  const { isDark } = useTheme();
  const { user } = useAuth();

  const [leaveType, setLeaveType] = useState('Sick Leave');
  const [reason, setReason] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [reasonFocused, setReasonFocused] = useState(false);

  useEffect(() => {loadLeaves();}, [user]);

  const loadLeaves = async () => {
    try {
      if (user) {
        const data = await LeaveService.getAll();
        const formatted = data.map((l: LeaveApplication) => ({
          id: l.id,
          type: l.leave_type === 'sick' ? 'Sick Leave' : l.leave_type === 'casual' ? 'Casual Leave' : 'Emergency',
          range: `${new Date(l.start_date).toLocaleDateString()} – ${new Date(l.end_date).toLocaleDateString()}`,
          days: calculateDays(l.start_date, l.end_date),
          status: l.status
        }));
        setLeaves(formatted);
      }
    } catch (err) {}
  };

  const calculateDays = (start: string, end: string) => {
    const diff = Math.abs(new Date(end).getTime() - new Date(start).getTime());
    const days = Math.max(1, Math.ceil(diff / 86400000) + 1);
    return `${days} Day${days !== 1 ? 's' : ''}`;
  };

  const handleApply = async () => {
    if (!fromDate || !toDate || !reason) {
      Alert.alert('Missing Fields', 'Please fill in all fields before submitting.');
      return;
    }
    try {
      setLoading(true);
      if (user) {
        const typeMap: Record<string, string> = {
          'Sick Leave': 'sick', 'Casual Leave': 'casual', 'Emergency': 'other'
        };
        await LeaveService.create({ leave_type: typeMap[leaveType] || 'other', start_date: fromDate, end_date: toDate, reason });
        Alert.alert('Submitted', 'Your leave application has been submitted.');
        loadLeaves();
        setReason('');setFromDate('');setToDate('');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to submit application.');
    } finally {
      setLoading(false);
    }
  };

  const activeLeaveCfg = LEAVE_TYPES.find((t) => t.label === leaveType)!;

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Background gradient */}
      <LinearGradient
        colors={isDark ? ['#070512', '#0E0A20', '#0A0818'] : ['#F4F6FF', '#EEF2FF', '#F8F4FF']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }} />

      <StaffHeader title="Apply Leave" showBackButton={true} />

      <ScrollView
        contentContainerStyle={mainStyles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* ── Form Card ── */}
        <Animated.View entering={FadeInDown.delay(60).duration(340).easing(Easing.out(Easing.cubic))}>
          <BlurView
            intensity={isDark ? 40 : 60}
            tint={isDark ? 'dark' : 'light'}
            style={[mainStyles.cardBlur, {
              borderColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.75)'
            }]}>

            <View style={[mainStyles.cardInner, {
              backgroundColor: isDark ? 'rgba(12,8,30,0.58)' : 'rgba(255,255,255,0.68)'
            }]}>
              {/* Card top shimmer */}
              <View style={[mainStyles.cardShimmer, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.90)'
              }]} />

              {/* Title row */}
              <View style={mainStyles.cardTitleRow}>
                <View style={[mainStyles.titleIcon, { backgroundColor: activeLeaveCfg.bg }]}>
                  <MaterialIcons name={activeLeaveCfg.icon} size={16} color={activeLeaveCfg.color} />
                </View>
                <View>
                  <Text style={[mainStyles.cardTitle, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}>
                    New Application
                  </Text>
                  <Text style={[mainStyles.cardSubtitle, { color: isDark ? '#475569' : '#94A3B8', fontFamily: FONT }]}>
                    Fill in the details below
                  </Text>
                </View>
              </View>

              {/* Leave Type */}
              <View style={mainStyles.fieldGroup}>
                <Text style={[mainStyles.fieldLabel, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>
                  Leave Type
                </Text>
                <View style={mainStyles.chipsRow}>
                  {LEAVE_TYPES.map((t) =>
                  <LeaveTypeChip
                    key={t.key}
                    type={t}
                    isActive={leaveType === t.label}
                    onPress={() => setLeaveType(t.label)}
                    isDark={isDark} />

                  )}
                </View>
              </View>

              {/* Date Row */}
              <View style={mainStyles.dateRow}>
                <DateField label="From Date" value={fromDate} onChange={setFromDate} isDark={isDark} placeholder="YYYY-MM-DD" />
                <View style={{ width: 10 }} />
                <DateField label="To Date" value={toDate} onChange={setToDate} isDark={isDark} placeholder="YYYY-MM-DD" />
              </View>

              {/* Reason */}
              <View style={mainStyles.fieldGroup}>
                <Text style={[mainStyles.fieldLabel, { color: isDark ? '#64748B' : '#94A3B8', fontFamily: FONT }]}>
                  Reason
                </Text>
                <View style={[
                mainStyles.textAreaWrap,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  borderColor: reasonFocused ?
                  isDark ? 'rgba(99,102,241,0.55)' : 'rgba(79,70,229,0.45)' :
                  isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)'
                }]
                }>
                  <TextInput
                    style={[mainStyles.textArea, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}
                    placeholder="Briefly describe your reason for leave…"
                    placeholderTextColor={isDark ? '#2A3444' : '#C4CDD9'}
                    multiline
                    numberOfLines={4}
                    value={reason}
                    onChangeText={setReason}
                    textAlignVertical="top"
                    onFocus={() => setReasonFocused(true)}
                    onBlur={() => setReasonFocused(false)} />

                  {reason.length > 0 &&
                  <Text style={[mainStyles.charCount, {
                    color: isDark ? '#334155' : '#CBD5E1', fontFamily: FONT
                  }]}>
                      {reason.length} chars
                    </Text>
                  }
                </View>
              </View>

              <SubmitButton onPress={handleApply} loading={loading} isDark={isDark} />
            </View>
          </BlurView>
        </Animated.View>

        {/* ── History ── */}
        <Animated.View entering={FadeInDown.delay(160).duration(320)} style={mainStyles.historyHeader}>
          <View style={mainStyles.historyTitleRow}>
            <Text style={[mainStyles.historyTitle, { color: isDark ? '#EEF2FF' : '#0F172A', fontFamily: FONT }]}>
              Leave History
            </Text>
            <View style={[mainStyles.historyCount, {
              backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(79,70,229,0.08)'
            }]}>
              <Text style={[mainStyles.historyCountText, {
                color: isDark ? '#818CF8' : '#4F46E5', fontFamily: FONT
              }]}>
                {leaves.length}
              </Text>
            </View>
          </View>
        </Animated.View>

        {leaves.length === 0 ?
        <Animated.View entering={FadeIn.delay(200).duration(300)} style={mainStyles.emptyState}>
            <View style={[mainStyles.emptyIcon, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
          }]}>
              <Ionicons name="calendar-outline" size={36} color={isDark ? '#2C3A50' : '#CDD7E6'} />
            </View>
            <Text style={[mainStyles.emptyText, { color: isDark ? '#475569' : '#94A3B8', fontFamily: FONT }]}>
              No leave history yet
            </Text>
          </Animated.View> :

        <View style={mainStyles.historyList}>
            {leaves.map((item, i) =>
          <HistoryCard key={item.id} item={item} index={i} isDark={isDark} />
          )}
          </View>
        }

      </ScrollView>
    </View>);

}

// ─── Main Styles ───────────────────────────────────────────────────
const mainStyles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 110
  },

  // Form card
  cardBlur: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 28,
    shadowColor: '#4F46E5',
    shadowOpacity: 0.10,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  cardInner: {
    padding: 20,
    borderRadius: 24
  },
  cardShimmer: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 22
  },
  titleIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1
  },

  // Fields
  fieldGroup: {
    marginBottom: 18
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  dateRow: {
    flexDirection: 'row',
    marginBottom: 18
  },
  textAreaWrap: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    minHeight: 100
  },
  textArea: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: -0.1
  },
  charCount: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 6
  },

  // History
  historyHeader: {
    marginBottom: 14
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5
  },
  historyCount: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8
  },
  historyCountText: {
    fontSize: 12,
    fontWeight: '800'
  },
  historyList: {
    gap: 10
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600'
  }
});