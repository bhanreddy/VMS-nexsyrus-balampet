import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { StaffFooterTab } from '../components/StaffFooter';

export interface LibraryDestination {
  key: string;
  title: string;
  subtitle: string;
  route: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  group: 'Library management' | 'School operations' | 'Account & access';
  tile: 'indigo' | 'forest' | 'sapphire' | 'copper' | 'plum' | 'navy' | 'teal';
  category: string;
}

export const LIBRARY_DESTINATIONS: readonly LibraryDestination[] = [
  { key: 'catalog', title: 'Books & copies', subtitle: 'Find and manage your collection', route: '/library/catalog', icon: 'library-outline', group: 'Library management', tile: 'indigo', category: 'COLLECTION' },
  { key: 'loans', title: 'Issue & return', subtitle: 'Lend, renew and return books', route: '/library/loans', icon: 'swap-horizontal-outline', group: 'Library management', tile: 'forest', category: 'LENDING' },
  { key: 'reservations', title: 'Reservations', subtitle: 'Manage the borrowing queue', route: '/library/reservations', icon: 'bookmark-outline', group: 'Library management', tile: 'copper', category: 'REQUESTS' },
  { key: 'reports', title: 'Library reports', subtitle: 'Inventory, overdue books and fines', route: '/library/reports', icon: 'bar-chart-outline', group: 'Library management', tile: 'sapphire', category: 'REPORTS' },
  { key: 'complaints', title: 'Complaints & remarks', subtitle: 'Report concerns across the school', route: '/library/complaints', icon: 'flag-outline', group: 'School operations', tile: 'plum', category: 'STUDENTS' },
  { key: 'student-login-qr', title: 'Student Login QR', subtitle: 'Generate and print student cards', route: '/library/student-login-qr', icon: 'qr-code-outline', group: 'School operations', tile: 'navy', category: 'STUDENT LOGIN' },
  { key: 'role-login-qr', title: 'Role Login QR', subtitle: 'Manage authorized role login cards', route: '/library/role-login-qr', icon: 'qr-code-outline', group: 'School operations', tile: 'teal', category: 'ROLE LOGIN' },
  { key: 'settings', title: 'Lending policy', subtitle: 'Loan limits, renewals and fines', route: '/library/settings', icon: 'options-outline', group: 'Account & access', tile: 'copper', category: 'POLICY' },
  { key: 'account-settings', title: 'Settings', subtitle: 'Profile, accounts and preferences', route: '/library/account-settings', icon: 'settings-outline', group: 'Account & access', tile: 'indigo', category: 'MY ACCOUNT' },
];

export const LIBRARY_FOOTER_TABS: readonly StaffFooterTab[] = [
  { name: 'dashboard', icon: 'grid-outline', iconFilled: 'grid', label: 'Home' },
  { name: 'catalog', icon: 'library-outline', iconFilled: 'library', label: 'Books' },
  { name: 'loans', icon: 'swap-horizontal-outline', iconFilled: 'swap-horizontal', label: 'Lending' },
  { name: 'reports', icon: 'bar-chart-outline', iconFilled: 'bar-chart', label: 'Reports' },
];

export function libraryPageTitle(route: string) {
  return route === 'dashboard' ? '' : LIBRARY_DESTINATIONS.find((item) => item.key === route)?.title || 'Library';
}
