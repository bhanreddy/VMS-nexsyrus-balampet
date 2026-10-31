/* eslint-disable import/first, @typescript-eslint/no-require-imports */
jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn(() => ({})) }));
jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(() => ({})), getInitialNotification: jest.fn(),
  onNotificationOpenedApp: jest.fn(),
}));
jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: jest.fn(), getLastNotificationResponseAsync: jest.fn(),
}));
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('./useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('../services/notificationInboxService', () => ({ notificationInboxService: { markRead: jest.fn(async () => {}) } }));
jest.mock('../utils/notificationRoutes', () => ({
  resolveNotificationRoute: jest.fn((data, role) => ({ pathname: `/${role}/${data.notificationId}` })),
  pushNotificationRoute: jest.fn(),
}));

import React from 'react';
import { Platform } from 'react-native';
import { getInitialNotification, onNotificationOpenedApp } from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuth } from './useAuth';
import { useNotificationObserver } from './useNotificationObserver';
import { notificationInboxService } from '../services/notificationInboxService';
import { pushNotificationRoute, resolveNotificationRoute } from '../utils/notificationRoutes';
const { act, create } = require('react-test-renderer');
const user = (userId: string, role: string) => ({ userId, role: { code: role } });
let auth: any;
let fcmTap: (message: any) => void;
let expoTap: (message: any) => void;
let root: any;
const router = {};
const tap = (id: string, recipient = 'b') => ({ data: { notificationId: id, recipientUserId: recipient } });
function Probe() { useNotificationObserver(); return null; }
async function mount() { await act(async () => { root = create(<Probe />); }); }
function deferred() {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  auth = { user: user('a', 'student'), loading: false, switchAccount: jest.fn(async (id) => ({ session: { validatedUser: user(id, 'staff') } })) };
  (useAuth as jest.Mock).mockImplementation(() => auth);
  (useRouter as jest.Mock).mockReturnValue(router);
  (getInitialNotification as jest.Mock).mockResolvedValue(null);
  (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(null);
  (onNotificationOpenedApp as jest.Mock).mockImplementation((_msg, listener) => { fcmTap = listener; return jest.fn(); });
  (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((listener) => { expoTap = listener; return { remove: jest.fn() }; });
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  jest.useRealTimers();
});

it('opens a cold-start notification immediately using the switched account role before React rerenders', async () => {
  (getInitialNotification as jest.Mock).mockResolvedValue(tap('one'));
  await mount();
  expect(auth.switchAccount).toHaveBeenCalledWith('b');
  expect(resolveNotificationRoute).toHaveBeenCalledWith(tap('one').data, 'staff');
  expect(pushNotificationRoute).toHaveBeenCalledWith(router, { pathname: '/staff/one' });
  expect(notificationInboxService.markRead).toHaveBeenCalledWith('one');
});

it('waits for auth readiness and then drains without a timer', async () => {
  auth.loading = true;
  (getInitialNotification as jest.Mock).mockResolvedValue(tap('boot'));
  await mount();
  expect(auth.switchAccount).not.toHaveBeenCalled();
  auth = { ...auth, loading: false };
  await act(async () => { root.update(<Probe />); });
  expect(pushNotificationRoute).toHaveBeenCalledTimes(1);
});

it('coalesces duplicate FCM and Expo deliveries while switching', async () => {
  const switching = deferred();
  auth.switchAccount.mockReturnValue(switching.promise);
  await mount();
  await act(async () => {
    fcmTap(tap('duplicate'));
    expoTap({ notification: { request: { content: { data: tap('duplicate').data } } } });
    switching.resolve({ session: { validatedUser: user('b', 'staff') } });
  });
  expect(auth.switchAccount).toHaveBeenCalledTimes(1);
  expect(pushNotificationRoute).toHaveBeenCalledTimes(1);
  await act(async () => { fcmTap(tap('duplicate')); });
  expect(pushNotificationRoute).toHaveBeenCalledTimes(1);
});

it('opens only the latest queued tap under its recipient account', async () => {
  const switching = deferred();
  auth.switchAccount.mockReturnValueOnce(switching.promise);
  await mount();
  await act(async () => {
    fcmTap(tap('first'));
    fcmTap(tap('latest', 'c'));
    switching.resolve({ session: { validatedUser: user('b', 'staff') } });
  });
  expect(auth.switchAccount.mock.calls).toEqual([['b'], ['c']]);
  expect(pushNotificationRoute).toHaveBeenCalledTimes(1);
  expect(notificationInboxService.markRead).toHaveBeenCalledWith('latest');
  expect(notificationInboxService.markRead).not.toHaveBeenCalledWith('first');
});

it('drains a queued tap even when the first switch fails without a render', async () => {
  const switching = deferred();
  auth.switchAccount.mockReturnValueOnce(switching.promise);
  await mount();
  await act(async () => {
    fcmTap(tap('failed'));
    fcmTap(tap('latest', 'a'));
    switching.resolve({ error: 'cancelled' });
  });
  expect(pushNotificationRoute).toHaveBeenCalledWith(router, { pathname: '/student/latest' });
  expect(notificationInboxService.markRead).not.toHaveBeenCalledWith('failed');
});

it.each([{ error: 'cancelled' }, { session: { validatedUser: user('wrong', 'admin') } }])('does not open or mark a notification if its recipient was not restored', async (result) => {
  auth.switchAccount.mockResolvedValue(result);
  await mount();
  await act(async () => { fcmTap(tap('denied')); });
  expect(pushNotificationRoute).not.toHaveBeenCalled();
  expect(notificationInboxService.markRead).not.toHaveBeenCalled();
});
