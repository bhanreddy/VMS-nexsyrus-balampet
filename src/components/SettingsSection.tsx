import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useTheme } from '../hooks/useTheme';
import { useSurfaceStyleMap } from '../theme/surfaceStyles';
import type { Theme, ThemeColors } from '../theme/themes';

export interface SettingRowProps {
  icon: string;
  iconLib?: 'ion' | 'fa5' | 'mi';
  iconColor: string;
  iconBg: string;
  label: string;
  sublabel?: string;
  isLast?: boolean;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  labelColor?: string;
}

export function SettingRow({
  icon,
  iconLib = 'ion',
  iconColor,
  iconBg,
  label,
  sublabel,
  isLast,
  rightElement,
  onPress,
  labelColor,
}: SettingRowProps) {
  const styles = useSurfaceStyleMap(baseStyles);
  const { theme, isDark } = useTheme();
  const colors = theme.colors as ThemeColors;
  const rowContent = (
    <>
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: isDark ? `${iconColor}1F` : iconBg,
            borderColor: isDark ? `${iconColor}35` : 'rgba(148,163,184,0.14)',
          },
        ]}
      >
        {iconLib === 'fa5' ? (
          <FontAwesome5 name={icon as any} size={17} color={iconColor} />
        ) : iconLib === 'mi' ? (
          <MaterialIcons name={icon as any} size={21} color={iconColor} />
        ) : (
          <Ionicons name={icon as any} size={20} color={iconColor} />
        )}
      </View>

      <View style={styles.copy}>
        <Text
          style={[
            styles.label,
            { color: labelColor ?? colors.textStrong ?? colors.text },
          ]}
        >
          {label}
        </Text>
        {!!sublabel && (
          <Text
            style={[
              styles.sublabel,
              { color: colors.textTertiary ?? colors.textSecondary },
            ]}
            numberOfLines={2}
          >
            {sublabel}
          </Text>
        )}
      </View>

      {!!rightElement && <View style={styles.right}>{rightElement}</View>}
    </>
  );

  return (
    <>
      {onPress ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={label}
          activeOpacity={0.68}
          onPress={onPress}
          style={styles.row}
        >
          {rowContent}
        </TouchableOpacity>
      ) : (
        <View style={styles.row}>{rowContent}</View>
      )}
      {!isLast && (
        <View
          style={[
            styles.divider,
            { backgroundColor: colors.borderLight ?? colors.border },
          ]}
        />
      )}
    </>
  );
}

export interface SettingsGroupProps {
  title: string;
  subtitle?: string;
  delay: number;
  borderColor?: string;
  children: React.ReactNode;
  /** Accepted for backwards compatibility; the current theme is read directly. */
  colors?: ThemeColors;
  /** Accepted for backwards compatibility; the current theme is read directly. */
  theme?: Theme;
}

export function SettingsGroup({
  title,
  subtitle,
  delay,
  borderColor,
  children,
}: SettingsGroupProps) {
  const styles = useSurfaceStyleMap(baseStyles);
  const { theme, isDark } = useTheme();
  const colors = theme.colors as ThemeColors;

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(420)}
      style={styles.group}
    >
      <View style={styles.sectionHeading}>
        <View
          style={[
            styles.sectionDot,
            { backgroundColor: borderColor ? '#EF4444' : theme.colors.primary },
          ]}
        />
        <View style={styles.sectionCopy}>
          <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={[styles.sectionSubtitle, { color: colors.textTertiary }]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor:
              borderColor ??
              (isDark ? colors.border : colors.borderLight ?? colors.border),
          },
          borderColor && {
            backgroundColor: isDark ? 'rgba(127,29,29,0.14)' : colors.card,
          },
        ]}
      >
        {children}
      </View>
    </Animated.View>
  );
}

const baseStyles = StyleSheet.create({
  group: {
    marginBottom: 24,
  },
  sectionHeading: {
    minHeight: 22,
    marginBottom: 9,
    marginLeft: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  sectionCopy: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.45,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 11.5,
    lineHeight: 15,
  },
  card: {
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  row: {
    minHeight: 70,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  label: {
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: -0.15,
  },
  sublabel: {
    marginTop: 2,
    fontSize: 12.25,
    lineHeight: 16,
    fontWeight: '500',
  },
  right: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 72,
    marginRight: 14,
  },
});
