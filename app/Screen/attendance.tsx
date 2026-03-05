import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import ScreenLayout from '../../src/components/ScreenLayout';
import StudentHeader from '../../src/components/StudentHeader';
import { useAuth } from '../../src/hooks/useAuth';
import { StudentService } from '../../src/services/studentService';
import { AttendanceRecord, AttendanceSummary } from '../../src/types/models';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'present':
      return '#16a34a';
    case 'absent':
      return '#dc2626';
    case 'holiday':
      return '#9333ea';
    case 'half_day':
    case 'leave':
      return '#f59e0b';
    case 'late':
      return '#ca8a04';
    default:
      return '#6b7280';
  }
};
const getStatusIcon = (status: string): keyof typeof Ionicons.glyphMap => {
  switch (status.toLowerCase()) {
    case 'present':
      return 'checkmark-circle';
    case 'absent':
      return 'close-circle';
    case 'holiday':
      return 'calendar';
    case 'half_day':
    case 'leave':
      return 'time';
    case 'late':
      return 'alert-circle';
    default:
      return 'help-circle';
  }
};
export default function AttendanceScreen() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const {
    t
  } = useTranslation();
  const {
    user
  } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceSummary>({
    present: 0,
    absent: 0,
    late: 0,
    total: 0
  });
  useEffect(() => {
    loadAttendance();
  }, [user]);
  const loadAttendance = async () => {
    if (!user) return;
    try {
      const data = await StudentService.getAttendance(user.id || '');
      setRecords(data.records);
      setStats(data.summary);
    } catch (error) {

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadAttendance();
  };
  const renderItem = React.useCallback(({
    item,
    index

  }: {item: AttendanceRecord;index: number;}) => {
    const color = getStatusColor(item.status);
    const dateObj = new Date(item.attendance_date);
    const day = dateObj.toLocaleDateString('en-US', {
      weekday: 'short'
    });
    const dayNum = dateObj.getDate();
    return <Animated.View entering={FadeInDown.delay(index * 50).duration(500)} // Faster delay
    style={styles.card}>
                {/* Date Side - Left */}
                <View style={[styles.dateBox, {
        backgroundColor: color + '15'
      }]}>
                    <Text style={[styles.dayText, {
          color: color
        }]}>{day}</Text>
                    <Text style={[styles.dateText, {
          color: color
        }]}>{dayNum}</Text>
                </View>
                {/* Status Content - Right */}
                <View style={styles.cardContent}>
                    <View>
                        <Text style={styles.fullDate}>{dateObj.toDateString()}</Text>
                        <Text style={[styles.statusMain, {
            color
          }]}>{item.status.toUpperCase()}</Text>
                    </View>
                    <Ionicons name={getStatusIcon(item.status)} size={28} color={color} />
                </View>
            </Animated.View>;
  }, []);

  // Calculate percentage safely
  const percentage = stats.total > 0 ? Math.round(stats.present / stats.total * 100) : 0;
  return <ScreenLayout>
            <StudentHeader showBackButton={true} title={t('attendance_screen.title', 'Attendance')} />
            <View style={styles.container}>
                {/* HEADER STATS */}
                <View style={styles.summaryContainer}>
                    <LinearGradient colors={['#10b981', '#059669']} start={{
          x: 0,
          y: 0
        }} end={{
          x: 1,
          y: 1
        }} style={styles.summaryCard}>
                        <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 15
          }}>
                            <Text style={styles.summaryTitle}>{t('attendance_screen.stats', 'Statistics')}</Text>
                            <View style={styles.percentBadge}>
                                <Text style={styles.percentText}>{percentage}%</Text>
                            </View>
                        </View>
                        <View style={styles.statRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statVal}>{stats.present}</Text>
                                <Text style={styles.statLabel}>{t('attendance_screen.present', 'Present')}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statVal}>{stats.absent}</Text>
                                <Text style={styles.statLabel}>{t('attendance_screen.absent', 'Absent')}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statVal}>{stats.late}</Text>
                                <Text style={styles.statLabel}>{t('attendance_screen.late', 'Late')}</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </View>
                {/* LIST */}
                {loading ? <LogoLoader size={60} color="#10B981" style={{
        marginTop: 40
      }} /> : <FlatList data={records} keyExtractor={(item) => item.attendance_date} renderItem={renderItem} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />} ListEmptyComponent={<Text style={{
        textAlign: 'center',
        marginTop: 20,
        color: '#999'
      }}>No attendance records found.</Text>} />}
            </View>
        </ScreenLayout>;
}
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb'
  },
  summaryContainer: {
    padding: 20,
    paddingBottom: 10
  },
  summaryCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  summaryTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  percentBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  percentText: {
    color: theme.colors.background,
    fontWeight: 'bold',
    fontSize: 16
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statItem: {
    alignItems: 'center',
    flex: 1
  },
  statVal: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.background
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)'
  },
  list: {
    padding: 20,
    paddingBottom: 80
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  dateBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  dateText: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 8
  },
  fullDate: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4
  },
  statusMain: {
    fontSize: 16,
    fontWeight: 'bold'
  }
});