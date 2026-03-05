import { Stack } from 'expo-router';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import '../src/i18n';
import { AuthProvider } from '../src/hooks/useAuth';
import { ThemeProvider, ThemeContext } from '../src/context/ThemeContext';
import { ThemeProvider as NavThemeProvider, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useContext } from 'react';

import { useNotifications } from '../src/hooks/useNotifications';
import { useAuthGuard } from '../src/hooks/useAuthGuard';
import { useNotificationObserver } from '../src/hooks/useNotificationObserver';
import { AuthGate } from '../src/components/AuthGate';
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Ensure Expo shows heads-up notifications even when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

// Register background handler early outside the React lifecycle
// This handler runs when an FCM data-only message arrives while the app is in background/killed.
// It must display the notification with the correct channel (custom sound) and full data.
if (Platform.OS !== 'web') {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {

    // Import dynamically to avoid issues with module init order
    const { notificationManager } = require('../src/services/notificationManager');

    // displayNotification handles:
    // 1. Deduplication (via messageId in AsyncStorage)
    // 2. Phantom message filtering (empty data + sentTime=0)
    // 3. Displaying with correct channel (custom sound)
    // 4. Client-side Telugu translation
    // 5. Preserving full data payload for deep linking
    await notificationManager.displayNotification(remoteMessage, 'background');
  });
}

import { useFonts } from 'expo-font';
import { FontAwesome5 } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const [loaded, error] = useFonts({
    ...FontAwesome5.font
  });

  // One-time cleanup of stale ML Kit translation cache (remove after one release)
  useEffect(() => {
    const clearOldCache = async () => {
      const keys = await AsyncStorage.getAllKeys();
      const stale = keys.filter((k) => k.startsWith('mlkit_tx_') || k.startsWith('tx_cache_'));
      if (stale.length > 0) await AsyncStorage.multiRemove(stale);
    };
    clearOldCache();
  }, []);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <AuthProvider>
      <ThemeProvider>
        <ThemeSyncWrapper />
      </ThemeProvider>
    </AuthProvider>);

}

function ThemeSyncWrapper() {
  const { theme, isDark } = useContext(ThemeContext);

  // Convert our custom theme to React Navigation theme format
  const baseNavTheme = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...baseNavTheme,
    dark: isDark,
    colors: {
      ...baseNavTheme.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.card,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.notification
    }
  };

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={theme.colors.background} />
      <ErrorBoundary>
        <AuthGate>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: theme.colors.background }
            }} />

        </AuthGate>
      </ErrorBoundary>
      {/* Auth guard and hooks run AFTER the Stack navigator has mounted */}
      <NavigationReady />

      {/* Global Animated Splash Screen Overlay removed - now native AnimatedSplash handles this */}
    </NavThemeProvider>);

}

/**
 * This component runs hooks that depend on React Navigation being fully mounted.
 * It must render AFTER the Stack navigator, not before.
 * Renders nothing visually.
 */
function NavigationReady() {
  useAuthGuard();
  useNotifications();
  useNotificationObserver();
  return null;
}