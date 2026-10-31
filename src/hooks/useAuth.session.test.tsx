/* eslint-disable import/first, @typescript-eslint/no-require-imports */
jest.mock('../services/driverLocationTask', () => ({ stopDriverLocationUpdates: jest.fn(async () => {}), reconcileDriverTracking: jest.fn(async () => {}) }));
jest.mock('../services/supabaseConfig', () => ({ supabase: { auth: {
  startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn(), onAuthStateChange: jest.fn(),
} } }));
jest.mock('../services/authService', () => ({ AuthService: {
  switchAccount: jest.fn(), getSession: jest.fn(), getStoredSession: jest.fn(), restorePersistedSession: jest.fn(),
  refreshSession: jest.fn(), adoptRefreshedSession: jest.fn(), signOut: jest.fn(async () => {}),
}, isInternalSessionSwap: jest.fn(() => false) }));
jest.mock('../constants/school', () => ({ SCHOOL_ID: 12 }));
jest.mock('../services/apiClient', () => ({ suppressTransientApiAlerts: jest.fn() }));
jest.mock('../services/secureTokenStore', () => ({ clearBackupRefreshToken: jest.fn() }));
jest.mock('../services/fingerprintGate', () => ({ requireFingerprintForVaultAccount: jest.fn() }));
jest.mock('../services/biometricService', () => ({ clearFingerprintTickets: jest.fn() }));
jest.mock('../services/sessionPolicyService', () => ({ SessionPolicy: { getStoredRole: jest.fn(async () => 'staff'), startSession: jest.fn() } }));
jest.mock('../services/notificationManager', () => ({ notificationManager: { unregisterPushToken: jest.fn(), fanOutRegister: jest.fn() } }));
jest.mock('../services/featuresStore', () => ({ fetchFeatures: jest.fn(async () => {}), resetFeatures: jest.fn(async () => {}) }));
jest.mock('../services/accountVault', () => ({ removeAccount: jest.fn() }));
jest.mock('./useApiQuery', () => ({ invalidateApiQueryCache: jest.fn() }));
jest.mock('../services/persistentQueryCache', () => ({ persistentQueryCache: { removeMatching: jest.fn(async () => {}) } }));
jest.mock('../services/storageService', () => ({ StorageService: { clear: jest.fn() } }));
jest.mock('../services/contextService', () => ({ fetchPortalContexts: jest.fn(), switchPortalContext: jest.fn() }));
jest.mock('../services/activeContextStore', () => ({ clearActiveContextStore: jest.fn(async () => {}), getCachedPortalContexts: jest.fn(async () => null) }));

import React from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { AuthProvider, useAuth } from './useAuth';
import { AuthService } from '../services/authService';
import { supabase } from '../services/supabaseConfig';
import { stopDriverLocationUpdates } from '../services/driverLocationTask';
import { requireFingerprintForVaultAccount } from '../services/fingerprintGate';
import { SessionPolicy } from '../services/sessionPolicyService';
const renderer = require('react-test-renderer');
const { act } = renderer;

const saved = {
  supabaseSession: { access_token: 'access', refresh_token: 'refresh', expires_at: Date.now() / 1000 + 3600, user: { id: 'staff-1' } },
  validatedUser: { userId: 'staff-1', schoolId: 12, role: { code: 'staff' } },
  tokenExpiresAt: Date.now() + 3600000,
};
let context: ReturnType<typeof useAuth>;
let authEvent: (event: string, session?: unknown) => unknown;
let appStateEvent: (state: AppStateStatus) => void;
let root: { unmount: () => void } | undefined;
const unsubscribe = jest.fn();
function Probe() { context = useAuth(); return null; }
async function mount() {
  await act(async () => { root = renderer.create(<AuthProvider><Probe /></AuthProvider>); });
}
async function tick(ms = 0) {
  await act(async () => { jest.advanceTimersByTime(ms); });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (stopDriverLocationUpdates as jest.Mock).mockResolvedValue(undefined);
  (SessionPolicy.startSession as jest.Mock).mockResolvedValue(undefined);
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    appStateEvent = callback;
    return { remove: jest.fn() };
  });
  (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
    authEvent = callback;
    return { data: { subscription: { unsubscribe } } };
  });
  (AuthService.getSession as jest.Mock).mockResolvedValue(saved);
  (AuthService.getStoredSession as jest.Mock).mockResolvedValue(saved);
  (AuthService.restorePersistedSession as jest.Mock).mockResolvedValue(saved);
  (AuthService.refreshSession as jest.Mock).mockResolvedValue(saved);
  (AuthService.adoptRefreshedSession as jest.Mock).mockResolvedValue(saved);
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = undefined;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('defers refresh-event persistence until Supabase has released its auth lock', async () => {
  await mount();
  expect(authEvent('TOKEN_REFRESHED', saved.supabaseSession)).toBeUndefined();
  expect(AuthService.adoptRefreshedSession).not.toHaveBeenCalled();
  await tick();
  expect(AuthService.adoptRefreshedSession).toHaveBeenCalledWith(saved.supabaseSession);
  expect(context.user?.userId).toBe('staff-1');
});

it('preserves the remembered login when the SDK rejects its refresh token', async () => {
  await mount();
  expect(authEvent('SIGNED_OUT')).toBeUndefined();
  expect(AuthService.getStoredSession).not.toHaveBeenCalled();
  await tick();
  expect(context.user?.userId).toBe('staff-1');
  expect(AuthService.refreshSession).toHaveBeenCalledWith({ force: false });
  expect(AuthService.signOut).not.toHaveBeenCalled();
});

it('keeps the boot gate and retries when secure storage is temporarily locked', async () => {
  (AuthService.getSession as jest.Mock).mockRejectedValueOnce(new Error('keychain locked'));
  await mount();
  expect(context.authChecked).toBe(false);
  expect(context.loading).toBe(true);
  await tick(2000);
  expect(context.authChecked).toBe(true);
  expect(context.user?.userId).toBe('staff-1');
});

it('does not rotate a healthy session on every native foreground transition', async () => {
  await mount();
  await act(async () => { appStateEvent('active'); });
  expect(AuthService.refreshSession).toHaveBeenCalledWith({ force: false });
});

it('does not let a queued auth event restore an explicitly logged-out account', async () => {
  await mount();
  authEvent('SIGNED_OUT');
  await act(async () => { await context.signOutKeepAccount(); });
  await tick();
  expect(context.user).toBeNull();
  expect(AuthService.getStoredSession).not.toHaveBeenCalled();
  expect(AuthService.refreshSession).not.toHaveBeenCalled();
});

it('cancels deferred auth work when the provider unmounts', async () => {
  await mount();
  authEvent('TOKEN_REFRESHED', saved.supabaseSession);
  await act(async () => { root?.unmount(); });
  root = undefined;
  await tick();
  expect(AuthService.adoptRefreshedSession).not.toHaveBeenCalled();
  expect(unsubscribe).toHaveBeenCalled();
});


it('switches non-driver accounts without waiting for GPS cleanup or diagnostic writes', async () => {
  await mount();
  const target = { ...saved, validatedUser: { ...saved.validatedUser, userId: 'staff-2' } };
  (requireFingerprintForVaultAccount as jest.Mock).mockResolvedValue({ allowed: true });
  (AuthService.switchAccount as jest.Mock).mockResolvedValue({ session: target });
  (stopDriverLocationUpdates as jest.Mock).mockClear().mockReturnValue(new Promise(() => {}));
  (SessionPolicy.startSession as jest.Mock).mockReturnValue(new Promise(() => {}));
  let completed = false;
  await act(async () => {
    void context.switchAccount('staff-2').then(() => { completed = true; });
  });
  expect(completed).toBe(true);
  expect(context.user?.userId).toBe('staff-2');
  expect(context.loading).toBe(false);
  // The tracking effect still cleans up in the background after the switch.
  expect(stopDriverLocationUpdates).toHaveBeenCalledTimes(1);
});

it('waits for driver tracking to stop before changing the live account', async () => {
  const driver = { ...saved, validatedUser: { ...saved.validatedUser, role: { code: 'driver' } } };
  (AuthService.getSession as jest.Mock).mockResolvedValue(driver);
  (AuthService.restorePersistedSession as jest.Mock).mockResolvedValue(driver);
  await mount();
  (requireFingerprintForVaultAccount as jest.Mock).mockResolvedValue({ allowed: true });
  let stop!: () => void;
  (stopDriverLocationUpdates as jest.Mock).mockReturnValue(new Promise<void>((resolve) => { stop = resolve; }));
  (AuthService.switchAccount as jest.Mock).mockResolvedValue({ session: saved });
  let switching: ReturnType<typeof context.switchAccount>;
  await act(async () => { switching = context.switchAccount('staff-1'); });
  expect(AuthService.switchAccount).not.toHaveBeenCalled();
  await act(async () => { stop(); await switching; });
  expect(AuthService.switchAccount).toHaveBeenCalledWith('staff-1');
});
