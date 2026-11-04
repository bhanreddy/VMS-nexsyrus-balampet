import { useFlatSurface } from '../../contexts/SurfaceAppearanceContext';
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
import * as Haptics from '../../utils/haptics';
import StudentPhoto from '../StudentPhoto';
import QuickAccountPickerSheet from '../QuickAccountPickerSheet';
import { useQuickAccountSwitch } from '../../hooks/useQuickAccountSwitch';
import HeroSlidesCarousel from '../hero-slides/HeroSlidesCarousel';
import SchoolStoriesStrip from '../school-stories/SchoolStoriesStrip';
import type { HeroSlideItem } from '../../services/schoolHeroSlidesService';
import type { CelebrationSlideItem } from '../../services/celebrationTypes';
import type { SchoolStoryAuthor } from '../../services/schoolStoriesService';

const DOUBLE_TAP_MS = 320;
const LONG_PRESS_MS = 450;
const NAVY = ['#15245C', '#1B2F78', '#243A86'] as const;
const RING = '#F5C518';

export interface StaffHeroProps {
  welcomeText?: string;
  firstName: string;
  roleLine: string;
  chipLabel?: string | null;
  photoUrl?: string | null;
  pendingLeaves?: number;
  unreadUpdates?: number;
  slides: (HeroSlideItem | CelebrationSlideItem)[];
  stories: SchoolStoryAuthor[];
  canAddStories?: boolean;
  addPhotoUrl?: string | null;
  disableAccountSwitch?: boolean;
  onReviewLeaves: () => void;
  onViewUpdates: () => void;
  onViewNotifications: () => void;
  onPublished?: () => void | Promise<void>;
  onAccountSwitched?: () => void | Promise<void>;
}

export default function StaffHero({
  welcomeText = 'Where Teachers Shape Tomorrow',
  firstName,
  roleLine,
  chipLabel,
  photoUrl,
  pendingLeaves = 0,
  unreadUpdates = 0,
  slides,
  stories,
  canAddStories = false,
  addPhotoUrl,
  disableAccountSwitch = false,
  onReviewLeaves,
  onViewUpdates,
  onViewNotifications,
  onPublished,
  onAccountSwitched,
}: StaffHeroProps) {
  const flat = useFlatSurface();
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

  const action = pendingLeaves > 0
    ? {
      text: `${pendingLeaves} Leave request${pendingLeaves === 1 ? '' : 's'} awaiting`,
      onPress: onReviewLeaves,
    }
    : unreadUpdates > 0
      ? {
        text: `${unreadUpdates} Update${unreadUpdates === 1 ? '' : 's'} for you`,
        onPress: onViewUpdates,
      }
      : {
        text: 'No urgent updates',
        onPress: onViewNotifications,
      };

  const handleAvatarPress = useCallback(() => {
    if (disableAccountSwitch) return;
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
  }, [activeId, disableAccountSwitch, switchToNext]);

  const handleLongPress = useCallback(() => {
    if (disableAccountSwitch) return;
    longPressTriggeredRef.current = true;
    void openSheet();
  }, [disableAccountSwitch, openSheet]);

  const handleSelectAccount = useCallback(async (userId: string) => {
    setBusyUserId(userId);
    await switchTo(userId);
    setBusyUserId(null);
  }, [switchTo]);

  return (
    <Animated.View entering={FadeInDown.duration(420)} style={styles.root}>
      <LinearGradient colors={flat ? ['#292354', '#493781', '#315E87'] : [...NAVY]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.panel}>
        <View style={styles.orbOne} pointerEvents="none" />
        <View style={styles.orbTwo} pointerEvents="none" />

        <View style={styles.topRow}>
          <View style={styles.copy}>
            <Text style={styles.hello} numberOfLines={1}>{`Hi, ${firstName}`}</Text>
            <Text style={styles.roleLine} numberOfLines={1}>{roleLine}</Text>
            {!!chipLabel && (
              <View style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>{chipLabel}</Text>
              </View>
            )}
          </View>
          <Pressable
            onPress={handleAvatarPress}
            onLongPress={handleLongPress}
            delayLongPress={LONG_PRESS_MS}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Hold to switch accounts; double-tap the photo for the next account"
            style={({ pressed }) => [styles.photoRing, pressed && styles.pressed]}
          >
            <StudentPhoto
              photoUrl={photoUrl}
              displayName={firstName}
              size={64}
              borderRadius={32}
              fallbackTextStyle={styles.photoFallback}
            />
            {!disableAccountSwitch && accounts.length > 0 && (
              <View style={styles.switchBadge}>
                <Ionicons name="swap-horizontal" size={10} color="#FFFFFF" />
                {accounts.length > 1 ? (
                  <Text style={styles.switchBadgeText}>{accounts.length}</Text>
                ) : null}
              </View>
            )}
          </Pressable>
        </View>

        <Text style={styles.welcome} numberOfLines={1}>{welcomeText}</Text>

        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            action.onPress();
          }}
          style={({ pressed }) => [styles.urgentBar, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={action.text}
        >
          <View style={styles.bellWrap}>
            <Ionicons name="notifications" size={16} color="#1E3A8A" />
          </View>
          <Text style={styles.urgentText} numberOfLines={1}>{action.text}</Text>
          <View style={styles.viewBtn}>
            <Text style={styles.viewBtnText}>{pendingLeaves > 0 ? 'Review' : 'View'}</Text>
          </View>
        </Pressable>

        <HeroSlidesCarousel slides={slides} />
        <SchoolStoriesStrip
          stories={stories}
          canAdd={canAddStories}
          addPhotoUrl={addPhotoUrl}
          tone="onDark"
          style={{ paddingTop: 12 }}
          onPublished={onPublished}
        />
      </LinearGradient>

      {!disableAccountSwitch && (
        <QuickAccountPickerSheet
          visible={sheetOpen}
          accounts={accounts}
          activeId={activeId}
          switching={switching}
          busyUserId={busyUserId}
          onClose={closeSheet}
          onSelect={handleSelectAccount}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  panel: {
    borderRadius: 0,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 18,
    overflow: 'hidden',
  },
  orbOne: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(125,211,252,0.10)',
    right: -50,
    top: -70,
  },
  orbTwo: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(251,191,36,0.10)',
    left: -40,
    bottom: 40,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  copy: { flex: 1, minWidth: 0 },
  hello: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  roleLine: { color: 'rgba(255,255,255,0.78)', fontSize: 14, fontWeight: '600', marginTop: 4 },
  chip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { color: '#1E3A8A', fontSize: 11, fontWeight: '800' },
  photoRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: RING,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  switchBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    minWidth: 22,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#1D4ED8',
    borderWidth: 2,
    borderColor: '#15245C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  switchBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  photoFallback: { color: '#FFFFFF', fontSize: 22 },
  welcome: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 12,
  },
  urgentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 6,
    marginBottom: 14,
    gap: 8,
  },
  bellWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgentText: { flex: 1, color: '#0F172A', fontSize: 13, fontWeight: '700' },
  viewBtn: {
    backgroundColor: '#FACC15',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  viewBtnText: { color: '#1E3A8A', fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },
});
