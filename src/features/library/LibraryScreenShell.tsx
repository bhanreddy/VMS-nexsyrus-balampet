import React from 'react';
import { StatusBar, View } from 'react-native';
import StaffHeader from '../../components/StaffHeader';
import { useTheme } from '../../hooks/useTheme';
import { libraryPageTitle } from '../../config/libraryNavigation';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'expo-router';
import { getHomeRouteForRole } from '../../utils/portalRoutes';

export default function LibraryScreenShell({ page, children }: { page: string; children: React.ReactNode }) {
  const { theme, isDark } = useTheme();
  const { role } = useAuth();
  const router = useRouter();
  return <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
    <StaffHeader portal="library" title={libraryPageTitle(page)} showBackButton={page !== 'dashboard'}
      onBack={page === 'dashboard' && role && role !== 'librarian' ? () => router.replace(getHomeRouteForRole(role)) : undefined} />
    {children}
  </View>;
}
