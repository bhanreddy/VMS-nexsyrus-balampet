import React, { useState, useEffect, useMemo } from 'react';
import LogoLoader from '../../src/components/LogoLoader';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, { FadeInUp, useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { api } from '../../src/services/apiClient';

export default function AdminAttendanceScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<any[]>([]);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    }
  });

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const dateStr = new Date().toISOString().split('T')[0];
      const data = await api.get<any[]>('/attendance/staff', { date: dateStr });
      setStaffList(data || []);
    } catch (error) {

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAttendance();
  };

  const toggleStatus = (staffId: string) => {
    setStaffList((prev) => prev.map((staff) => {
      if (staff.staff_id === staffId) {
        const currentStatus = staff.status || 'absent';
        let nextStatus = 'present';
        if (currentStatus === 'present') nextStatus = 'absent';else
        if (currentStatus === 'absent') nextStatus = 'half_day';else
        nextStatus = 'present';
        return { ...staff, status: nextStatus };
      }
      return staff;
    }));
  };

  const submitAttendance = async () => {
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const records = staffList.map((s) => ({ staff_id: s.staff_id, status: s.status || 'absent' }));
      await api.post('/attendance/staff', { date: dateStr, attendance: records });
      Alert.alert('Success', 'Staff attendance marked successfully');
    } catch (error) {

      Alert.alert('Error', 'Failed to save attendance');
    }
  };

  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let half = 0;
    staffList.forEach((s) => {
      if (s.status === 'present') present++;else
      if (s.status === 'absent') absent++;else
      if (s.status === 'half_day') half++;
    });
    return { present, absent, half };
  }, [staffList]);

  return (
    <View style={styles.container}>
            <AdminHeader title="Staff Attendance" showNotification scrollY={scrollY} />
            {loading && !refreshing ?
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: theme.colors.textSecondary }}>Loading attendance...</Text>
                </View> :

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="transparent" colors={['transparent']} progressBackgroundColor="transparent" />}>

                {refreshing &&
        <View style={{ width: '100%', alignItems: 'center', paddingVertical: 20 }}>
                        <LogoLoader size={30} />
                    </View>
        }
                    {/* Header Summary */}
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryHeader}>
                            <Text style={styles.dateTitle}>Today's Overview</Text>
                            <Text style={styles.dateSub}>{new Date().toDateString()}</Text>
                        </View>
                        <View style={styles.statsRow}>
                            <View style={styles.statBox}>
                                <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.present}</Text>
                                <Text style={styles.statLabel}>Present</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.statBox}>
                                <Text style={[styles.statValue, { color: '#EF4444' }]}>{stats.absent}</Text>
                                <Text style={styles.statLabel}>Absent</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.statBox}>
                                <Text style={[styles.statValue, { color: '#F59E0B' }]}>{stats.half}</Text>
                                <Text style={styles.statLabel}>Half-day</Text>
                            </View>
                        </View>
                    </View>
                    {/* Filters */}
                    <View style={styles.filterRow}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <TouchableOpacity style={styles.filterChip}>
                                <Text style={styles.filterChipText}>All Depts</Text>
                                <Ionicons name="chevron-down" size={14} color={theme.colors.textSecondary} style={{ marginLeft: 4 }} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.filterChip}>
                                <Text style={styles.filterChipText}>Status</Text>
                                <Ionicons name="chevron-down" size={14} color={theme.colors.textSecondary} style={{ marginLeft: 4 }} />
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                    {/* Staff List */}
                    <Text style={styles.sectionTitle}>Staff List</Text>
                    {staffList.map((staff, index) => {
          const status = staff.status || 'absent';
          return (
            <Animated.View key={staff.staff_id} entering={FadeInUp.delay(index * 50).springify().damping(12)} style={styles.card}>
                                <TouchableOpacity style={styles.cardContent} onPress={() => toggleStatus(staff.staff_id)}>
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarText}>{staff.staff_name?.charAt(0) || '?'}</Text>
                                    </View>
                                    <View style={styles.info}>
                                        <Text style={styles.name}>{staff.staff_name}</Text>
                                        <Text style={styles.details}>{staff.designation || 'Staff'}</Text>
                                    </View>
                                    <View style={[
                styles.statusBadge,
                status === 'present' ? styles.statusPresent :
                status === 'absent' ? styles.statusAbsent : styles.statusHalf]
                }>
                                        <Text style={[
                  styles.statusText,
                  status === 'present' ? styles.statusTextPresent :
                  status === 'absent' ? styles.statusTextAbsent : styles.statusTextHalf]
                  }>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
                                    </View>
                                </TouchableOpacity>
                            </Animated.View>);

        })}
                </Animated.ScrollView>
      }
            <View style={styles.footerAction}>
                <TouchableOpacity style={styles.primaryButton} onPress={submitAttendance}>
                    <Ionicons name="checkmark-done" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryButtonText}>Mark Attendance</Text>
                </TouchableOpacity>
            </View>
        </View>);

}

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  content: {
    padding: 20,
    paddingTop: 100,
    paddingBottom: 100
  },
  summaryCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3
  },
  summaryHeader: {
    marginBottom: 16
  },
  dateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text
  },
  dateSub: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statBox: {
    flex: 1,
    alignItems: 'center'
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4
  },
  statLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500'
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: theme.colors.border
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 20
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  filterChipText: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '500'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 12
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary
  },
  info: {
    flex: 1
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4
  },
  details: {
    fontSize: 13,
    color: theme.colors.textSecondary
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12
  },
  statusPresent: { backgroundColor: '#ECFDF5' },
  statusAbsent: { backgroundColor: '#FEF2F2' },
  statusHalf: { backgroundColor: '#FFFBEB' },
  statusText: { fontSize: 12, fontWeight: '700' },
  statusTextPresent: { color: '#10B981' },
  statusTextAbsent: { color: '#EF4444' },
  statusTextHalf: { color: '#F59E0B' },
  footerAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderColor: theme.colors.border
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});