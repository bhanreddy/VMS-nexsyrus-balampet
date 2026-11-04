import React from 'react';
import { useNavigation, useRouter } from 'expo-router';
import MenuOverlay from './MenuOverlay';
import { getStaffDestinations } from '../config/staffNavigation';
import { useStaffPortalConfig } from '../hooks/useStaffPortalConfig';
import { useEffectiveStaffId } from '../hooks/useEffectiveStaffId';
import { LIBRARY_DESTINATIONS } from '../config/libraryNavigation';

const GROUP_ACCENT: Record<string, string> = {
  Teaching: '#4F46E5',
  Communication: '#7C3AED',
  'School operations': '#0F766E',
  'My employment': '#B45309',
};

/** Mounted only while open, so secondary tools do not fetch on every header mount. */
interface Props { onClose: () => void; photoUrl?: string | null; portal?: 'staff' | 'library' }
export default function StaffToolsDrawer(props: Props) {
  return props.portal === 'library' ? <LibraryToolsDrawer {...props} /> : <TeachingToolsDrawer {...props} />;
}

function LibraryToolsDrawer({ onClose, photoUrl }: Props) {
  const navigation = useNavigation();
  return <MenuOverlay visible userType="staff" roleLabel="Librarian" photoUrl={photoUrl} onClose={onClose}
    profileRoute="/library/account-settings" searchLabel="Search librarian tools"
    menuItems={LIBRARY_DESTINATIONS.map((item) => ({
      key: item.key, label: item.title, hint: item.subtitle, icon: item.icon,
      link: item.route, group: item.group,
      accent: item.group === 'Library management' ? '#4F46E5' : item.group === 'School operations' ? '#0F766E' : '#B45309',
    }))}
    onNavigate={(route) => (navigation as any).navigate(route.slice('/library/'.length))}
  />;
}

function TeachingToolsDrawer({ onClose, photoUrl }: Props) {
  const { payslipsEnabled, loading } = useStaffPortalConfig();
  const navigation = useNavigation();
  const router = useRouter();
  const { staffId, isViewingAsAdmin, viewAsName, userId, actorUserId } = useEffectiveStaffId();
  return <MenuOverlay
    visible
    userType="staff"
    photoUrl={photoUrl}
    onClose={onClose}
    menuItems={getStaffDestinations(!loading && payslipsEnabled).map(item => ({
      key: item.key, label: item.title, hint: item.subtitle, icon: item.icon, link: item.route, group: item.group,
      accent: GROUP_ACCENT[item.group],
    }))}
    onNavigate={route => {
      if (!route.startsWith('/staff/')) { router.push(route as any); return; }
      // Use the staff pager, matching Home and the footer, and retain view-as context.
      (navigation as any).navigate(route.slice('/staff/'.length), isViewingAsAdmin
        ? { staffId, viewAsName, viewAsUserId: userId, viewAsActorId: actorUserId }
        : undefined);
    }}
  />;
}
