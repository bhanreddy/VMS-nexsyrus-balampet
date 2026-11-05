/* eslint-disable import/first, @typescript-eslint/no-require-imports */
jest.mock('expo-router', () => {
  const Stack = ({ children }: any) => children;
  Stack.Screen = function Screen() { return null; };
  return { Stack };
});
jest.mock('expo-font', () => ({ useFonts: jest.fn(() => [false, null]) }));
jest.mock('@expo/vector-icons', () => ({ FontAwesome5: { font: {} } }));
jest.mock('react-native-keyboard-controller', () => ({ KeyboardProvider: ({ children }: any) => children }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@react-navigation/native', () => ({
  ThemeProvider: ({ children }: any) => children, DefaultTheme: { colors: {} }, DarkTheme: { colors: {} },
}));
jest.mock('../components/CustomAlert', () => ({ CustomAlertProvider: ({ children }: any) => children, ensurePortalRoot: jest.fn() }));
jest.mock('../constants/school', () => ({ validateBuildConfig: jest.fn() }));
jest.mock('../i18n', () => ({}));
jest.mock('../hooks/useAuth', () => ({
  AuthProvider: ({ children }: any) => children,
  useAuth: () => ({ user: null, authChecked: true, loading: false }),
}));
jest.mock('../hooks/useNotifications', () => ({ useNotifications: jest.fn() }));
jest.mock('../hooks/useAuthGuard', () => ({ useAuthGuard: jest.fn() }));
jest.mock('../hooks/useNotificationObserver', () => ({ useNotificationObserver: jest.fn() }));
jest.mock('../hooks/useAdminScreenUsage', () => ({ useAdminScreenUsage: jest.fn() }));
jest.mock('../components/AuthGate', () => ({ AuthGate: ({ children }: any) => children }));
jest.mock('../components/FingerprintLockGate', () => () => null);
jest.mock('../components/SchoolRibbon', () => ({
  __esModule: true, default: () => null, MOBILE_RIBBON_CONTENT_HEIGHT: 48,
  SCHOOL_RIBBON_OVERLAP: 8, WEB_DESKTOP_RIBBON_MIN_WIDTH: 900,
}));
jest.mock('../hooks/useSchoolHeader', () => ({ useSchoolHeader: jest.fn() }));
jest.mock('../services/notificationManager', () => ({ notificationManager: { createChannels: jest.fn(async () => {}) } }));
jest.mock('../services/driverLocationTask', () => ({}));
jest.mock('../hooks/useVersionCheck', () => ({ useVersionCheck: jest.fn(() => ({ updateRequired: false })) }));
jest.mock('../hooks/usePlayStoreUpdate', () => ({ usePlayStoreUpdate: jest.fn(() => ({})) }));
jest.mock('../components/ForceUpdateScreen', () => () => null);
jest.mock('../components/AppUpdateBanner', () => () => null);
jest.mock('../components/FestivalPosterGate', () => () => null);
jest.mock('../features/popups/components/PopupQueueProvider', () => () => null);
jest.mock('../features/app-tour', () => ({ TourProvider: ({ children }: any) => children, TourOverlayHost: () => null }));
jest.mock('../components/CustomToast', () => ({ toastConfig: {} }));
jest.mock('react-native-toast-message', () => () => null);

import React from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import Layout, { ErrorBoundary } from '../../app/_layout';
import { AuthProvider } from '../hooks/useAuth';
import AppStartupScreen from '../components/AppStartupScreen';
import RouteErrorBoundary from '../components/RouteErrorBoundary';
const renderer = require('react-test-renderer');
const { act } = renderer;
let root: any;

beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); (useFonts as jest.Mock).mockReturnValue([false, null]); });
afterEach(async () => { await act(async () => { root?.unmount(); }); root = undefined; jest.useRealTimers(); jest.restoreAllMocks(); });

it('shows native loading content before dismissing the splash screen', async () => {
  const hide = jest.spyOn(SplashScreen, 'hideAsync').mockResolvedValue(undefined);
  await act(async () => { root = renderer.create(<Layout />); });
  const startup = root.root.findByType(AppStartupScreen);
  expect(hide).not.toHaveBeenCalled();
  await act(async () => { startup.props.onLayout(); });
  expect(hide).toHaveBeenCalled();
});

it('mounts the app when icon font loading never settles', async () => {
  await act(async () => { root = renderer.create(<Layout />); });
  expect(root.root.findAllByType(AuthProvider)).toHaveLength(0);
  await act(async () => { jest.advanceTimersByTime(3000); });
  expect(root.root.findAllByType(AuthProvider)).toHaveLength(1);
});

it('mounts immediately when font loading fails', async () => {
  (useFonts as jest.Mock).mockReturnValue([false, new Error('asset unavailable')]);
  await act(async () => { root = renderer.create(<Layout />); });
  expect(root.root.findAllByType(AuthProvider)).toHaveLength(1);
});

it('exports the Expo Router error-prop fallback from the root layout', () => {
  expect(ErrorBoundary).toBe(RouteErrorBoundary);
});
