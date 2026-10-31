/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { PlayStoreUpdates, type InstallState, type PlayUpdateInfo } from '../../modules/play-store-updates';
import { openPlayStore } from '../utils/openPlayStore';
import { usePlayStoreUpdate } from './usePlayStoreUpdate';

jest.mock('../../modules/play-store-updates', () => ({
  PlayStoreUpdates: {
    isSupported: true, getUpdateInfo: jest.fn(), startUpdate: jest.fn(),
    completeUpdate: jest.fn(), addInstallListener: jest.fn(),
  },
}));
jest.mock('../utils/openPlayStore', () => ({ openPlayStore: jest.fn() }));
const { act, create } = require('react-test-renderer');
const available: PlayUpdateInfo = {
  updateAvailable: true, immediateInProgress: false, availableVersionCode: 42,
  flexibleAllowed: true, immediateAllowed: true, installStatus: 'unknown',
  bytesDownloaded: 0, totalBytesToDownload: 0,
};
let controller: ReturnType<typeof usePlayStoreUpdate>;
let root: { unmount(): void; update(node: React.ReactElement): void } | undefined;
let onInstall: (state: InstallState) => void;
let onForeground: (state: AppStateStatus) => void;
const removeInstall = jest.fn();
const removeApp = jest.fn();
function Probe({ required = false }) { controller = usePlayStoreUpdate(required); return null; }
async function mount(required = false) { await act(async () => { root = create(<Probe required={required} />); }); }
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  AppState.currentState = 'active';
  PlayStoreUpdates.isSupported = true;
  (PlayStoreUpdates.getUpdateInfo as jest.Mock).mockReset().mockResolvedValue({ ...available });
  (PlayStoreUpdates.startUpdate as jest.Mock).mockReset().mockResolvedValue('accepted');
  (PlayStoreUpdates.completeUpdate as jest.Mock).mockReset().mockResolvedValue(undefined);
  (openPlayStore as jest.Mock).mockReset().mockResolvedValue(undefined);
  (PlayStoreUpdates.addInstallListener as jest.Mock).mockImplementation((listener) => {
    onInstall = listener; return { remove: removeInstall };
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    onForeground = listener; return { remove: removeApp };
  });
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = undefined;
  jest.restoreAllMocks();
});

it('only advertises releases confirmed by Google Play', async () => {
  (PlayStoreUpdates.getUpdateInfo as jest.Mock).mockResolvedValue({ ...available, updateAvailable: false });
  await mount();
  expect(controller.showBanner).toBe(false);
  (PlayStoreUpdates.getUpdateInfo as jest.Mock).mockRejectedValue(new Error('offline / not owned'));
  await act(async () => { onForeground('active'); });
  expect(controller.showBanner).toBe(false);
  expect(openPlayStore).not.toHaveBeenCalled();
});

it('starts flexible updates for normal releases and immediate updates when the policy changes', async () => {
  await mount();
  expect(controller.showBanner).toBe(true);
  await act(async () => { await controller.startUpdate(); });
  expect(PlayStoreUpdates.startUpdate).toHaveBeenLastCalledWith('flexible');
  await act(async () => { root!.update(<Probe required />); });
  await act(async () => { await controller.startUpdate(); });
  expect(PlayStoreUpdates.startUpdate).toHaveBeenLastCalledWith('immediate');
});

it('keeps cancellation in the app without redirecting or repeatedly prompting', async () => {
  (PlayStoreUpdates.startUpdate as jest.Mock).mockResolvedValue('cancelled');
  await mount();
  await act(async () => { await controller.startUpdate(); });
  expect(openPlayStore).not.toHaveBeenCalled();
  expect(controller.showBanner).toBe(true);
  expect(controller.busy).toBe(false);
  expect(controller.error).toBeNull();
  expect(PlayStoreUpdates.startUpdate).toHaveBeenCalledTimes(1);
});

it.each(['unavailable', 'throws'])('opens the store when a user-initiated native flow %s', async (result) => {
  await mount(true);
  if (result === 'throws') (PlayStoreUpdates.startUpdate as jest.Mock).mockRejectedValue(new Error('Play failure'));
  else (PlayStoreUpdates.startUpdate as jest.Mock).mockResolvedValue(result);
  await act(async () => { await controller.startUpdate(); });
  expect(openPlayStore).toHaveBeenCalledTimes(1);
});

it('shows a retryable error when neither native updates nor the store can open', async () => {
  await mount(true);
  (PlayStoreUpdates.startUpdate as jest.Mock).mockResolvedValue('unavailable');
  (openPlayStore as jest.Mock).mockRejectedValue(new Error('No handler'));
  await act(async () => { await controller.startUpdate(); });
  expect(controller.error).toContain('Could not open Google Play');
  expect(controller.busy).toBe(false);
});

it('prevents rapid taps and foreground events from launching duplicate confirmation flows', async () => {
  const pending = deferred<'accepted'>();
  (PlayStoreUpdates.startUpdate as jest.Mock).mockReturnValue(pending.promise);
  await mount();
  let starting!: Promise<void>;
  await act(async () => { starting = controller.startUpdate(); });
  (PlayStoreUpdates.getUpdateInfo as jest.Mock).mockResolvedValue({ ...available, immediateInProgress: true });
  await act(async () => { await controller.startUpdate(); onForeground('active'); });
  expect(controller.busy).toBe(true);
  expect(PlayStoreUpdates.startUpdate).toHaveBeenCalledTimes(1);
  await act(async () => { pending.resolve('accepted'); await starting; });
});

it('shows progress, keeps a downloaded update visible despite dismissal, and installs only on restart tap', async () => {
  await mount();
  await act(async () => { controller.dismiss(); });
  expect(controller.showBanner).toBe(false);
  await act(async () => { onInstall({ installStatus: 'downloading', bytesDownloaded: 25, totalBytesToDownload: 100 }); });
  expect(controller.showBanner).toBe(true);
  expect(controller.progress).toBe(25);
  await act(async () => { onInstall({ installStatus: 'downloaded', bytesDownloaded: 100, totalBytesToDownload: 100 }); });
  expect(controller.downloaded).toBe(true);
  expect(PlayStoreUpdates.completeUpdate).not.toHaveBeenCalled();
  await act(async () => { await controller.completeUpdate(); });
  expect(PlayStoreUpdates.completeUpdate).toHaveBeenCalledTimes(1);
});

it('recovers the restart button on launch when the download completed while the app was closed', async () => {
  (PlayStoreUpdates.getUpdateInfo as jest.Mock).mockResolvedValue({ ...available, updateAvailable: false, installStatus: 'downloaded' });
  await mount();
  expect(controller.showBanner).toBe(true);
  expect(controller.downloaded).toBe(true);
  expect(PlayStoreUpdates.completeUpdate).not.toHaveBeenCalled();
});

it('does not let a stale availability response overwrite a newer downloaded event', async () => {
  await mount();
  const pending = deferred<PlayUpdateInfo>();
  (PlayStoreUpdates.getUpdateInfo as jest.Mock).mockReturnValueOnce(pending.promise);
  await act(async () => { onForeground('active'); });
  await act(async () => { onInstall({ installStatus: 'downloaded', bytesDownloaded: 100, totalBytesToDownload: 100 }); });
  await act(async () => { pending.resolve({ ...available, installStatus: 'downloading' }); });
  expect(controller.downloaded).toBe(true);
});

it('does not resurrect a completed update banner from a check already in flight', async () => {
  await mount();
  const pending = deferred<PlayUpdateInfo>();
  (PlayStoreUpdates.getUpdateInfo as jest.Mock).mockReturnValueOnce(pending.promise);
  await act(async () => { onForeground('active'); });
  await act(async () => { onInstall({ installStatus: 'installed', bytesDownloaded: 100, totalBytesToDownload: 100 }); });
  await act(async () => { pending.resolve({ ...available }); });
  expect(controller.showBanner).toBe(false);
});

it('resumes an interrupted immediate update on launch without redirecting if resume fails', async () => {
  (PlayStoreUpdates.getUpdateInfo as jest.Mock).mockResolvedValue({ ...available, immediateInProgress: true });
  (PlayStoreUpdates.startUpdate as jest.Mock).mockRejectedValue(new Error('resume failed'));
  await mount();
  expect(PlayStoreUpdates.startUpdate).toHaveBeenCalledTimes(1);
  expect(PlayStoreUpdates.startUpdate).toHaveBeenCalledWith('immediate');
  expect(openPlayStore).not.toHaveBeenCalled();
  expect(controller.error).toContain('Could not resume');
});

it('allows a failed install to be retried without losing the downloaded update', async () => {
  (PlayStoreUpdates.getUpdateInfo as jest.Mock).mockResolvedValue({ ...available, installStatus: 'downloaded' });
  await mount();
  (PlayStoreUpdates.completeUpdate as jest.Mock).mockRejectedValueOnce(new Error('install failed'));
  await act(async () => { await controller.completeUpdate(); });
  expect(controller.downloaded).toBe(true);
  expect(controller.error).toContain('Could not install');
  await act(async () => { await controller.completeUpdate(); });
  expect(controller.error).toBeNull();
  expect(PlayStoreUpdates.completeUpdate).toHaveBeenCalledTimes(2);
});

it('dismisses only this version and rechecks when returning to the foreground', async () => {
  await mount();
  await act(async () => { controller.dismiss(); onForeground('background'); });
  expect(controller.showBanner).toBe(false);
  expect(PlayStoreUpdates.getUpdateInfo).toHaveBeenCalledTimes(1);
  (PlayStoreUpdates.getUpdateInfo as jest.Mock).mockResolvedValue({ ...available, availableVersionCode: 43 });
  await act(async () => { onForeground('active'); });
  expect(controller.showBanner).toBe(true);
});

it('cleans up subscriptions and hides the banner after installation', async () => {
  await mount();
  await act(async () => { onInstall({ installStatus: 'installed', bytesDownloaded: 100, totalBytesToDownload: 100 }); });
  expect(controller.showBanner).toBe(false);
  await act(async () => { root!.unmount(); root = undefined; });
  expect(removeInstall).toHaveBeenCalledTimes(1);
  expect(removeApp).toHaveBeenCalledTimes(1);
});

it('supports older Android binaries via the store fallback without checking unsupported platforms', async () => {
  PlayStoreUpdates.isSupported = false;
  (PlayStoreUpdates.startUpdate as jest.Mock).mockResolvedValue('unavailable');
  await mount(true);
  expect(PlayStoreUpdates.getUpdateInfo).not.toHaveBeenCalled();
  expect(PlayStoreUpdates.addInstallListener).not.toHaveBeenCalled();
  expect(controller.showBanner).toBe(false);
  await act(async () => { await controller.startUpdate(); });
  expect(openPlayStore).toHaveBeenCalledTimes(1);
});

it('ignores an older foreground check after a newer post-action check finishes', async () => {
  await mount();
  const older = deferred<PlayUpdateInfo>();
  (PlayStoreUpdates.getUpdateInfo as jest.Mock)
    .mockReturnValueOnce(older.promise)
    .mockResolvedValueOnce({ ...available, installStatus: 'downloaded' });
  await act(async () => { onForeground('active'); });
  await act(async () => { await controller.startUpdate(); });
  expect(controller.downloaded).toBe(true);
  await act(async () => { older.resolve({ ...available, installStatus: 'downloading' }); });
  expect(controller.downloaded).toBe(true);
});

it('waits until foreground before resuming an immediate update discovered by a delayed check', async () => {
  const pending = deferred<PlayUpdateInfo>();
  (PlayStoreUpdates.getUpdateInfo as jest.Mock).mockReturnValueOnce(pending.promise);
  await mount();
  await act(async () => { onForeground('background'); });
  const interrupted = { ...available, immediateInProgress: true };
  await act(async () => { pending.resolve(interrupted); });
  expect(PlayStoreUpdates.startUpdate).not.toHaveBeenCalled();
  (PlayStoreUpdates.getUpdateInfo as jest.Mock).mockResolvedValue(interrupted);
  await act(async () => { onForeground('active'); });
  expect(PlayStoreUpdates.startUpdate).toHaveBeenCalledTimes(1);
});

it('keeps a confirmed download event when the initial metadata check fails', async () => {
  const pending = deferred<PlayUpdateInfo>();
  (PlayStoreUpdates.getUpdateInfo as jest.Mock).mockReturnValueOnce(pending.promise);
  await mount();
  await act(async () => { onInstall({ installStatus: 'downloaded', bytesDownloaded: 100, totalBytesToDownload: 100 }); });
  expect(controller.showBanner).toBe(true);
  expect(controller.downloaded).toBe(true);
  await act(async () => { pending.reject(new Error('metadata check failed')); });
  expect(controller.downloaded).toBe(true);
});

it('does not open the store in the background after a delayed native failure', async () => {
  await mount(true);
  let fail!: (error: Error) => void;
  (PlayStoreUpdates.startUpdate as jest.Mock).mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject; }));
  let action!: Promise<void>;
  await act(async () => { action = controller.startUpdate(); });
  await act(async () => { onForeground('background'); });
  await act(async () => { fail(new Error('activity no longer active')); await action; });
  expect(openPlayStore).not.toHaveBeenCalled();
  expect(controller.busy).toBe(false);
  expect(controller.error).toBeTruthy();
});

it('restores Update now if Google no longer has the downloaded update at restart time', async () => {
  (PlayStoreUpdates.getUpdateInfo as jest.Mock).mockResolvedValueOnce({ ...available, installStatus: 'downloaded' });
  await mount();
  (PlayStoreUpdates.completeUpdate as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('removed'), { code: 'NOT_DOWNLOADED' }));
  await act(async () => { await controller.completeUpdate(); });
  expect(controller.downloaded).toBe(false);
  expect(controller.error).toContain('Update now');
});

it('retains the initial availability check when Strict Mode replays effects', async () => {
  const pending = deferred<PlayUpdateInfo>();
  (PlayStoreUpdates.getUpdateInfo as jest.Mock).mockReturnValueOnce(pending.promise);
  await act(async () => { root = create(<React.StrictMode><Probe /></React.StrictMode>); });
  await act(async () => { pending.resolve({ ...available }); });
  expect(controller.showBanner).toBe(true);
});
