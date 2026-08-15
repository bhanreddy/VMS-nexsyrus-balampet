import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../utils/haptics';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

export function canUseAdminNotificationBroadcast(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'principal';
}

export type NotificationWorkspaceTab = 'inbox' | 'send';

type Props = {
  /** Compact row for tight headers; default is the bulk-sender hero. */
  compact?: boolean;
  value: NotificationWorkspaceTab;
  onChange: (tab: NotificationWorkspaceTab) => void;
};

/**
 * Lets admins switch between their personal inbox and the bulk parent-sender
 * on the same notifications page.
 */
export default function AdminNotificationSwitcher({ compact = false, value, onChange }: Props) {
  const { role } = useAuth();
  const { theme, isDark } = useTheme();

  if (!canUseAdminNotificationBroadcast(role)) return null;

  const sendActive = value === 'send';
  const accent = theme.colors.primary;
  const trackBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';
  const trackBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)';
  const inactiveColor = theme.colors.textMuted;

  const go = (tab: NotificationWorkspaceTab) => {
    if (tab === value) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(tab);
  };

  return (
    <View
      style={[
        styles.track,
        compact && styles.trackCompact,
        { backgroundColor: trackBg, borderColor: trackBorder },
      ]}
      accessibilityRole="tablist"
    >
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: !sendActive }}
        accessibilityLabel="Notification inbox"
        onPress={() => go('inbox')}
        style={({ pressed }) => [
          styles.tab,
          compact && styles.tabCompact,
          !sendActive && { backgroundColor: isDark ? '#1C1E38' : '#FFFFFF' },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="notifications-outline"
          size={compact ? 14 : 15}
          color={!sendActive ? accent : inactiveColor}
        />
        <Text style={[styles.label, compact && styles.labelCompact, { color: !sendActive ? accent : inactiveColor }]}>
          Inbox
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: sendActive }}
        accessibilityLabel="Send bulk notifications"
        onPress={() => go('send')}
        style={({ pressed }) => [
          styles.tab,
          compact && styles.tabCompact,
          sendActive && { backgroundColor: isDark ? '#1C1E38' : '#FFFFFF' },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="megaphone-outline"
          size={compact ? 14 : 15}
          color={sendActive ? accent : inactiveColor}
        />
        <Text style={[styles.label, compact && styles.labelCompact, { color: sendActive ? accent : inactiveColor }]}>
          Send
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    gap: 4,
    zIndex: 2,
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  trackCompact: {
    borderRadius: 14,
    padding: 3,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  tabCompact: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 11,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  labelCompact: {
    fontSize: 12,
  },
  pressed: {
    opacity: 0.78,
  },
});
