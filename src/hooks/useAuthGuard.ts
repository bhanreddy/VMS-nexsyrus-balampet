import { useEffect } from 'react';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { useAuth } from './useAuth';

// List of public routes that don't require authentication
// Note: '/' is the 4-login-options index page.
// 'login', 'staff-login' etc are specific login forms.
const PUBLIC_ROUTES = ['welcome', 'login', 'signup', 'staff-login', 'admin-login', 'accounts-login', 'driver-login'];

export function useAuthGuard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (!rootNavigationState?.key) return; // Wait until router is ready

    if (__DEV__) {}
    if (loading) return;

    const currentSegment = segments[0] as string || 'index';

    // Check if we are in a public route group
    const inAuthGroup = PUBLIC_ROUTES.includes(currentSegment);

    // Check specific groups
    const inTabsGroup = segments[0] === '(tabs)';
    const inAdminGroup = segments[0] === 'admin';
    const inStaffGroup = segments[0] === 'staff';
    const inAccountsGroup = segments[0] === 'accounts';
    const inDriverGroup = segments[0] === 'driver';

    // 1. User IS logged in
    if (user) {
      // Strictly prevent loop if already on the correct dashboard
      const homeRoute = getHomeRoute(user.role);
      const normalizedHome = homeRoute.replace(/^\//, '');

      // Check if current route matches home route to avoid infinite replacement
      // Check if current route matches home route to avoid infinite replacement
      const currentRoute = segments.join('/');

      // debug logs
      if (__DEV__) {}

      // If they are on a route matching their home dashboard strictly, we're fine.
      // But we don't want to return early if they are deeper in the route, we just want to ensure
      // they aren't on another role's route.
      if (currentRoute === normalizedHome) {
        // we're safely on home.
        return;
      }

      // Strict Segment Guarding for Role Based Access
      if (inAdminGroup && user.role !== 'admin') {
        router.replace(homeRoute);
        return;
      }

      if (inStaffGroup && !['staff', 'teacher'].includes(user.role)) {
        router.replace(homeRoute);
        return;
      }

      if (inAccountsGroup && user.role !== 'accountant') {
        router.replace(homeRoute);
        return;
      }

      if (inDriverGroup && user.role !== 'driver') {
        router.replace(homeRoute);
        return;
      }

      if (inTabsGroup && user.role !== 'student') {
        router.replace(homeRoute);
        return;
      }

      // We do NOT want to force the user to `homeRoute` if they are deeper in a valid protected group.
      // That breaks deep linking from notifications.

      // Only redirect to home if they are explicitly sitting on an auth/public screen 
      // We ignore `currentRoute === ''` to allow AnimatedSplash to finish animating.
      if (inAuthGroup) {
        if (__DEV__) {}
        router.replace(homeRoute);
      }

      // CHECK FOR MISSING PROFILES (Safety Net)
      // If user is stuck in a role that requires a profile they don't have
      if (user.role === 'student' && user.has_student_profile === false) {
        router.replace('/no-profile');
      } else if ((user.role === 'staff' || user.role === 'teacher') && user.has_staff_profile === false) {
        router.replace('/no-profile');
      }

    } else {
      // 2. User is NOT logged in
      // If trying to access protected areas, redirect to login
      if (inTabsGroup || inAdminGroup || inStaffGroup || inAccountsGroup || inDriverGroup) {
        if (__DEV__) {}
        // Check if we are already engaging with a login flow to avoid fighting
        // But generally, if we're in a protected group and not logged in, we MUST go to root.
        router.replace('/welcome');
      } else {
        if (__DEV__) {}
      }
    }

  }, [user, loading, segments, rootNavigationState?.key]);
}

const getHomeRoute = (role: string) => {
  switch (role) {
    case 'admin':return '/admin/dashboard';
    case 'accountant':return '/accounts/dashboard';
    case 'staff':
    case 'teacher':return '/staff/dashboard';
    case 'driver':return '/driver/dashboard';
    default:return '/(tabs)/home';
  }
};