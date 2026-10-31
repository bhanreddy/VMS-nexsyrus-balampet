/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useVersionCheck } from './useVersionCheck';

jest.mock('expo-application', () => ({ nativeApplicationVersion: '5.1.9' }));
jest.mock('expo-constants', () => ({ expoConfig: { version: '5.1.8' } }));
jest.mock('../constants/school', () => ({ API_URL: 'https://example.test/api/v1' }));
const { act, create } = require('react-test-renderer');
let verdict: ReturnType<typeof useVersionCheck>;
let root: { unmount(): void } | undefined;
let onForeground: (state: AppStateStatus) => void;
const remove = jest.fn();
function Probe() { verdict = useVersionCheck(); return null; }
async function mount() { await act(async () => { root = create(<Probe />); }); }
const policy = (enabled: boolean, minimum = '5.2.0') => ({
  ok: true, json: async () => ({ force_update_enabled: enabled, minimum_version: minimum }),
});
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (fetch as jest.Mock).mockReset().mockResolvedValue(policy(false));
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    onForeground = listener; return { remove };
  });
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = undefined;
  jest.restoreAllMocks();
});

it('enforces a school minimum version and refreshes it after returning from Google Play', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce(policy(true));
  await mount();
  expect(verdict).toEqual({ updateRequired: true, checking: false });
  expect(fetch).toHaveBeenCalledWith('https://example.test/api/v1/app/version-check?school_id=1', expect.any(Object));
  await act(async () => { onForeground('active'); });
  expect(verdict.updateRequired).toBe(false);
});

it('does not block a binary that already satisfies a previously cached minimum', async () => {
  await AsyncStorage.setItem('version_check_result', JSON.stringify({ updateRequired: true, minimumVersion: '5.1.9' }));
  (fetch as jest.Mock).mockRejectedValue(new Error('offline'));
  await mount();
  expect(verdict.updateRequired).toBe(false);
});

it('keeps an enforced cached minimum during a network failure', async () => {
  await AsyncStorage.setItem('version_check_result', JSON.stringify({ updateRequired: true, minimumVersion: '5.2.0' }));
  (fetch as jest.Mock).mockRejectedValue(new Error('offline'));
  await mount();
  expect(verdict.updateRequired).toBe(true);
});

it('does not let a slow cached verdict override a newer server policy', async () => {
  let finishCache!: (value: string) => void;
  jest.spyOn(AsyncStorage, 'getItem').mockImplementationOnce(() => new Promise((resolve) => { finishCache = resolve; }));
  await mount();
  expect(verdict.updateRequired).toBe(false);
  await act(async () => {
    finishCache(JSON.stringify({ updateRequired: true, minimumVersion: '5.2.0' }));
  });
  expect(verdict.updateRequired).toBe(false);
});

it('prevents duplicate requests and cancels a pending check when unmounted', async () => {
  let signal!: AbortSignal;
  (fetch as jest.Mock).mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    signal = options.signal;
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  await mount();
  await act(async () => { onForeground('active'); });
  expect(fetch).toHaveBeenCalledTimes(1);
  await act(async () => { root!.unmount(); root = undefined; });
  expect(signal.aborted).toBe(true);
  expect(remove).toHaveBeenCalledTimes(1);
});

it('times out a stalled response body and allows a later foreground check', async () => {
  jest.useFakeTimers();
  try {
    let signal!: AbortSignal;
    (fetch as jest.Mock).mockImplementationOnce(async (_url, options) => {
      signal = options.signal;
      return {
        ok: true,
        json: () => new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('body timed out')));
        }),
      };
    });
    await mount();
    expect(verdict.checking).toBe(true);
    await act(async () => { jest.advanceTimersByTime(10000); });
    expect(signal.aborted).toBe(true);
    expect(verdict.checking).toBe(false);
    (fetch as jest.Mock).mockResolvedValueOnce(policy(true));
    await act(async () => { onForeground('active'); });
    expect(verdict.updateRequired).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});
