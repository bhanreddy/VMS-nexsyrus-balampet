import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import * as Haptics from '../../utils/haptics';
import StudentPhoto from '../StudentPhoto';
import QuickAccountPickerSheet from '../QuickAccountPickerSheet';
import { useQuickAccountSwitch } from '../../hooks/useQuickAccountSwitch';
import HeroSlidesCarousel from '../hero-slides/HeroSlidesCarousel';
import SchoolStoriesStrip from '../school-stories/SchoolStoriesStrip';
import { useTheme } from '../../hooks/useTheme';
import type { SchoolTheme } from '../../hooks/useTheme';
import type { HeroSlideItem } from '../../services/schoolHeroSlidesService';
import type { CelebrationSlideItem } from '../../services/celebrationTypes';
import type { SchoolStoryAuthor } from '../../services/schoolStoriesService';

const DOUBLE_TAP_MS = 320;
const LONG_PRESS_MS = 450;

export interface StudentHeroProps {
  firstName: string;
  classLabel: string;
  inchargeLabel?: string | null;
  photoUrl?: string | null;
  unreadCount: number;
  slides: (HeroSlideItem | CelebrationSlideItem)[];
  stories: SchoolStoryAuthor[];
  onViewNotifications: () => void;
  onStoryViewed?: (storyId: string) => void;
  onAccountSwitched?: () => void | Promise<void>;
}

export default function StudentHero({ firstName, classLabel, inchargeLabel, photoUrl, unreadCount, slides, stories, onViewNotifications, onStoryViewed, onAccountSwitched }: StudentHeroProps) {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const accent = isDark ? theme.colors.primaryLight : theme.colors.primaryDark;
  const lastTapRef = useRef(0);
  const longPressTriggeredRef = useRef(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const { accounts, activeId, sheetOpen, switching, switchToNext, switchTo, openSheet, closeSheet } = useQuickAccountSwitch(onAccountSwitched);
  const notificationLabel = unreadCount > 0
    ? t('studentHome.urgentCount', { count: unreadCount, defaultValue: `${unreadCount} urgent notifications` })
    : t('studentHome.noUrgent', 'No urgent notifications');

  const handleAvatarPress = useCallback(() => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      void (async () => {
        setBusyUserId(activeId);
        try { await switchToNext(); } finally { setBusyUserId(null); }
      })();
      return;
    }
    lastTapRef.current = now;
    void Haptics.selectionAsync();
  }, [activeId, switchToNext]);

  const handleLongPress = useCallback(() => {
    longPressTriggeredRef.current = true;
    void openSheet();
  }, [openSheet]);

  const handleSelectAccount = useCallback(async (userId: string) => {
    setBusyUserId(userId);
    try { await switchTo(userId); } finally { setBusyUserId(null); }
  }, [switchTo]);

  return (
    <Animated.View entering={FadeInDown.duration(280).reduceMotion(ReduceMotion.System)} style={styles.root}>
      <View style={styles.panel}>
        <View style={styles.topRow}>
          <View style={styles.copy}>
            <Text accessibilityRole="header" style={styles.hello} numberOfLines={2}>
              {t('studentHome.hiName', { name: firstName, defaultValue: `Hi, ${firstName}` })}
            </Text>
            <Text style={styles.classLine}>{classLabel}</Text>
            {!!inchargeLabel && <View style={styles.teacherRow}>
              <Ionicons name="school-outline" size={13} color={theme.colors.textSecondary} />
              <Text style={styles.teacherText} numberOfLines={2}>{inchargeLabel}</Text>
            </View>}
          </View>
          <View style={styles.avatarWrap}>
            <Pressable
              onPress={handleAvatarPress}
              onLongPress={handleLongPress}
              delayLongPress={LONG_PRESS_MS}
              disabled={switching}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={t('driver_ui.account_switch_hint_accessibility', 'Hold to switch accounts; double-tap the photo for the next account')}
              accessibilityState={{ busy: switching, disabled: switching }}
              style={({ pressed }) => [styles.photoFrame, pressed && styles.pressed]}
            >
              <StudentPhoto photoUrl={photoUrl} displayName={firstName} size={54} borderRadius={16} fallbackTextStyle={styles.photoFallback} />
            </Pressable>
            {accounts.length > 0 && <Pressable
              onPress={() => { void openSheet(); }}
              disabled={switching}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('studentHome.switchStudent', 'Switch student')}
              accessibilityState={{ busy: switching, disabled: switching }}
              style={({ pressed }) => [styles.switchBadge, pressed && styles.pressed]}
            >
              <Ionicons name="swap-horizontal" size={12} color={accent} />
              {accounts.length > 1 && <Text style={styles.switchBadgeText}>{accounts.length}</Text>}
            </Pressable>}
          </View>
        </View>
        <Pressable
          onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onViewNotifications(); }}
          style={({ pressed }) => [styles.notifications, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${notificationLabel}. ${t('studentHome.viewNotifications', 'View notifications')}`}
        >
          <Ionicons name="notifications-outline" size={17} color={unreadCount > 0 ? accent : theme.colors.textSecondary} />
          <Text style={[styles.notificationText, unreadCount > 0 && styles.unreadText]}>{notificationLabel}</Text>
          <View style={styles.notificationAction}><Text style={styles.viewText}>{t('studentHome.view', 'View')}</Text><Ionicons name="chevron-forward" size={14} color={accent} /></View>
        </Pressable>
        <HeroSlidesCarousel slides={slides} dotTone={isDark ? 'onDark' : 'onLight'} activeDotColor={accent} style={styles.mediaSpacing} />
        <SchoolStoriesStrip stories={stories} tone={isDark ? 'onDark' : 'onLight'} accentColor={accent} style={styles.mediaSpacing} onStoryViewed={onStoryViewed} />
      </View>
      <QuickAccountPickerSheet visible={sheetOpen} accounts={accounts} activeId={activeId} switching={switching} busyUserId={busyUserId} onClose={closeSheet} onSelect={handleSelectAccount} />
    </Animated.View>
  );
}

const getStyles = (theme: SchoolTheme, dark: boolean) => StyleSheet.create({
  root: { width: '100%', paddingHorizontal: 18, paddingTop: 14 },
  panel: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, borderRadius: 20, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, shadowColor: '#20172E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: dark ? 0.12 : 0.035, shadowRadius: 10, elevation: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  copy: { flex: 1, minWidth: 0 },
  hello: { color: theme.colors.textStrong, fontSize: 24, lineHeight: 30, fontWeight: '600', letterSpacing: -0.6 },
  classLine: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: '500', marginTop: 3 },
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  teacherText: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 17, flexShrink: 1 },
  avatarWrap: { width: 58, height: 60, marginRight: 2 },
  photoFrame: { width: 58, height: 58, borderRadius: 18, padding: 1, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: dark ? '#2B263A' : '#F0ECF5', alignItems: 'center', justifyContent: 'center' },
  photoFallback: { color: dark ? theme.colors.primaryLight : theme.colors.primaryDark, fontSize: 23, fontWeight: '600' },
  switchBadge: { position: 'absolute', right: -6, bottom: -3, minWidth: 29, height: 24, paddingHorizontal: 5, borderRadius: 8, backgroundColor: dark ? '#332A44' : '#EBE4F3', borderWidth: 2, borderColor: theme.colors.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  switchBadgeText: { color: dark ? theme.colors.primaryLight : theme.colors.primaryDark, fontSize: 9, fontWeight: '600' },
  notifications: { flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, marginTop: 14, minHeight: 45, paddingVertical: 9 },
  notificationText: { flex: 1, color: theme.colors.textSecondary, fontSize: 12, lineHeight: 17 },
  unreadText: { color: theme.colors.textStrong, fontWeight: '600' },
  notificationAction: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewText: { color: dark ? theme.colors.primaryLight : theme.colors.primaryDark, fontSize: 12, fontWeight: '600' },
  mediaSpacing: { marginTop: 10, marginBottom: 10 },
  pressed: { opacity: 0.7 },
});
