import React from 'react';
import type { MaterialTopTabNavigationOptions } from '@react-navigation/material-top-tabs';
import { MaterialTopTabs } from '../../src/layouts/MaterialTopTabs';
import StaffFooter from '../../src/components/StaffFooter';
import { useRequireRole } from '../../src/hooks/useRequireRole';
import { LIBRARY_FOOTER_TABS } from '../../src/config/libraryNavigation';
import LibraryAppearanceProvider from '../../src/features/library/LibraryAppearanceProvider';
export { ErrorBoundary } from '../../src/components/ErrorBoundary';

const tabOptions: MaterialTopTabNavigationOptions & { headerShown: boolean } = {
  swipeEnabled: false, animationEnabled: true, lazy: true, headerShown: false,
};

export default function LibraryLayout() {
  useRequireRole('librarian', 'admin', 'principal');
  return <LibraryAppearanceProvider><MaterialTopTabs
    initialRouteName="dashboard"
    tabBarPosition="bottom"
    tabBar={(props) => <StaffFooter {...props} tabs={LIBRARY_FOOTER_TABS} preserveStaffContext={false} />}
    screenOptions={tabOptions}
  >
    <MaterialTopTabs.Screen name="dashboard" options={{ title: 'Home' }} />
    <MaterialTopTabs.Screen name="catalog" options={{ title: 'Books' }} />
    <MaterialTopTabs.Screen name="loans" options={{ title: 'Lending' }} />
    <MaterialTopTabs.Screen name="reports" options={{ title: 'Reports' }} />
    <MaterialTopTabs.Screen name="reservations" options={{ title: 'Reservations' }} />
    <MaterialTopTabs.Screen name="complaints" options={{ title: 'Complaints' }} />
    <MaterialTopTabs.Screen name="role-login-qr" options={{ title: 'Role Login QR' }} />
    <MaterialTopTabs.Screen name="student-login-qr" options={{ title: 'Student Login QR' }} />
    <MaterialTopTabs.Screen name="settings" options={{ title: 'Lending policy' }} />
    <MaterialTopTabs.Screen name="account-settings" options={{ title: 'Settings' }} />
    <MaterialTopTabs.Screen name="index" options={{ title: 'Library' }} />
  </MaterialTopTabs></LibraryAppearanceProvider>;
}
