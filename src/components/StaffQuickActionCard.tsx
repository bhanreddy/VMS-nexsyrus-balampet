import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withTiming, interpolate } from 'react-native-reanimated';
import { clayTokens } from '../styles/clayTokens';
import { useTheme } from '../hooks/useTheme';
import * as Haptics from '../utils/haptics';
const IS_WEB = Platform.OS === 'web';
const MENU_GAP = 16;

export default React.memo(function StaffQuickActionCard({ item, badge, onPress, index, icon, category, tile = 'indigo' }: {
  item: { key: string; title: string; subtitle: string };
  icon: React.ReactNode;
  category: string;
  tile?: keyof typeof clayTokens.colors.tiles;
  badge?: string;
  onPress: () => void;
  index: number;
}) {
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 1120) - 40;
  const cardWidth = width < 760 ? Math.floor((contentWidth - MENU_GAP) / 2) : 220;
  const compact = cardWidth < 160;
  const borderRadius = compact ? 20 : IS_WEB ? 28 : 24;
  const cardHeight = compact ? 118 : IS_WEB ? 144 : 132;
  const inset = compact ? 8 : 12;
  const pressScale = useSharedValue(1);
  const hoverLift = useSharedValue(0);


  const wrapperStyle = useAnimatedStyle(() => {
    const hoverScale = IS_WEB ? interpolate(hoverLift.value, [0, 1], [1, 1.02]) : 1;
    const y = IS_WEB ? interpolate(hoverLift.value, [0, 1], [0, -3]) : 0;
    return { transform: [{ translateY: y }, { scale: pressScale.value * hoverScale }] };
  });

  const clayStyle = useMemo(() => {
    const palette = clayTokens.colors.tiles[tile];
    const bg = isDark ? palette.dark : palette.bg;
    const shadowColor = palette.shadow;
    if (Platform.OS === 'web') {
      return {
        backgroundColor: bg,
        borderRadius,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.45)',
        boxShadow:
          `0px 8px 18px ${shadowColor}33, ` +
          `-5px -5px 12px ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)'}, ` +
          `inset 2px 2px 4px rgba(255, 255, 255, 0.45), ` +
          `inset -2.5px -2.5px 5px rgba(0, 0, 0, 0.16)`,
      };
    }
    return {
      backgroundColor: bg,
      borderRadius,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.45)',
      shadowColor,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.45 : 0.28,
      shadowRadius: 12,
      elevation: 6,
    };
  }, [tile, isDark, borderRadius]);

  return (
    <Animated.View
      entering={FadeInUp.delay(160 + Math.min(index, 9) * 40).duration(320)}
      style={[wrapperStyle, clayStyle, { width: cardWidth, height: cardHeight, overflow: 'hidden' }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.subtitle}${badge ? `. ${badge} pending` : ''}`}
        onPress={onPress}
        onHoverIn={() => { if (IS_WEB) hoverLift.value = withTiming(1, { duration: 180 }); }}
        onHoverOut={() => { if (IS_WEB) hoverLift.value = withTiming(0, { duration: 220 }); }}
        onPressIn={() => { pressScale.value = withTiming(0.97, { duration: 90 }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
        onPressOut={() => { pressScale.value = withTiming(1, { duration: 110 }); }}
        style={StyleSheet.absoluteFill}
      >
        <LinearGradient
          colors={isDark ? ['rgba(255, 255, 255, 0.05)', 'rgba(0, 0, 0, 0.15)'] : ['rgba(255, 255, 255, 0.26)', 'rgba(0, 0, 0, 0.06)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          pointerEvents="none"
        />
        <View pointerEvents="none" style={{ position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', bottom: -15, right: -15 }} />
        <View style={{ position: 'absolute', top: inset, left: inset }}>
          <View style={{ width: compact ? 30 : 36, height: compact ? 30 : 36, borderRadius: compact ? 9 : 11, backgroundColor: 'rgba(255,255,255,0.22)', borderColor: 'rgba(255,255,255,0.32)', borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ transform: [{ scale: compact ? 0.56 : 0.68 }] }}>{icon}</View>
          </View>
          {badge ? (
            <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#FF3D5C', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1.5, borderColor: '#FFFFFF' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 8.5, fontWeight: '900' }}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ position: 'absolute', top: inset, right: inset, maxWidth: cardWidth - (compact ? 52 : 64), flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.15)', borderColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderRadius: 8, paddingHorizontal: compact ? 5 : 7, paddingVertical: 3 }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFFFFF' }} />
          <Text style={{ color: '#FFFFFF', fontSize: compact ? 7 : 8, fontWeight: '900', flexShrink: 1 }} numberOfLines={1}>{category}</Text>
        </View>
        <View style={{ position: 'absolute', bottom: inset, left: inset, right: inset }}>
          <Text style={{ fontSize: compact ? 12.5 : 13.5, fontWeight: '800', color: '#FFFFFF' }} numberOfLines={1}>{item.title}</Text>
          <Text style={{ fontSize: compact ? 9 : 9.5, fontWeight: '600', color: 'rgba(255,255,255,0.78)', marginTop: 2 }} numberOfLines={1}>{item.subtitle}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
});

