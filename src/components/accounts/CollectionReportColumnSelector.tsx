import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  COLLECTION_REPORT_COLUMNS,
  type CollectionReportColumnKey,
} from '../../utils/collectionReport';

interface CollectionReportColumnSelectorProps {
  columns: readonly CollectionReportColumnKey[];
  hydrated: boolean;
  isDark: boolean;
  onToggle: (key: CollectionReportColumnKey) => void | Promise<void>;
  saveError?: string | null;
  accentColor?: string;
  title?: string;
  description?: string;
  embedded?: boolean;
  includeDenominations?: boolean;
  denominationsHydrated?: boolean;
  onToggleDenominations?: () => void | Promise<void>;
}

export default function CollectionReportColumnSelector({
  columns,
  hydrated,
  isDark,
  onToggle,
  saveError,
  accentColor = '#0D9488',
  title = 'PDF & CSV columns',
  description = 'Enable columns in print order; turn one off and on to move it to the end. Saved automatically.',
  embedded = false,
  includeDenominations = false,
  denominationsHydrated = true,
  onToggleDenominations,
}: CollectionReportColumnSelectorProps) {
  const textColor = isDark ? '#F8FAFC' : '#0F172A';
  const secondaryColor = isDark ? '#94A3B8' : '#64748B';
  const orderedDefinitions = [
    ...columns.map((key) => COLLECTION_REPORT_COLUMNS.find((column) => column.key === key)!),
    ...COLLECTION_REPORT_COLUMNS.filter((column) => !columns.includes(column.key)),
  ];

  return (
    <View
      style={[
        embedded ? styles.embedded : styles.card,
        embedded ? { borderTopColor: isDark ? '#334155' : '#E2E8F0' } : {
          backgroundColor: isDark ? '#18212F' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.09)' : '#D9E2EC',
        },
      ]}
    >
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: textColor }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: secondaryColor }]}>{description}</Text>
        </View>
        {!hydrated ? <ActivityIndicator size="small" color={accentColor} /> : (
          <Text style={[styles.count, { color: secondaryColor }]}>{columns.length}/{COLLECTION_REPORT_COLUMNS.length}</Text>
        )}
      </View>

      <View style={styles.options}>
        {orderedDefinitions.map((column) => {
          const enabled = columns.includes(column.key);
          const order = enabled ? columns.indexOf(column.key) + 1 : null;
          const isOnlyColumn = enabled && columns.length === 1;
          return (
            <Pressable
              key={column.key}
              disabled={!hydrated || isOnlyColumn}
              onPress={() => onToggle(column.key)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: enabled, disabled: !hydrated || isOnlyColumn }}
              accessibilityLabel={`${column.label} report column`}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: enabled
                    ? (isDark ? `${accentColor}24` : `${accentColor}12`)
                    : (isDark ? '#111827' : '#F8FAFC'),
                  borderColor: enabled ? accentColor : (isDark ? '#334155' : '#CBD5E1'),
                  opacity: !hydrated ? 0.55 : pressed ? 0.75 : 1,
                },
                Platform.OS === 'web' && ({ cursor: isOnlyColumn ? 'not-allowed' : 'pointer' } as any),
              ]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: enabled ? accentColor : 'transparent',
                    borderColor: enabled ? accentColor : secondaryColor,
                  },
                ]}
              >
                {enabled ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <Text style={[styles.optionText, { color: enabled ? textColor : secondaryColor }]}>{column.label}</Text>
              {order ? (
                <View style={[styles.orderBadge, { backgroundColor: accentColor }]}>
                  <Text style={styles.orderText}>{order}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {onToggleDenominations ? (
        <Pressable
          disabled={!denominationsHydrated}
          onPress={onToggleDenominations}
          accessibilityRole="switch"
          accessibilityState={{ checked: includeDenominations, disabled: !denominationsHydrated }}
          accessibilityLabel="Include cash denomination calculation in PDF"
          style={({ pressed }) => [
            styles.denominationRow,
            { borderTopColor: isDark ? '#334155' : '#E2E8F0', opacity: pressed ? 0.75 : 1 },
            Platform.OS === 'web' && ({ cursor: denominationsHydrated ? 'pointer' : 'not-allowed' } as any),
          ]}
        >
          <View style={styles.denominationCopy}>
            <Text style={[styles.denominationTitle, { color: textColor }]}>Cash denomination summary</Text>
            <Text style={[styles.denominationDescription, { color: secondaryColor }]}>
              Asks for manual note and coin counts before print, then includes the cash breakup and match totals in the PDF.
            </Text>
          </View>
          {!denominationsHydrated ? <ActivityIndicator size="small" color={accentColor} /> : (
            <View
              style={[
                styles.switchTrack,
                { backgroundColor: includeDenominations ? accentColor : (isDark ? '#475569' : '#CBD5E1') },
              ]}
            >
              <View style={[styles.switchThumb, includeDenominations && styles.switchThumbOn]} />
            </View>
          )}
        </Pressable>
      ) : null}

      {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  embedded: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 13,
  },
  headingCopy: { flex: 1 },
  title: { fontSize: 15, fontWeight: '800' },
  subtitle: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  count: { fontSize: 11, fontWeight: '700' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', lineHeight: 13 },
  optionText: { fontSize: 12, fontWeight: '600' },
  orderBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  denominationRow: {
    borderTopWidth: 1,
    marginTop: 15,
    paddingTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  denominationCopy: { flex: 1 },
  denominationTitle: { fontSize: 13, fontWeight: '800' },
  denominationDescription: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  switchThumbOn: { alignSelf: 'flex-end' },
  error: { color: '#DC2626', fontSize: 11, lineHeight: 16, marginTop: 10 },
});
