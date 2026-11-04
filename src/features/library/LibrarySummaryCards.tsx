import React, { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { flatCard } from '../../theme/surfaceStyles';
import type { LibraryReports } from '../../services/libraryService';

export default function LibrarySummaryCards({ reports }: { reports: LibraryReports }) {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const availableWidth = measuredWidth ?? Math.max(0, Math.min(width, 1120) - 58);
  const columns = availableWidth >= 700 ? 4 : 2;
  const cellWidth = availableWidth / columns;
  const money = (value: unknown) => `₹${Number(value || 0).toFixed(2)}`;
  const metrics: { label: string; value: string | number; icon: keyof typeof Ionicons.glyphMap }[] = [
    { label: 'Total copies', value: reports.inventory.reduce((sum, item) => sum + item.count, 0), icon: 'library-outline' },
    { label: 'Available', value: reports.inventory.find((item) => item.status === 'available')?.count || 0, icon: 'checkmark-circle-outline' },
    { label: 'On loan', value: reports.active_loans, icon: 'swap-horizontal-outline' },
    { label: 'Overdue', value: reports.overdue, icon: 'time-outline' },
    { label: 'Returned', value: reports.returned, icon: 'return-down-back-outline' },
    { label: 'Readers served', value: reports.borrowers, icon: 'people-outline' },
    { label: 'Outstanding fines', value: money(reports.outstanding_fines), icon: 'cash-outline' },
    { label: 'Fines collected', value: money(reports.collected_fines), icon: 'wallet-outline' },
  ];

  return <View style={[flatCard(isDark), styles.card]}><View style={styles.grid} onLayout={({ nativeEvent }) => {
    if (nativeEvent.layout.width > 0) setMeasuredWidth(nativeEvent.layout.width);
  }}>
    {metrics.map(({ label, value, icon }, index) => <View key={label} accessible accessibilityLabel={`${label}: ${value}`}
      style={[styles.cell, {
        width: cellWidth,
        borderColor: theme.colors.border,
        borderRightWidth: (index + 1) % columns === 0 ? 0 : StyleSheet.hairlineWidth,
        borderBottomWidth: index < metrics.length - columns ? StyleSheet.hairlineWidth : 0,
      }]}>
      <View style={styles.labelRow}>
        <Ionicons name={icon} size={14} color={(isDark ? ['#B0AAFF', '#6EE7B7', '#A9D1FF', '#F8CC82', '#7DE3C4', '#D2BBFF', '#FFB8DB', '#6EE7B7'] : ['#4F46E5', '#047857', '#2557A7', '#B45309', '#076C59', '#6336AA', '#BE123C', '#047857'])[index]} />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}
        style={[styles.value, { color: theme.colors.textStrong }]}>{value}</Text>
    </View>)}
  </View></View>;
}

const styles = StyleSheet.create({
  card: { padding: 8, borderRadius: 20, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { minHeight: 64, paddingHorizontal: 10, paddingVertical: 8, gap: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  label: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  value: { fontSize: 20, lineHeight: 24, fontWeight: '800', letterSpacing: -0.4 },
});
