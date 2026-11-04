import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import type { LibraryDestination } from '../../config/libraryNavigation';

const palettes: Record<LibraryDestination['tile'], { light: string; dark: string }> = {
  indigo: { light: '#5B41BD', dark: '#46318D' },
  forest: { light: '#087566', dark: '#10594F' },
  sapphire: { light: '#2563AA', dark: '#204B7E' },
  copper: { light: '#9F4C16', dark: '#773B1D' },
  plum: { light: '#A03471', dark: '#752C56' },
  navy: { light: '#324B8A', dark: '#293D6C' },
  teal: { light: '#0E7083', dark: '#175363' },
};

export default function LibraryActionCard({ item, onPress }: { item: LibraryDestination; onPress: () => void }) {
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();
  const palette = palettes[item.tile];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, {
        width: width < 760 ? (width - 56) / 2 : 220,
        backgroundColor: isDark ? palette.dark : palette.light,
        opacity: pressed ? 0.85 : 1,
      }]}
    >
      <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.decoration}>
        <View style={styles.ring} />
        <Ionicons name={item.icon} size={86} color="#FFFFFF" style={styles.watermark} />
      </View>
      <View style={styles.heading}>
        <View style={styles.iconBadge}><Ionicons name={item.icon} size={22} color="#FFFFFF" /></View>
        <View style={styles.arrow}><Ionicons name="arrow-forward" size={16} color="#FFFFFF" /></View>
      </View>
      <Text style={styles.category}>{item.category}</Text>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 166, borderRadius: 16, padding: 14, overflow: 'hidden' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  iconBadge: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFFFFF24', alignItems: 'center', justifyContent: 'center' },
  arrow: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF18', alignItems: 'center', justifyContent: 'center' },
  category: { color: '#FFFFFFCC', fontSize: 9, lineHeight: 13, fontWeight: '700', letterSpacing: 0.9, marginBottom: 5 },
  title: { color: '#FFFFFF', fontSize: 15, lineHeight: 20, fontWeight: '700', letterSpacing: -0.2 },
  subtitle: { color: '#FFFFFFE6', fontSize: 12, lineHeight: 17, marginTop: 5 },
  decoration: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  ring: { position: 'absolute', right: -52, top: -68, width: 170, height: 170, borderRadius: 85, borderWidth: 24, borderColor: '#FFFFFF08' },
  watermark: { position: 'absolute', right: -18, bottom: -18, opacity: 0.06, transform: [{ rotate: '-15deg' }] },
});
