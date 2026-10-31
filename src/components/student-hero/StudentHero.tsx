import React, { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import * as Haptics from '../../utils/haptics';
import StudentPhoto from '../StudentPhoto';
import QuickAccountPickerSheet from '../QuickAccountPickerSheet';
import { useQuickAccountSwitch } from '../../hooks/useQuickAccountSwitch';
import HeroSlidesCarousel from '../hero-slides/HeroSlidesCarousel';
import SchoolStoriesStrip from '../school-stories/SchoolStoriesStrip';
import { SCHOOL_CONFIG, schoolColorWithAlpha } from '../../constants/schoolConfig';
import type { HeroSlideItem } from '../../services/schoolHeroSlidesService';
import type { CelebrationSlideItem } from '../../services/celebrationTypes';
import type { SchoolStoryAuthor } from '../../services/schoolStoriesService';

const DOUBLE_TAP_MS = 320;
const LONG_PRESS_MS = 450;
const GOLD = SCHOOL_CONFIG.theme.accent;
const GOLD_MIST = SCHOOL_CONFIG.theme.ribbonTagline;
const INK = SCHOOL_CONFIG.theme.ribbonGradient[0];
const CHARCOAL = SCHOOL_CONFIG.theme.ribbonGradient[1];
const SLATE = SCHOOL_CONFIG.theme.ribbonGradient[2];
const HERO_WASH = [INK, CHARCOAL, SLATE] as const;

export interface StudentHeroProps {
  firstName: string;
  classLabel: string;
  inchargeLabel?: string | null;
  photoUrl?: string | null;
  unreadCount: number;
  slides: Array<HeroSlideItem | CelebrationSlideItem>;
  stories: SchoolStoryAuthor[];
  onViewNotifications: () => void;
  onStoryViewed?: (storyId: string) => void;
  onAccountSwitched?: () => void | Promise<void>;
}

export default function StudentHero({
  firstName,
  classLabel,
  inchargeLabel,
  photoUrl,
  unreadCount,
  slides,
  stories,
  onViewNotifications,
  onStoryViewed,
  onAccountSwitched,
}: StudentHeroProps) {
  const { t } = useTranslation();
  const lastTapRef = useRef(0);
  const longPressTriggeredRef = useRef(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const {
    accounts,
    activeId,
    sheetOpen,
    switching,
    switchToNext,
    switchTo,
    openSheet,
    closeSheet,
  } = useQuickAccountSwitch(onAccountSwitched);

  const welcome = t('studentHome.heroWelcome', 'Where Students Meet Their Future');

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
        await switchToNext();
        setBusyUserId(null);
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
    await switchTo(userId);
    setBusyUserId(null);
  }, [switchTo]);

  return (
    <Animated.View entering={FadeInDown.duration(420)} style={styles.root}>
      <LinearGradient colors={[...HERO_WASH]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.panel}>
        <LinearGradient
          colors={[schoolColorWithAlpha(GOLD, 0), schoolColorWithAlpha(GOLD, 0.22), schoolColorWithAlpha(GOLD, 0)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.goldWash}
          pointerEvents="none"
        />
        <View style={styles.orbGold} pointerEvents="none" />
        <View style={styles.orbSoft} pointerEvents="none" />

        <View style={styles.topRow}>
          <View style={styles.copy}>
            <Text style={styles.hello} numberOfLines={1}>
              {t('studentHome.hiName', { name: firstName, defaultValue: `Hi, ${firstName}` })}
            </Text>
            <View style={styles.nameRule} />
            <Text style={styles.classLine} numberOfLines={1}>{classLabel}</Text>
            {!!inchargeLabel && (
              <View style={styles.inchargeChip}>
                <View style={styles.inchargeDot} />
                <Text style={styles.inchargeText} numberOfLines={1}>{inchargeLabel}</Text>
              </View>
            )}
          </View>
          <View style={styles.photoHalo}>
            <Pressable
              onPress={handleAvatarPress}
              onLongPress={handleLongPress}
              delayLongPress={LONG_PRESS_MS}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('driver_ui.account_switch_hint_accessibility', 'Hold to switch accounts; double-tap the photo for the next account')}
              style={({ pressed }) => [styles.photoRing, pressed && styles.pressed]}
            >
              <StudentPhoto
                photoUrl={photoUrl}
                displayName={firstName}
                size={64}
                borderRadius={32}
                fallbackTextStyle={styles.photoFallback}
              />
              {accounts.length > 0 && (
                <View style={styles.switchBadge}>
                  <Ionicons name="swap-horizontal" size={10} color={INK} />
                  {accounts.length > 1 ? (
                    <Text style={styles.switchBadgeText}>{accounts.length}</Text>
                  ) : null}
                </View>
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.welcomeRow}>
          <View style={styles.welcomeMark} />
          <Text style={styles.welcome} numberOfLines={1}>{welcome}</Text>
        </View>

        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onViewNotifications();
          }}
          style={({ pressed }) => [styles.urgentBar, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('studentHome.urgentNotifications', { count: unreadCount })}
        >
          <View style={styles.bellWrap}>
            <Ionicons name="notifications" size={16} color={GOLD} />
          </View>
          <Text style={styles.urgentText} numberOfLines={1}>
            {unreadCount > 0
              ? t('studentHome.urgentCount', { count: unreadCount, defaultValue: `${unreadCount} Urgent Notifications` })
              : t('studentHome.noUrgent', 'No urgent notifications')}
          </Text>
          <View style={styles.viewBtn}>
            <Text style={styles.viewBtnText}>{t('studentHome.view', 'View')}</Text>
          </View>
        </Pressable>

        <HeroSlidesCarousel slides={slides} activeDotColor={GOLD} />
        <SchoolStoriesStrip
          stories={stories}
          tone="onDark"
          accentColor={GOLD}
          style={{ paddingTop: 12 }}
          onStoryViewed={onStoryViewed}
        />
      </LinearGradient>

      <QuickAccountPickerSheet
        visible={sheetOpen}
        accounts={accounts}
        activeId={activeId}
        switching={switching}
        busyUserId={busyUserId}
        onClose={closeSheet}
        onSelect={handleSelectAccount}
      />

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  panel: {
    borderRadius: 0,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  goldWash: { ...StyleSheet.absoluteFillObject },
  orbGold: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: schoolColorWithAlpha(GOLD, 0.16),
    right: -78,
    top: -96,
  },
  orbSoft: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: schoolColorWithAlpha(GOLD, 0.08),
    left: -64,
    bottom: 8,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  copy: { flex: 1, minWidth: 0 },
  hello: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  nameRule: {
    width: 36,
    height: 2,
    borderRadius: 2,
    backgroundColor: GOLD,
    marginTop: 8,
  },
  classLine: { color: 'rgba(255,255,255,0.78)', fontSize: 14, fontWeight: '600', marginTop: 8 },
  inchargeChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    maxWidth: '100%',
    backgroundColor: schoolColorWithAlpha(GOLD, 0.14),
    borderWidth: 1,
    borderColor: schoolColorWithAlpha(GOLD, 0.42),
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  inchargeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD,
  },
  inchargeText: { color: GOLD_MIST, fontSize: 11, fontWeight: '800', flexShrink: 1 },
  photoHalo: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 1,
    borderColor: schoolColorWithAlpha(GOLD, 0.45),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: schoolColorWithAlpha(GOLD, 0.1),
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 6,
  },
  photoRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2.5,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: schoolColorWithAlpha('#FFFFFF', 0.08),
  },
  switchBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    minWidth: 22,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: GOLD,
    borderWidth: 2,
    borderColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  switchBadgeText: { color: INK, fontSize: 9, fontWeight: '800' },
  photoFallback: { color: GOLD_MIST, fontSize: 22 },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 14,
  },
  welcomeMark: {
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: GOLD,
  },
  welcome: {
    flex: 1,
    color: GOLD_MIST,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  urgentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: schoolColorWithAlpha(GOLD, 0.32),
    borderRadius: 999,
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 6,
    marginBottom: 14,
    gap: 8,
  },
  bellWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: schoolColorWithAlpha(GOLD, 0.18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgentText: { flex: 1, color: '#F7F3EA', fontSize: 13, fontWeight: '700' },
  viewBtn: {
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  viewBtnText: { color: INK, fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
});
