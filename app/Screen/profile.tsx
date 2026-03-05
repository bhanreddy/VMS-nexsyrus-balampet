import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Dimensions, SafeAreaView, Platform, StatusBar, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { StudentService } from '../../src/services/studentService';
import { Student } from '../../src/types/models';
import { useAuth } from '../../src/hooks/useAuth';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
const {
  width
} = Dimensions.get('window');
const ProfileScreen = () => {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const {
    t
  } = useTranslation();
  const router = useRouter();
  const {
    user
  } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fetchProfile = async () => {
    // Strict Role Guard
    if (user?.role !== 'student') return;
    try {
      const data = await StudentService.getProfile();
      setStudent(data);
    } catch (error) {

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect(() => {
    fetchProfile();
  }, []);
  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchProfile();
  };
  if (loading) {
    return <View style={styles.loadingContainer}>
                <LogoLoader size={60} color="#4F46E5" />
            </View>;
  }
  if (!student) {
    return <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{t('common.error_loading_profile', 'Failed to load profile')}</Text>
                <TouchableOpacity onPress={fetchProfile} style={styles.retryButton}>
                    <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
                </TouchableOpacity>
            </View>;
  }

  // Extract enrollment details safely
  const enrollment = student.current_enrollment || {
    class_code: 'N/A',
    section_name: 'N/A',
    roll_number: 'N/A',
    academic_year: ''
  };

  // Extract primary parent/guardian safely
  const primaryParent = student.parents?.find((p) => p.is_primary) || student.parents?.[0];
  return <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />
            {/* Header / Banner */}
            <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={{
          top: 10,
          bottom: 10,
          left: 10,
          right: 10
        }}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('profile.title', 'My Profile')}</Text>
                    <View style={{
          width: 24
        }} />
                </View>
                <View style={styles.profileSummary}>
                    <View style={styles.avatarContainer}>
                        <Image source={{
            uri: student.photo_url || `https://ui-avatars.com/api/?name=${student.first_name}+${student.last_name}&background=random&size=200`
          }} style={styles.avatar} />
                        <View style={styles.statusBadge}>
                            <View style={[styles.statusDot, {
              backgroundColor: student.status === 'active' ? '#10B981' : '#EF4444'
            }]} />
                        </View>
                    </View>
                    <Text style={styles.name}>{student.display_name}</Text>
                    <Text style={styles.rollNo}>
                        {enrollment.class_code} - {enrollment.section_name} | Roll: {enrollment.roll_number}
                    </Text>
                    <View style={styles.idChip}>
                        <Text style={styles.idText}>ID: {student.admission_no}</Text>
                    </View>
                </View>
            </Animated.View>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="transparent" colors={['transparent']} progressBackgroundColor="transparent" />}>
                {refreshing &&
      <View style={{ width: '100%', alignItems: 'center', paddingVertical: 20 }}>
                        <LogoLoader size={30} />
                    </View>
      }
                {/* Personal Info Card */}
                <Animated.View entering={FadeInUp.delay(200).duration(500)} style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="person" size={20} color="#4F46E5" />
                        <Text style={styles.cardTitle}>{t('profile.personal_info', 'Personal Information')}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <InfoItem label={t('profile.dob', 'Date of Birth')} value={new Date(student.dob).toLocaleDateString()} icon="calendar-outline" />
                        <InfoItem label={t('profile.gender', 'Gender')} value={student.gender_id === 1 ? 'Male' : 'Female'} icon="male-female-outline" />
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <InfoItem label={t('profile.email', 'Email')} value={student.email || 'N/A'} icon="mail-outline" />
                        <InfoItem label={t('profile.phone', 'Phone')} value={student.phone || 'N/A'} icon="call-outline" />
                    </View>
                </Animated.View>
                {/* Parent Info Card */}
                {primaryParent && <Animated.View entering={FadeInUp.delay(300).duration(500)} style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="people" size={20} color="#F59E0B" />
                            <Text style={styles.cardTitle}>{t('profile.guardian_info', 'Guardian Details')}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <InfoItem label={t('profile.guardian_name', 'Name')} value={`${primaryParent.first_name} ${primaryParent.last_name} (${primaryParent.relation})`} icon="person-outline" />
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.infoRow}>
                            <InfoItem label={t('profile.guardian_phone', 'Phone')} value={primaryParent.phone || 'N/A'} icon="call-outline" />
                            <InfoItem label={t('profile.occupation', 'Occupation')} value={primaryParent.occupation || 'N/A'} icon="briefcase-outline" />
                        </View>
                    </Animated.View>}
                {/* Other Details - Skeleton for future expansion */}
                <Animated.View entering={FadeInUp.delay(400).duration(500)} style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="school" size={20} color="#10B981" />
                        <Text style={styles.cardTitle}>{t('profile.academic_info', 'Academic Details')}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <InfoItem label={t('profile.admission_date', 'Admission Date')} value={new Date(student.admission_date).toLocaleDateString()} icon="calendar-number-outline" />
                        <InfoItem label={t('profile.academic_year', 'Academic Year')} value={enrollment.academic_year || 'Current'} icon="time-outline" />
                    </View>
                </Animated.View>
                <View style={{
        height: 40
      }} />
            </ScrollView>
        </SafeAreaView>;
};
const InfoItem = ({
  label,
  value,
  icon

}: {label: string;value: string;icon: any;}) => {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  return <View style={styles.infoItem}>
        <View style={styles.labelRow}>
            <Ionicons name={icon} size={14} color="#6B7280" />
            <Text style={styles.infoLabel}>{label}</Text>
        </View>
        <Text style={styles.infoValue}>{value}</Text>
    </View>;
};
export default ProfileScreen;
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.card
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 12
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: 8
  },
  retryText: {
    color: theme.colors.background,
    fontWeight: '600'
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 20 : 0,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 10
    },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 10
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
    height: 48
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.background
  },
  profileSummary: {
    alignItems: 'center'
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: theme.colors.background
  },
  statusBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: theme.colors.background,
    padding: 3,
    borderRadius: 12
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981'
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.background,
    marginBottom: 4
  },
  rollNo: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 12,
    fontWeight: '500'
  },
  idChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16
  },
  idText: {
    color: theme.colors.background,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  scrollContent: {
    padding: 16,
    paddingTop: 24
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937'
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16
  },
  infoItem: {
    flex: 1,
    minWidth: '45%'
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4
  },
  infoLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500'
  },
  infoValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600'
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.card,
    marginVertical: 16
  }
});