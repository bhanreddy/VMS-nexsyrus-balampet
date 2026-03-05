import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, StatusBar, TouchableOpacity, Alert, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import StaffHeader from '../../src/components/StaffHeader';
import SwipeableStudentCard from '../../src/components/SwipeableStudentCard';
import { useAuth } from '../../src/hooks/useAuth';
import { AttendanceService } from '../../src/services/attendanceService';
import { AttendanceStatus } from '../../src/types/schema';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';

interface StudentUI {
  id: string;
  enrollmentId?: string;
  name: string;
  rollNo: string;
  status: 'present' | 'absent' | 'unmarked';
}

// ─── Mini animated progress bar ─────────────────────────────────────────────
function ProgressBar({ filled, total, color }: {filled: number;total: number;color: string;}) {
  const pct = total > 0 ? filled / total : 0;
  const anim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 350,
      useNativeDriver: false
    }).start();
  }, [pct]);

  return (
    <View style={{ height: 3, borderRadius: 2, backgroundColor: color + '22', overflow: 'hidden', marginTop: 4 }}>
      <Animated.View
        style={{
          height: 3,
          borderRadius: 2,
          backgroundColor: color,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
        }} />

    </View>);

}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ManageStudents() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const router = useRouter();
  const { user } = useAuth();

  const [students, setStudents] = useState<StudentUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [detectedClassId, setDetectedClassId] = useState<string | null>(null);

  // Live stats
  const present = students.filter((s) => s.status === 'present').length;
  const absent = students.filter((s) => s.status === 'absent').length;
  const unmarked = students.filter((s) => s.status === 'unmarked').length;
  const total = students.length;
  const completionPct = total > 0 ? Math.round((present + absent) / total * 100) : 0;

  useEffect(() => {loadStudents();}, [user]);

  const loadStudents = async () => {
    if (!user) return;
    try {
      const myClass = await AttendanceService.getMyClass();
      if (!myClass) {setStudents([]);setDetectedClassId(null);setLoading(false);return;}
      setDetectedClassId(myClass.class_section_id);
      const formatted = myClass.students.map((s) => ({
        id: s.student_id,
        enrollmentId: s.enrollment_id,
        name: s.student_name,
        rollNo: s.admission_no,
        status: (s.status === 'present' || s.status === 'absent' ? s.status : 'unmarked') as StudentUI['status']
      }));
      setStudents(formatted);
    } catch (error) {

      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = useCallback((id: string, newStatus: StudentUI['status']) => {
    setStudents((prev) => prev.map((s) => s.id === id ? { ...s, status: newStatus } : s));
  }, []);

  const handleSubmit = async () => {
    if (students.length === 0) {Alert.alert('No Data', 'No students to submit.');return;}
    if (unmarked > 0) {
      Alert.alert('Incomplete', `${unmarked} student${unmarked > 1 ? 's' : ''} still unmarked.`);
      return;
    }
    try {
      setSubmitting(true);
      if (!detectedClassId) {Alert.alert('Error', 'No class assigned.');return;}
      const date = new Date().toISOString().split('T')[0];
      await AttendanceService.markAttendance({
        class_section_id: detectedClassId,
        date,
        records: students.
        filter((s) => s.enrollmentId).
        map((s) => ({ student_id: s.id, status: s.status as AttendanceStatus }))
      });
      Alert.alert('Submitted!', `Present: ${present}   Absent: ${absent}`);
      router.back();
    } catch (error) {

      Alert.alert('Error', 'Failed to submit attendance');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Renders ────────────────────────────────────────────────────────────────

  const renderHeader = () =>
  <View style={styles.statsStrip}>
      {/* Present */}
      <View style={styles.statCard}>
        <View style={[styles.statDot, { backgroundColor: '#10B981' }]} />
        <Text style={styles.statCount}>{present}</Text>
        <Text style={styles.statLabel}>Present</Text>
        <ProgressBar filled={present} total={total} color="#10B981" />
      </View>

      {/* Divider */}
      <View style={styles.statDivider} />

      {/* Absent */}
      <View style={styles.statCard}>
        <View style={[styles.statDot, { backgroundColor: '#EF4444' }]} />
        <Text style={styles.statCount}>{absent}</Text>
        <Text style={styles.statLabel}>Absent</Text>
        <ProgressBar filled={absent} total={total} color="#EF4444" />
      </View>

      {/* Divider */}
      <View style={styles.statDivider} />

      {/* Completion */}
      <View style={styles.statCard}>
        <View style={[styles.statDot, { backgroundColor: completionPct === 100 ? '#10B981' : '#F59E0B' }]} />
        <Text style={styles.statCount}>{completionPct}%</Text>
        <Text style={styles.statLabel}>Done</Text>
        <ProgressBar filled={present + absent} total={total} color={completionPct === 100 ? '#10B981' : '#F59E0B'} />
      </View>
    </View>;

  const renderInstruction = () =>
  <View style={styles.instruction}>
      <View style={styles.swipeHint}>
        <Ionicons name="arrow-forward" size={13} color="#10B981" />
        <Text style={[styles.hintText, { color: '#10B981' }]}>Swipe right = Present</Text>
      </View>
      <View style={styles.hintSep} />
      <View style={styles.swipeHint}>
        <Ionicons name="arrow-back" size={13} color="#EF4444" />
        <Text style={[styles.hintText, { color: '#EF4444' }]}>Swipe left = Absent</Text>
      </View>
    </View>;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        <StaffHeader
          title="Attendance"
          subtitle={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
          showBackButton
          showMenuButton={false} />

        {loading ?
        <View style={styles.loadingState}>
            <LogoLoader size={60} color="#3B82F6" />
            <Text style={styles.loadingText}>Fetching students…</Text>
          </View> :
        students.length === 0 ?
        <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={52} color={theme.colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Class Assigned</Text>
            <Text style={styles.emptySubtitle}>Contact admin to get a class assigned to you.</Text>
          </View> :

        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
          <>
                {renderHeader()}
                {renderInstruction()}
                <View style={styles.listMeta}>
                  <Text style={styles.listMetaText}>{total} Students</Text>
                  {unmarked > 0 &&
              <View style={styles.unmarkedBadge}>
                      <Text style={styles.unmarkedBadgeText}>{unmarked} unmarked</Text>
                    </View>
              }
                </View>
              </>
          }
          renderItem={({ item }) =>
          <SwipeableStudentCard student={item} onStatusChange={handleStatusChange} />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false} />

        }

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        {!loading && students.length > 0 &&
        <View style={styles.footer}>
            {/* Quick mark-all row */}
            <View style={styles.quickActions}>
              <TouchableOpacity
              style={[styles.quickBtn, styles.quickBtnPresent]}
              onPress={() => setStudents((prev) => prev.map((s) => ({ ...s, status: 'present' })))}>

                <Ionicons name="checkmark-done" size={14} color="#10B981" />
                <Text style={[styles.quickBtnText, { color: '#10B981' }]}>All Present</Text>
              </TouchableOpacity>
              <TouchableOpacity
              style={[styles.quickBtn, styles.quickBtnReset]}
              onPress={() => setStudents((prev) => prev.map((s) => ({ ...s, status: 'unmarked' })))}>

                <Ionicons name="refresh" size={14} color="#6B7280" />
                <Text style={[styles.quickBtnText, { color: '#6B7280' }]}>Reset</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
            style={[
            styles.submitButton,
            unmarked > 0 && styles.submitButtonPending,
            submitting && styles.submitButtonDisabled]
            }
            activeOpacity={0.85}
            onPress={handleSubmit}
            disabled={submitting}>

              {submitting ?
            <LogoLoader color="#fff" /> :

            <>
                  <Text style={styles.submitText}>
                    {unmarked > 0 ? `${unmarked} Unmarked — Submit Anyway` : 'Submit Attendance'}
                  </Text>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginLeft: 8 }} />
                </>
            }
            </TouchableOpacity>
          </View>
        }
      </View>
    </GestureHandlerRootView>);

}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const getStyles = (theme: Theme, isDark: boolean) =>
StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card
  },

  // ── Loading / Empty ───────────────────────────────────────────────────────
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500'
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 40
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20
  },

  // ── Stats Strip ───────────────────────────────────────────────────────────
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.2 : 0.04,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden'
  },
  statCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14
  },
  statDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginBottom: 4
  },
  statCount: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.5
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4
  },
  statDivider: {
    width: 1,
    marginVertical: 12,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'
  },

  // ── Instruction bar ───────────────────────────────────────────────────────
  instruction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 9,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 2,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  hintText: {
    fontSize: 12,
    fontWeight: '600'
  },
  hintSep: {
    width: 1,
    height: 14,
    backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB'
  },

  // ── List meta ─────────────────────────────────────────────────────────────
  listMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6
  },
  listMetaText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  unmarkedBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  unmarkedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706'
  },

  // ── List ──────────────────────────────────────────────────────────────────
  listContent: {
    paddingBottom: 200
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 90,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 10
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5
  },
  quickBtnPresent: {
    backgroundColor: '#F0FDF4',
    borderColor: '#A7F3D0'
  },
  quickBtnReset: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F9FAFB',
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'
  },
  quickBtnText: {
    fontSize: 13,
    fontWeight: '700'
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 16,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6
  },
  submitButtonPending: {
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B'
  },
  submitButtonDisabled: {
    opacity: 0.65,
    shadowOpacity: 0,
    elevation: 0
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1
  }
});