import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, useSharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import AdminHeader from '../../src/components/AdminHeader';
import { useTheme } from '../../src/hooks/useTheme';
import { api } from '../../src/services/apiClient';
import ResponsiveCard from '../../src/components/ResponsiveCard';
import LogoLoader from '../../src/components/LogoLoader';

// Aesthetic Theme Configuration dynamically built via useTheme

type TriggerType = 'FEE_REMINDER' | 'DIARY_UPDATED' | 'RESULT_RELEASED' | 'NOTICE_ADMIN_STUDENT' | 'ATTENDANCE_ABSENT' | 'ATTENDANCE_PRESENT' | 'TIMETABLE_UPDATED' | 'COMPLAINT_CREATED' | 'EXPENSE_CREATED';

interface TriggerCard {
  id: TriggerType;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: [string, string];
  glow: string;
}

const TRIGGERS: TriggerCard[] = [
{ id: 'FEE_REMINDER', title: 'Fee Reminders', description: 'Dispatch gentle payment reminders to parents with pending dues.', icon: 'wallet-outline', colors: ['#F59E0B', '#B45309'], glow: 'rgba(245, 158, 11, 0.4)' },
{ id: 'DIARY_UPDATED', title: 'Diary Updates', description: 'Remind parents to check recent diary entries for homework and notes.', icon: 'book-outline', colors: ['#3B82F6', '#1D4ED8'], glow: 'rgba(59, 130, 246, 0.4)' },
{ id: 'RESULT_RELEASED', title: 'Result Declarations', description: 'Notify parents that new exam results are published in the portal.', icon: 'podium-outline', colors: ['#10B981', '#047857'], glow: 'rgba(16, 185, 129, 0.4)' },
{ id: 'NOTICE_ADMIN_STUDENT', title: 'Admin Notices', description: 'Send a high-priority push alert for the latest administration notice.', icon: 'megaphone-outline', colors: ['#8B5CF6', '#5B21B6'], glow: 'rgba(139, 92, 246, 0.4)' },
{ id: 'ATTENDANCE_ABSENT', title: 'Absence Alerts', description: 'Instantly notify parents whose children are marked absent today.', icon: 'timer-outline', colors: ['#EF4444', '#B91C1C'], glow: 'rgba(239, 68, 68, 0.4)' },
{ id: 'ATTENDANCE_PRESENT', title: 'Arrival Confirmations', description: 'Confirm safe arrival at school to parents of present students today.', icon: 'checkmark-circle-outline', colors: ['#22C55E', '#15803D'], glow: 'rgba(34, 197, 94, 0.4)' },
{ id: 'TIMETABLE_UPDATED', title: 'Timetable Updates', description: 'Notify all students and parents to check the newly updated timetable.', icon: 'calendar-outline', colors: ['#EC4899', '#BE185D'], glow: 'rgba(236, 72, 153, 0.4)' }];

export default function NotificationsTriggerPage() {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const scrollY = useSharedValue(0);

  const THEME_COLORS = useMemo(() => ({
    background: theme.colors.background,
    surface: theme.colors.card,
    surfaceHighlight: isDark ? '#1A1D28' : '#F3F4F6',
    text: theme.colors.text,
    textMuted: theme.colors.textSecondary,
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    orbOpacity: isDark ? 0.3 : 0.08,
    gradientEnd: isDark ? '#050508' : theme.colors.background
  }), [theme, isDark]);

  const styles = useMemo(() => getStyles(THEME_COLORS), [theme]);

  const [loadingType, setLoadingType] = useState<TriggerType | null>(null);

  const handleFireTrigger = (item: TriggerCard) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Confirm Live Broadcast",
      `Are you sure you want to dispatch ${item.title} to all applicable students and parents? This will immediately send a push notification to their devices.`,
      [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send All",
        style: "destructive",
        onPress: () => submitTrigger(item.id)
      }]

    );
  };

  const submitTrigger = async (type: TriggerType) => {
    Haptics.selectionAsync();
    setLoadingType(type);

    try {
      const res = await api.post<any>('/admin/notifications/test-trigger', { type });
      Alert.alert("Broadcast Status", res.data?.message || `Trigger successful for ${type}.`);
    } catch (error: any) {

      Alert.alert("Failed", error.message || error.response?.data?.error || "Failed to trigger notifications");
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <View style={styles.container}>
            <AdminHeader
        title="System Notifications"
        showBackButton
        scrollY={scrollY} />

            {/* Pure Ambient Background */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <LinearGradient
          colors={[THEME_COLORS.background, THEME_COLORS.gradientEnd]}
          style={StyleSheet.absoluteFill} />

            </View>
            <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => scrollY.value = e.nativeEvent.contentOffset.y}
        scrollEventThrottle={16}>

                <Animated.View entering={FadeInDown.delay(100).springify().damping(16)}>
                    <Text style={styles.headerTitle}>Global Broadcasts</Text>
                    <Text style={styles.headerSubtitle}>
                        One-click communication tools to dispatch targeted system notifications and reminders to parent and student cohorts.
                    </Text>
                </Animated.View>
                <View style={styles.grid}>
                    {TRIGGERS.map((item, index) => {
            const isLoading = loadingType === item.id;
            return (
              <Animated.View
                key={item.id}
                entering={FadeInDown.delay(200 + index * 50).springify().mass(0.8)}>

                                <ResponsiveCard maxWidth={700}>
                                    <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleFireTrigger(item)}
                    disabled={loadingType !== null}
                    style={{ width: '100%' }}>

                                        <View style={styles.card}>
                                            {/* Colored Glow Behind Icon */}
                                            <View style={[styles.glowOrb, { backgroundColor: item.glow }]} />
                                            <View style={styles.cardHeader}>
                                                <LinearGradient
                          colors={item.colors}
                          style={styles.iconBox}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>

                                                    <Ionicons name={item.icon} size={28} color="#FFF" />
                                                </LinearGradient>
                                                <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => handleFireTrigger(item)}
                          disabled={loadingType !== null}>

                                                    {isLoading ?
                          <LogoLoader color={item.colors[0]} size={30} /> :

                          <Text style={[styles.actionBtnText, { color: item.colors[0] }]}>SEND ALL</Text>
                          }
                                                </TouchableOpacity>
                                            </View>
                                            <View style={styles.cardBody}>
                                                <Text style={styles.cardTitle}>{item.title}</Text>
                                                <Text style={styles.cardDesc}>{item.description}</Text>
                                            </View>
                                            <View style={styles.cardBorder} />
                                        </View>
                                    </TouchableOpacity>
                                </ResponsiveCard>
                            </Animated.View>);

          })}
                </View>
                <View style={{ height: 100 }} />
            </ScrollView>
        </View>);

}

const getStyles = (THEME_COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background
  },
  scrollContent: {
    padding: 24,
    paddingTop: 120 // To account for absolute header
  },
  headerTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: THEME_COLORS.text,
    letterSpacing: -1,
    marginBottom: 8
  },
  headerSubtitle: {
    fontSize: 16,
    color: THEME_COLORS.textMuted,
    lineHeight: 24,
    fontWeight: '500',
    marginBottom: 40,
    maxWidth: '90%'
  },
  grid: {
    gap: 20
  },
  card: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 24,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4
  },
  cardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    borderRadius: 24,
    pointerEvents: 'none'
  },
  glowOrb: {
    position: 'absolute',
    width: 150,
    height: 150,
    top: -40,
    left: -40,
    borderRadius: 75,
    opacity: THEME_COLORS.orbOpacity,
    transform: [{ scale: 1.5 }]
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    zIndex: 2
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: THEME_COLORS.surfaceHighlight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  cardBody: {
    zIndex: 2
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME_COLORS.text,
    letterSpacing: -0.5,
    marginBottom: 8
  },
  cardDesc: {
    fontSize: 15,
    color: THEME_COLORS.textMuted,
    lineHeight: 22,
    fontWeight: '500'
  }
});