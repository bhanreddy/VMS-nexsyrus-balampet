import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, Dimensions, StatusBar, BackHandler, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring, useAnimatedScrollHandler } from 'react-native-reanimated';
import StaffHeader from '@/src/components/StaffHeader';
import StaffDashboardCard from '@/src/components/StaffDashboardCard';
import { useAuth } from '@/src/hooks/useAuth';
import { AttendanceService } from '@/src/services/attendanceService';
import { LeaveService } from '@/src/services/commonServices';
import { useTheme } from '@/src/hooks/useTheme';
import { Spacing, Radii, Shadows, CardGradients } from '@/src/theme/themes';
import { Springs } from '@/src/utils/motion';
const {
  width
} = Dimensions.get('window');

// ── Types ───────────────────────────────────
interface DashboardMetrics {
  totalStudents: number;
  presentToday: number;
  absentToday: number;
  pendingLeaves: number;
  classId?: string;
}

// ── Helpers ─────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}
function getTodayDate(): string {
  const d = new Date();
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
}

// ── Attendance Widget (Professional) ────────
function AttendanceWidget({
  data,
  onPress,
  theme,
  isDark
}: {data: DashboardMetrics | null;onPress: () => void;theme: any;isDark: boolean;loading: boolean;}) {
  const styles = React.useMemo(() => getStyles(), []);
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{
      scale: scale.value
    }]
  }));
  const total = data?.totalStudents || 0;
  const present = data?.presentToday || 0;
  const absent = data?.absentToday || 0;
  const unmarked = Math.max(0, total - present - absent);
  const pct = total > 0 ? Math.round(present / total * 100) : 0;

  // Status logic
  let statusText = 'Attendance Not Marked';
  let statusColor = theme.colors.textTertiary;
  let iconName = 'alert-circle-outline';
  if (total === 0) {
    statusText = 'No Class Assigned';
  } else if (unmarked === 0) {
    statusText = 'Attendance Complete';
    statusColor = theme.colors.success;
    iconName = 'checkmark-circle';
  } else if (unmarked < total) {
    statusText = `${unmarked} Remaining`;
    statusColor = theme.colors.warning;
    iconName = 'time-outline';
  }
  return <Animated.View style={[animStyle, {
    marginBottom: Spacing.lg
  }]}>
    <Pressable onPressIn={() => scale.value = withSpring(0.98, Springs.cardPress)} onPressOut={() => scale.value = withSpring(1, Springs.cardRelease)} onPress={onPress} style={[styles.attendanceCard, {
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.border
    }, Shadows.sm]}>
      {/* Header Row */}
      <View style={styles.attHeader}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8
        }}>
          <View style={[styles.attIconBox, {
            backgroundColor: isDark ? 'rgba(79, 70, 229, 0.15)' : '#EEF2FF'
          }]}>
            <Ionicons name="people" size={18} color={theme.colors.primary} />
          </View>
          <Text style={[styles.attTitle, {
            color: theme.colors.textStrong
          }]}>Class Attendance</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
      </View>

      {/* Metrics Row */}
      <View style={styles.attMetrics}>
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, {
            color: theme.colors.textStrong
          }]}>
            {present}<Text style={{
              fontSize: 16,
              color: theme.colors.textTertiary
            }}>/{total}</Text>
          </Text>
          <Text style={[styles.metricLabel, {
            color: theme.colors.textSecondary
          }]}>Present</Text>
        </View>

        <View style={[styles.verticalDivider, {
          backgroundColor: theme.colors.border
        }]} />

        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, {
            color: theme.colors.danger
          }]}>
            {absent}
          </Text>
          <Text style={[styles.metricLabel, {
            color: theme.colors.textSecondary
          }]}>Absent</Text>
        </View>

        <View style={[styles.verticalDivider, {
          backgroundColor: theme.colors.border
        }]} />

        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, {
            color: theme.colors.primary
          }]}>{pct}%</Text>
          <Text style={[styles.metricLabel, {
            color: theme.colors.textSecondary
          }]}>Rate</Text>
        </View>
      </View>

      {/* Status Footer */}
      <View style={[styles.attFooter, {
        backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#F8FAFC',
        borderTopColor: theme.colors.border
      }]}>
        <Ionicons name={iconName as any} size={14} color={statusColor} />
        <Text style={[styles.attStatusText, {
          color: statusColor
        }]}>{statusText}</Text>
      </View>
    </Pressable>
  </Animated.View>;
}

// ── Alert Row (Simpler) ─────────────────────
function AlertRow({
  icon,
  color,
  title,
  subtitle,
  onPress,
  theme

}: {icon: string;color: string;title: string;subtitle: string;onPress: () => void;theme: any;}) {
  const {
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(), []);
  return <Pressable onPress={onPress} style={({
    pressed
  }) => {
    return [styles.alertRow, {
      backgroundColor: theme.colors.alertBgInfo,
      borderColor: theme.colors.alertBorderInfo
    }, pressed && {
      opacity: 0.8
    }];
  }}>
    <Ionicons name={icon as any} size={20} color={color} style={{
      marginRight: 12
    }} />
    <View style={{
      flex: 1
    }}>
      <Text style={[styles.alertTitle, {
        color: theme.colors.alertTextInfo
      }]}>{title}</Text>
      <Text style={[styles.alertSubtitle, {
        color: theme.colors.alertTextInfo
      }]}>{subtitle}</Text>
    </View>
    <Ionicons name="arrow-forward" size={16} color={color} />
  </Pressable>;
}

// ── Main Dashboard ──────────────────────────
export default function StaffDashboard() {
  const router = useRouter();
  const {
    t
  } = useTranslation();
  const {
    user
  } = useAuth();
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(), []);
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      try {
        const pendingLeaves = await LeaveService.getAll({
          status: 'pending'
        });
        let studentCount = 0,
          presentCount = 0,
          absentCount = 0;
        let detectedClassId: string | undefined;

        // Dynamically detect teacher's class via /attendance/my-class
        const myClass = await AttendanceService.getMyClass();
        if (myClass) {
          detectedClassId = myClass.class_section_id;
          studentCount = myClass.total_students;
          presentCount = myClass.students.filter((s) => s.status === 'present').length;
          absentCount = myClass.students.filter((s) => s.status === 'absent').length;
        }

        setData({
          totalStudents: studentCount,
          presentToday: presentCount,
          absentToday: absentCount,
          pendingLeaves: pendingLeaves.length,
          classId: detectedClassId
        });
      } catch (e) {

      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);
  useFocusEffect(useCallback(() => {
    const onBackPress = () => {
      BackHandler.exitApp();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, []));
  const menuItems = [{
    title: "Diary",
    subtitle: "Daily logs",
    icon: <FontAwesome5 name="book" size={18} color="#FFFFFF" />,
    route: '/staff/diary',
    gradient: CardGradients.blue
  }, {
    title: t('staff_dashboard.timetable'),
    subtitle: "Schedule",
    icon: <FontAwesome5 name="clock" size={18} color="#FFFFFF" />,
    route: '/staff/timetable',
    gradient: CardGradients.emerald
  }, {
    title: t('staff_dashboard.leaves'),
    subtitle: "Approvals",
    icon: <FontAwesome5 name="calendar-check" size={18} color="#FFFFFF" />,
    route: '/staff/leaves',
    gradient: CardGradients.rose,
    badge: data?.pendingLeaves ? `${data.pendingLeaves}` : undefined
  }, {
    title: t('staff_dashboard.results'),
    subtitle: "Marks",
    icon: <MaterialIcons name="assessment" size={20} color="#FFFFFF" />,
    route: '/staff/results',
    gradient: CardGradients.amber
  }, {
    title: "Complaints",
    subtitle: "Issues",
    icon: <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />,
    route: '/staff/complaints',
    gradient: CardGradients.purple
  }, {
    title: "LMS",
    subtitle: "Uploads",
    icon: <MaterialIcons name="cloud-upload" size={20} color="#FFFFFF" />,
    route: '/staff/lms-upload',
    gradient: CardGradients.pink
  }, {
    title: "Payslips",
    subtitle: "Salary & Docs",
    icon: <FontAwesome5 name="file-invoice-dollar" size={18} color="#FFFFFF" />,
    route: '/staff/payslip',
    gradient: CardGradients.indigo
  }];
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event: any) => {
      scrollY.value = event.contentOffset.y;
    }
  });
  return <View style={[styles.container, {
    backgroundColor: theme.colors.background
  }]}>
    <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
    <StaffHeader title="Staff Portal" subtitle={user?.display_name || 'Teacher'} scrollY={scrollY} />

    <Animated.ScrollView contentContainerStyle={[styles.scrollContent, {
      paddingTop: 100
    }]} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
      {/* Header Greeting */}
      <View style={styles.headerSection}>
        <Text style={[styles.dateText, {
          color: theme.colors.textTertiary
        }]}>
          {getTodayDate()}
        </Text>
        <Text style={[styles.greetingText, {
          color: theme.colors.textStrong
        }]}>
          {getGreeting()}, {user?.display_name?.split(' ')[0] || 'Teacher'}
        </Text>
      </View>

      {/* Alerts Area */}
      {data?.pendingLeaves ? <Animated.View entering={FadeInDown.delay(100)} style={{
        marginBottom: Spacing.md
      }}>
        <AlertRow icon="time" color={theme.colors.alertIconInfo} title={`${data.pendingLeaves} Leave Requests`} subtitle="Review and approve pending leaves" onPress={() => router.push('/staff/leaves' as any)} theme={theme} />
      </Animated.View> : null}

      {/* Attendance Widget */}
      <AttendanceWidget data={data} onPress={() => router.push('/staff/manage-students' as any)} theme={theme} isDark={isDark} loading={loading} />

      {/* Grid Menu */}
      <Text style={[styles.sectionTitle, {
        color: theme.colors.textSecondary
      }]}>
        Quick Actions
      </Text>

      <View style={styles.gridContainer}>
        {menuItems.map((item, index) => <StaffDashboardCard key={index} title={item.title} subtitle={item.subtitle} icon={item.icon} gradientColors={item.gradient} onPress={() => router.push(item.route as any)} index={index} badge={item.badge} />)}
      </View>

      <View style={{
        height: 100
      }} />
    </Animated.ScrollView>
  </View>;
}
const getStyles = () => StyleSheet.create({
  container: {
    flex: 1
  },
  scrollContent: {
    padding: Spacing.lg
  },
  headerSection: {
    marginBottom: Spacing.lg
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  greetingText: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.md,
    marginTop: Spacing.xs
  },
  // Attendance Widget Styles
  attendanceCard: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    overflow: 'hidden'
  },
  attHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md
  },
  attIconBox: {
    width: 32,
    height: 32,
    borderRadius: Radii.sm,
    justifyContent: 'center',
    alignItems: 'center'
  },
  attTitle: {
    fontSize: 16,
    fontWeight: '600'
  },
  attMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm
  },
  metricItem: {
    alignItems: 'center',
    flex: 1
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 2
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500'
  },
  verticalDivider: {
    width: 1,
    height: 30
  },
  attFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
    gap: 6
  },
  attStatusText: {
    fontSize: 13,
    fontWeight: '600'
  },
  // Alert Row
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700'
  },
  alertSubtitle: {
    fontSize: 12,
    marginTop: 2
  },
  // Grid
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  }
});