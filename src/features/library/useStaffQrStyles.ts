import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { flatCard, flatInset, NO_DEPTH } from '../../theme/surfaceStyles';
import { schoolColorWithAlpha } from '../../constants/schoolConfig';

/** The shared QR tools keep their existing appearance outside the library. */
export function useStaffQrStyles<T extends Record<string, any>>(base: T, enabled: boolean): T {
  const { theme, isDark } = useTheme();
  return useMemo(() => {
    if (!enabled) return base;
    const colors = theme.colors;
    const accentColors = new Set(['#6D28D9', '#5B21B6', '#7C3AED', '#0F766E']);
    const textColors = new Set(['#0F172A', '#172033', '#1E293B', '#475569']);
    const surfaceKeys = new Set(['hero', 'filters', 'studentRow', 'studentCard', 'pickerCard', 'previewCard']);
    const insetKeys = new Set(['searchBox', 'filterField']);
    const buttonKeys = new Set(['outlineButton', 'iconToolbarButton', 'rowAction', 'pagerButton', 'secondaryButton', 'iconButton']);
    const primaryKeys = new Set(['primaryAction', 'primaryPreviewButton', 'heroIcon']);
    const styles: Record<string, any> = {};
    for (const [key, value] of Object.entries(base)) {
      const style = { ...StyleSheet.flatten(value), ...NO_DEPTH };
      // The printable card retains white paper and dark ink in either app theme.
      const isPaper = ['qrCardPreview', 'qrPreviewWrap', 'previewSchool', 'previewScanHint', 'previewLogo'].includes(key);
      if (!isPaper && accentColors.has(style.color)) style.color = colors.primary;
      if (!isPaper && textColors.has(style.color)) style.color = colors.textStrong;
      if (!isPaper && ['#64748B', '#94A3B8'].includes(style.color)) style.color = colors.textSecondary;
      if (surfaceKeys.has(key)) Object.assign(style, flatCard(isDark, 'sm'));
      if (insetKeys.has(key)) Object.assign(style, flatInset(isDark), { borderRadius: 14 });
      if (buttonKeys.has(key)) Object.assign(style, {
        backgroundColor: colors.card, borderColor: schoolColorWithAlpha(colors.primary, 0.2), borderRadius: 16,
      });
      if (primaryKeys.has(key)) Object.assign(style, { backgroundColor: colors.primary, borderRadius: 16 });
      styles[key] = style;
    }
    Object.assign(styles.content, { maxWidth: 1120, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 });
    Object.assign(styles.hero, { padding: 24, marginBottom: 24 });
    Object.assign(styles.heroTitle, { fontSize: 24, letterSpacing: -0.6 });
    Object.assign(styles.heroCopy, { fontSize: 14, lineHeight: 21 });
    Object.assign(styles.darkCard, { backgroundColor: colors.card, borderColor: colors.border });
    Object.assign(styles.tableHeader, { backgroundColor: colors.surface, borderRadius: 16, marginBottom: 8 });
    Object.assign(styles.studentRow, { marginBottom: 12, borderTopWidth: 1 });
    Object.assign(styles.avatar, { backgroundColor: schoolColorWithAlpha(colors.primary, 0.12) });
    Object.assign(styles.avatarText, { color: colors.primary });
    Object.assign(styles.workingBanner, { backgroundColor: schoolColorWithAlpha(colors.primary, 0.1), borderRadius: 16 });
    Object.assign(styles.pickerOptionActive, { backgroundColor: schoolColorWithAlpha(colors.primary, 0.1) });
    Object.assign(styles.busyOverlay, { backgroundColor: isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.9)' });
    return styles as T;
  }, [base, enabled, theme, isDark]);
}
