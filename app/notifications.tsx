import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from '../src/utils/haptics';
import NotificationCard, { type NotificationType } from '../src/components/NotificationCard';
import { notificationInboxService, type InboxNotification } from '../src/services/notificationInboxService';
import { resolveNotificationRoute } from '../src/hooks/useNotificationObserver';
import { useTheme } from '../src/hooks/useTheme';

const typeForEvent = (eventType: string | null): NotificationType => {
  switch (eventType) {
    case 'ATTENDANCE_ABSENT': return 'ATTENDANCE_ABSENT';
    case 'ATTENDANCE_PRESENT': return 'ATTENDANCE_PRESENT';
    case 'DIARY_UPDATED': return 'DIARY';
    case 'RESULT_RELEASED': return 'RESULTS';
    case 'COMPLAINT_CREATED':
    case 'COMPLAINT_RESPONSE': return 'COMPLAINT';
    case 'LMS_CONTENT': return 'LMS';
    case 'TIMETABLE_UPDATED': return 'TIMETABLE';
    case 'NOTICE_ADMIN_STUDENT': return 'NOTICE';
    case 'FEE_REMINDER':
    case 'ARREARS_REMINDER':
    case 'FEE_ADJUSTED': return 'FEE_DUE';
    case 'FEE_COLLECTED': return 'FEE_PAID';
    case 'LEAVE_SUBMITTED':
    case 'LEAVE_APPROVED':
    case 'LEAVE_REJECTED': return 'LEAVE';
    case 'EXPENSE_CREATED':
    case 'EXPENSE_APPROVED':
    case 'EXPENSE_REJECTED': return 'EXPENSE';
    case 'PAYROLL_SUCCESS': return 'PAYROLL';
    case 'BUS_STOP_REACHED':
    case 'BUS_TRIP_COMPLETED':
    case 'TRANSPORT_TRIP_STARTED':
    case 'TRANSPORT_BUS_APPROACHING':
    case 'TRANSPORT_BUS_RUNNING_LATE':
    case 'TRANSPORT_BUS_DEPARTED':
    case 'TRANSPORT_TRIP_CANCELLED':
    case 'STUDENT_BUS_PRESENT':
    case 'STUDENT_BUS_ABSENT': return 'BUS';
    default: return 'NOTICE';
  }
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      setItems(await notificationInboxService.list());
    } catch {
      setError('Could not load notifications. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const open = useCallback(async (item: InboxNotification) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((current) => current.map((entry) => entry.id === item.id
      ? { ...entry, readAt: entry.readAt || new Date().toISOString() }
      : entry));
    void notificationInboxService.markRead(item.id);

    const route = resolveNotificationRoute({ type: item.type || '', deepLink: item.actionUrl || '' });
    if (route) router.push(route as any);
  }, [router]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}> 
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}> 
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.backButton, { backgroundColor: isDark ? '#1C1E38' : '#FFFFFF', borderColor: theme.colors.border }, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.textStrong} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.colors.textStrong }]}>Notifications</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Your recent school updates</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.colors.primary} />}
          renderItem={({ item }) => (
            <NotificationCard
              id={item.id}
              type={typeForEvent(item.type)}
              title={item.title}
              body={item.body}
              createdAt={item.createdAt}
              unread={!item.readAt}
              onPress={() => void open(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(149,149,224,0.16)' : 'rgba(53,53,168,0.10)' }]}>
                <Ionicons name="notifications-off-outline" size={30} color={theme.colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.textStrong }]}>{error ? 'Nothing loaded yet' : 'You’re all caught up'}</Text>
              <Text style={[styles.emptyBody, { color: theme.colors.textMuted }]}>{error || 'New school notifications will appear here.'}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 82, paddingHorizontal: 18, paddingTop: Platform.OS === 'ios' ? 18 : 22, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  backButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerCopy: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { marginTop: 3, fontSize: 13, fontWeight: '500' },
  list: { paddingVertical: 12, paddingBottom: 36 },
  emptyList: { flexGrow: 1 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { width: 62, height: 62, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyBody: { marginTop: 7, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
});
