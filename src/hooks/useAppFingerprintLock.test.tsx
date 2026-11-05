/* eslint-disable import/first, @typescript-eslint/no-require-imports */
jest.mock('./useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('../constants/school', () => ({ SCHOOL_ID: 12 }));
jest.mock('../services/biometricService', () => ({
  getFingerprintOptInState: jest.fn(),
  isFingerprintPlatformSupported: jest.fn(() => true),
  verifyFingerprintForAccount: jest.fn(),
}));
jest.mock('../services/fingerprintGate', () => ({
  describeFingerprintFailure: jest.fn((reason) => reason),
  getFingerprintPromptCopy: jest.fn(() => ({})),
}));

import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from './useAuth';
import { useAppFingerprintLock } from './useAppFingerprintLock';
import { getFingerprintOptInState, verifyFingerprintForAccount } from '../services/biometricService';
const renderer = require('react-test-renderer');
const { act } = renderer;

let lock: ReturnType<typeof useAppFingerprintLock>;
let appStateEvent: (state: AppStateStatus) => void;
let root: { unmount: () => void; update: (element: React.ReactElement) => void } | undefined;
const auth = { user: { userId: 'staff-1', role: { code: 'staff' } }, authChecked: true, signOutKeepAccount: jest.fn() };
function Probe() { lock = useAppFingerprintLock(); return null; }
async function mount() { await act(async () => { root = renderer.create(<Probe />); }); }

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  auth.authChecked = true;
  auth.signOutKeepAccount.mockResolvedValue(undefined);
  (useAuth as jest.Mock).mockImplementation(() => auth);
  (getFingerprintOptInState as jest.Mock).mockResolvedValue('off');
  (verifyFingerprintForAccount as jest.Mock).mockResolvedValue({ success: true });
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    appStateEvent = callback;
    return { remove: jest.fn() };
  });
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = undefined;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('unlocks an account that has not opted into fingerprint', async () => {
  await mount();
  expect(lock.status).toBe('unlocked');
  expect(verifyFingerprintForAccount).not.toHaveBeenCalled();
});

it('keeps the cover while auth is still restoring', async () => {
  auth.authChecked = false;
  await mount();
  expect(lock.status).toBe('resolving');
  expect(getFingerprintOptInState).not.toHaveBeenCalled();
  auth.authChecked = true;
  await act(async () => { root?.update(<Probe />); });
  expect(lock.status).toBe('unlocked');
});

it('replaces a stalled keychain read with a locked password-recovery screen', async () => {
  let finish!: (state: string) => void;
  (getFingerprintOptInState as jest.Mock).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  await mount();
  expect(lock.status).toBe('resolving');
  await act(async () => { jest.advanceTimersByTime(5000); });
  expect(lock.status).toBe('locked');
  expect(lock.failureMessage).toBe('storage_error');
  expect(lock.privacyCovered).toBe(false);
  expect(verifyFingerprintForAccount).not.toHaveBeenCalled();
  // A late 'off' read must not remove an already raised security lock.
  await act(async () => { finish('off'); });
  expect(lock.status).toBe('locked');
  await act(async () => { await lock.fallbackToPassword(); });
  expect(auth.signOutKeepAccount).toHaveBeenCalledTimes(1);
  expect(lock.status).toBe('unlocked');
});

it('offers recovery if reading the fingerprint preference throws', async () => {
  (getFingerprintOptInState as jest.Mock).mockRejectedValue(new Error('keystore unavailable'));
  await mount();
  expect(lock.status).toBe('locked');
  expect(lock.failureMessage).toBe('storage_error');
});

it('requires a successful scan for an opted-in account', async () => {
  (getFingerprintOptInState as jest.Mock).mockResolvedValue('on');
  (verifyFingerprintForAccount as jest.Mock).mockResolvedValue({ success: false, reason: 'cancelled' });
  await mount();
  expect(lock.status).toBe('locked');
  expect(lock.failureMessage).toBe('cancelled');
  (verifyFingerprintForAccount as jest.Mock).mockResolvedValue({ success: true });
  await act(async () => { await lock.retry(); });
  expect(lock.status).toBe('unlocked');
});

it('removes the privacy cover on the first active event after an unknown initial state', async () => {
  Object.defineProperty(AppState, 'currentState', { value: 'unknown', configurable: true });
  await mount();
  await act(async () => { appStateEvent('inactive'); });
  expect(lock.privacyCovered).toBe(true);
  // Simulate an OS callback through the initial-state listener on activation.
  // A normal inactive/active transition must also always remove the cover.
  await act(async () => { appStateEvent('active'); });
  expect(lock.privacyCovered).toBe(false);
});

it('rechecks fingerprint on a true background-to-active transition', async () => {
  await mount();
  await act(async () => { appStateEvent('background'); });
  expect(lock.privacyCovered).toBe(true);
  await act(async () => { appStateEvent('active'); });
  expect(getFingerprintOptInState).toHaveBeenCalledTimes(2);
  expect(lock.status).toBe('unlocked');
  expect(lock.privacyCovered).toBe(false);
});
