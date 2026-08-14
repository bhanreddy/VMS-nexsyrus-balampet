import React, { useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppTextInput from '@/src/components/AppTextInput';
import {
  CASH_DENOMINATIONS,
  buildCashDenominationBreakdownFromPieces,
  calculateCashDenominations,
  formatAmount,
  piecesFromCashDenominationBreakdown,
  type CashDenominationPieces,
  type CashDenominationValue,
} from '../../utils/collectionReport';

interface CashDenominationCalculatorProps {
  cashTotal: number;
  pieces: CashDenominationPieces;
  onChange: (pieces: CashDenominationPieces) => void;
  isDark: boolean;
  accentColor?: string;
  showSuggestion?: boolean;
}

function differenceLabel(difference: number): { text: string; tone: 'match' | 'short' | 'excess' } {
  if (difference === 0) return { text: 'Matches cash total', tone: 'match' };
  if (difference > 0) return { text: `Excess ${formatAmount(difference)}`, tone: 'excess' };
  return { text: `Short ${formatAmount(Math.abs(difference))}`, tone: 'short' };
}

export default function CashDenominationCalculator({
  cashTotal,
  pieces,
  onChange,
  isDark,
  accentColor = '#0D9488',
  showSuggestion = true,
}: CashDenominationCalculatorProps) {
  const breakdown = useMemo(
    () => buildCashDenominationBreakdownFromPieces(pieces),
    [pieces],
  );
  const difference = Number((breakdown.allocatedTotal - cashTotal).toFixed(2));
  const status = differenceLabel(difference);

  const textColor = isDark ? '#F8FAFC' : '#0F172A';
  const secondaryColor = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? 'rgba(255,255,255,0.09)' : '#D9E2EC';
  const cardBg = isDark ? '#18212F' : '#FFFFFF';
  const rowBg = isDark ? '#111827' : '#F8FAFC';
  const inputBg = isDark ? '#0F172A' : '#FFFFFF';
  const statusColor =
    status.tone === 'match' ? '#059669' : status.tone === 'excess' ? '#D97706' : '#DC2626';

  const setPieces = (denomination: CashDenominationValue, next: number) => {
    onChange({
      ...pieces,
      [denomination]: Math.max(0, Math.min(99999, Math.floor(next) || 0)),
    });
  };

  const bump = (denomination: CashDenominationValue, delta: number) => {
    setPieces(denomination, (pieces[denomination] ?? 0) + delta);
  };

  const applySuggestion = () => {
    onChange(piecesFromCashDenominationBreakdown(calculateCashDenominations(cashTotal)));
  };

  const clearAll = () => {
    const empty: CashDenominationPieces = {};
    for (const denomination of CASH_DENOMINATIONS) empty[denomination] = 0;
    onChange(empty);
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor,
        },
      ]}
    >
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: textColor }]}>Cash denomination calculator</Text>
          <Text style={[styles.subtitle, { color: secondaryColor }]}>
            Enter piece counts before printing. Totals are calculated instantly and printed in the PDF.
          </Text>
        </View>
        <View style={styles.headingActions}>
          {showSuggestion ? (
            <Pressable
              onPress={applySuggestion}
              accessibilityRole="button"
              accessibilityLabel="Suggest minimum denomination pieces"
              style={({ pressed }) => [
                styles.chipButton,
                {
                  backgroundColor: isDark ? `${accentColor}24` : `${accentColor}12`,
                  borderColor: accentColor,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Ionicons name="sparkles-outline" size={14} color={accentColor} />
              <Text style={[styles.chipButtonText, { color: accentColor }]}>Suggest</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={clearAll}
            accessibilityRole="button"
            accessibilityLabel="Clear denomination piece counts"
            style={({ pressed }) => [
              styles.chipButton,
              {
                backgroundColor: rowBg,
                borderColor: isDark ? '#334155' : '#CBD5E1',
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Text style={[styles.chipButtonText, { color: secondaryColor }]}>Clear</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: rowBg, borderColor }]}>
          <Text style={[styles.summaryLabel, { color: secondaryColor }]}>Cash collections</Text>
          <Text style={[styles.summaryValue, { color: textColor }]}>{formatAmount(cashTotal)}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: rowBg, borderColor }]}>
          <Text style={[styles.summaryLabel, { color: secondaryColor }]}>Counted total</Text>
          <Text style={[styles.summaryValue, { color: textColor }]}>
            {formatAmount(breakdown.allocatedTotal)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: rowBg, borderColor }]}>
          <Text style={[styles.summaryLabel, { color: secondaryColor }]}>Difference</Text>
          <Text style={[styles.summaryValue, { color: statusColor }]}>{status.text}</Text>
        </View>
      </View>

      <View style={styles.tableHead}>
        <Text style={[styles.headCell, styles.denomCol, { color: secondaryColor }]}>Denomination</Text>
        <Text style={[styles.headCell, styles.piecesCol, { color: secondaryColor }]}>Pieces</Text>
        <Text style={[styles.headCell, styles.amountCol, { color: secondaryColor }]}>Amount</Text>
      </View>

      {breakdown.rows.map((row) => {
        const denomination = row.denomination as CashDenominationValue;
        const active = row.pieces > 0;
        return (
          <View
            key={denomination}
            style={[
              styles.tableRow,
              {
                backgroundColor: active
                  ? (isDark ? `${accentColor}18` : '#FFFBEB')
                  : rowBg,
                borderColor,
              },
            ]}
          >
            <Text style={[styles.denomLabel, styles.denomCol, { color: textColor }]}>
              {formatAmount(denomination)}
            </Text>
            <View style={[styles.piecesCol, styles.piecesControls]}>
              <Pressable
                onPress={() => bump(denomination, -1)}
                disabled={(pieces[denomination] ?? 0) <= 0}
                accessibilityLabel={`Decrease ${denomination} pieces`}
                style={({ pressed }) => [
                  styles.stepBtn,
                  {
                    borderColor: isDark ? '#475569' : '#CBD5E1',
                    backgroundColor: inputBg,
                    opacity: (pieces[denomination] ?? 0) <= 0 ? 0.4 : pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Ionicons name="remove" size={14} color={textColor} />
              </Pressable>
              <AppTextInput
                value={String(pieces[denomination] ?? 0)}
                onChangeText={(text) => {
                  const digits = text.replace(/[^\d]/g, '');
                  setPieces(denomination, digits === '' ? 0 : Number(digits));
                }}
                keyboardType="number-pad"
                selectTextOnFocus
                accessibilityLabel={`${denomination} rupee pieces`}
                style={[
                  styles.piecesInput,
                  {
                    color: textColor,
                    backgroundColor: inputBg,
                    borderColor: isDark ? '#475569' : '#CBD5E1',
                  },
                ]}
              />
              <Pressable
                onPress={() => bump(denomination, 1)}
                accessibilityLabel={`Increase ${denomination} pieces`}
                style={({ pressed }) => [
                  styles.stepBtn,
                  {
                    borderColor: isDark ? '#475569' : '#CBD5E1',
                    backgroundColor: inputBg,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Ionicons name="add" size={14} color={textColor} />
              </Pressable>
            </View>
            <Text style={[styles.amountLabel, styles.amountCol, { color: active ? accentColor : secondaryColor }]}>
              {formatAmount(row.amount)}
            </Text>
          </View>
        );
      })}

      <View style={[styles.footerRow, { borderTopColor: borderColor }]}>
        <Text style={[styles.footerLabel, { color: textColor }]}>
          Total pieces: {breakdown.rows.reduce((sum, row) => sum + row.pieces, 0)}
        </Text>
        <Text style={[styles.footerAmount, { color: accentColor }]}>
          {formatAmount(breakdown.allocatedTotal)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headingCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '800' },
  subtitle: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  headingActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  chipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  chipButtonText: { fontSize: 12, fontWeight: '800' },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryCard: {
    flexGrow: 1,
    minWidth: 120,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.2,
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: 2,
  },
  headCell: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  denomCol: { width: 78 },
  piecesCol: { flex: 1, minWidth: 140 },
  amountCol: { width: 92, textAlign: 'right' },
  denomLabel: { fontSize: 14, fontWeight: '800' },
  piecesControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepBtn: {
    width: 32,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  piecesInput: {
    width: 64,
    height: 36,
    borderWidth: 1,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 0,
  },
  amountLabel: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  footerRow: {
    borderTopWidth: 1,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerLabel: { fontSize: 13, fontWeight: '700' },
  footerAmount: { fontSize: 16, fontWeight: '800' },
});
