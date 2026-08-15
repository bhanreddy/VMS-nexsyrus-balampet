import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { notificationInboxService, type InboxNotification } from '../services/notificationInboxService';
import { resolveNotificationRoute } from '../hooks/useNotificationObserver';
import { useTheme } from '../hooks/useTheme';

function formatRelative(input: string): string {
  const then = new Date(input).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 45) return 'just now';
  if (diffSec < 90) return '1 min ago';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(then).toLocaleDateString();
}

type Props = {
  onSendPress?: () => void;
};

export default function NotificationInboxList({ onSendPress }: Props) {
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

  const surface = isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)';

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.listFill}
      contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.colors.primary} />}
    >
      {items.length === 0 ? (
        <View style={styles.centerState}>
          <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(149,149,224,0.16)' : 'rgba(53,53,168,0.10)' }]}>
            <Ionicons name="notifications-off-outline" size={30} color={theme.colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.textStrong }]}>{error ? 'Nothing loaded yet' : 'You’re all caught up'}</Text>
          <Text style={[styles.emptyBody, { color: theme.colors.textMuted }]}>{error || 'New school notifications will appear here.'}</Text>
          {error ? (
            <Pressable
              onPress={() => void load()}
              style={({ pressed }) => [styles.sendCta, { backgroundColor: theme.colors.primary }, pressed && styles.pressed]}
            >
              <Text style={styles.sendCtaText}>Try again</Text>
            </Pressable>
          ) : onSendPress ? (
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSendPress();
              }}
              style={({ pressed }) => [styles.sendCta, { backgroundColor: theme.colors.primary }, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Open bulk notification sender"
            >
              <Ionicons name="megaphone-outline" size={16} color="#FFFFFF" />
              <Text style={styles.sendCtaText}>Notify parents</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        items.map((item) => {
          const unread = !item.readAt;
          return (
            <Pressable
              key={item.id}
              onPress={() => void open(item)}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: surface, borderColor: border },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.rowAccent, { backgroundColor: unread ? theme.colors.primary : border }]} />
              <View style={styles.rowCopy}>
                <View style={styles.rowMeta}>
                  <Text style={[styles.rowTime, { color: theme.colors.textMuted }]}>{formatRelative(item.createdAt)}</Text>
                  {unread ? <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} /> : null}
                </View>
                <Text style={[styles.rowTitle, { color: theme.colors.textStrong }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[styles.rowBody, { color: theme.colors.textMuted }]} numberOfLines={2}>{item.body}</Text>
              </View>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  listFill: { flex: 1, minHeight: 280 },
  sendCta: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14 },
  sendCtaText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  list: { paddingVertical: 4, paddingBottom: 36, gap: 10 },
  emptyList: { flexGrow: 1, minHeight: 280 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 36 },
  emptyIcon: { width: 62, height: 62, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyBody: { marginTop: 7, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  pressed: { opacity: 0.72 },
  row: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 84,
  },
  rowAccent: {
    width: 4,
  },
  rowCopy: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rowTime: {
    fontSize: 11,
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  rowBody: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
});
