import React, { useMemo } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import { useTheme } from '../../hooks/useTheme';
import { FlatSurfaceContext } from '../../contexts/SurfaceAppearanceContext';
import { NO_DEPTH } from '../../theme/surfaceStyles';

export default function LibraryAppearanceProvider({ children }: { children: React.ReactNode }) {
  const inherited = useTheme();
  const { isDark } = inherited;
  const theme = useMemo(() => ({
    ...inherited.theme,
    colors: {
      ...inherited.theme.colors,
      background: isDark ? '#0D1220' : '#F6F7FB', card: isDark ? '#151D2D' : '#FFFFFF',
      surface: isDark ? '#1D273A' : '#F8F9FC', border: isDark ? '#293449' : '#EAECF2',
      borderLight: isDark ? '#293449' : '#EAECF2',
      text: isDark ? '#F1F5F9' : '#101828', textStrong: isDark ? '#F1F5F9' : '#101828',
      textSecondary: isDark ? '#B0BCD0' : '#596479', textMuted: isDark ? '#B0BCD0' : '#596479',
      primary: '#4F46E5', primaryLight: '#818CF8', primaryDark: '#4338CA',
      headerBg: isDark ? '#151D2D' : '#FFFFFF', footerBg: isDark ? '#151D2D' : '#FFFFFF',
    },
    shadows: { none: NO_DEPTH, sm: NO_DEPTH, md: NO_DEPTH, lg: NO_DEPTH },
  }), [inherited.theme, isDark]);
  return <FlatSurfaceContext.Provider value><ThemeContext.Provider value={{ ...inherited, theme }}>{children}</ThemeContext.Provider></FlatSurfaceContext.Provider>;
}
