import React, { useEffect, useContext, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import LogoLoader from '../src/components/LogoLoader';
import { ThemeContext } from '../src/context/ThemeContext';
import { useAuth } from '../src/hooks/useAuth';

const getHomeRoute = (role: string) => {
  switch (role) {
    case 'admin': return '/admin/dashboard';
    case 'accountant': return '/accounts/dashboard';
    case 'staff':
    case 'teacher': return '/staff/dashboard';
    case 'driver': return '/driver/dashboard';
    default: return '/(tabs)/home';
  }
};

export default function AnimatedSplash() {
  const router = useRouter();
  const { theme, isDark } = useContext(ThemeContext);
  const { user, loading } = useAuth();

  // We want the splash to wait exactly 4.2 seconds from mount.
  const isTimeUp = useRef(false);
  const hasNavigated = useRef(false);

  // Re-check conditions whenever auth changes or time is up
  const attemptNavigation = () => {
    if (isTimeUp.current && !loading && !hasNavigated.current) {
      hasNavigated.current = true;
      if (user) {
        // Also observe profiles as AuthGuard does
        if (user.role === 'student' && user.has_student_profile === false) {
          router.replace('/no-profile');
        } else if ((user.role === 'staff' || user.role === 'teacher') && user.has_staff_profile === false) {
          router.replace('/no-profile');
        } else {
          router.replace(getHomeRoute(user.role));
        }
      } else {
        router.replace('/welcome');
      }
    }
  };

  useEffect(() => {
    // Play the animation 2-3 loops (around 4.2 seconds matches previous overlay)
    const timer = setTimeout(() => {
      isTimeUp.current = true;
      attemptNavigation();
    }, 4200);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    attemptNavigation();
  }, [loading, user]);

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: theme.colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        }
      ]}
    >
      <LogoLoader size={160} color={isDark ? '#FFFFFF' : '#000000'} />
    </View>
  );
}
