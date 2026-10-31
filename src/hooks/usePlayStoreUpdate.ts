import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  PlayStoreUpdates, type InstallState, type PlayUpdateInfo, type UpdateMode,
} from '../../modules/play-store-updates';
import { openPlayStore } from '../utils/openPlayStore';

export function usePlayStoreUpdate(updateRequired: boolean) {
  const [info, setInfo] = useState<PlayUpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<number | null>(null);
  const mounted = useRef(false);
  const busyRef = useRef(false);
  const requiredRef = useRef(updateRequired);
  requiredRef.current = updateRequired;
  const checkRunning = useRef(false);
  const appState = useRef(AppState.currentState);
  const checkSequence = useRef(0);
  const eventRevision = useRef(0);
  const latestInstallState = useRef<InstallState | null>(null);

  const readInfo = useCallback(async () => {
    const sequence = ++checkSequence.current;
    const revision = eventRevision.current;
    const result = await PlayStoreUpdates.getUpdateInfo();
    if (!mounted.current || sequence !== checkSequence.current || !result) return null;
    // A download event can arrive while the check is in flight. Never regress
    // DOWNLOADED to an older DOWNLOADING snapshot and lose the restart button.
    const next = revision !== eventRevision.current && latestInstallState.current
      ? { ...result, ...latestInstallState.current } : { ...result };
    if (next.installStatus === 'installed') {
      next.updateAvailable = false;
      next.immediateInProgress = false;
    }
    setInfo(next);
    return next;
  }, []);

  const visitStore = useCallback(async () => {
    if (!mounted.current) return;
    if (appState.current !== 'active') {
      setError('Return to the app and tap Update now to retry.');
      return;
    }
    setError(null);
    try {
      await openPlayStore();
    } catch {
      if (mounted.current) setError('Could not open Google Play. Please try again.');
    }
  }, []);

  const performUpdate = useCallback(async (mode: UpdateMode, userInitiated: boolean) => {
    if (!mounted.current || appState.current !== 'active' || busyRef.current) return;
    busyRef.current = true;
    if (mounted.current) { setBusy(true); setError(null); }
    try {
      const result = await PlayStoreUpdates.startUpdate(mode);
      // Cancellation is a choice, not a failure: do not redirect to the store.
      if (result === 'unavailable' && userInitiated) await visitStore();
      try { await readInfo(); } catch { /* retain the last known download state */ }
    } catch {
      if (userInitiated) await visitStore();
      else if (mounted.current) setError('Could not resume the update. Tap Update now to retry.');
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [readInfo, visitStore]);

  const refresh = useCallback(async () => {
    if (checkRunning.current || !PlayStoreUpdates.isSupported) return;
    checkRunning.current = true;
    try {
      const current = await readInfo();
      // Recover a previously accepted immediate update after process death or
      // returning to the app, but never launch a second confirmation over one.
      if (current?.immediateInProgress && appState.current === 'active' && !busyRef.current) {
        await performUpdate('immediate', false);
      }
    } catch {
      // Offline, non-Play installs and accounts without ownership are normal.
      // A failed availability check must not advertise an unconfirmed release.
    } finally {
      checkRunning.current = false;
    }
  }, [performUpdate, readInfo]);

  useEffect(() => {
    mounted.current = true;
    appState.current = AppState.currentState;
    // Track foreground state even in older binaries using the store fallback.
    const appSubscription = AppState.addEventListener('change', (state) => {
      appState.current = state;
      if (state === 'active') void refresh();
    });
    if (!PlayStoreUpdates.isSupported) return () => {
      mounted.current = false;
      appSubscription.remove();
    };
    const installSubscription = PlayStoreUpdates.addInstallListener((state) => {
      if (!mounted.current) return;
      eventRevision.current += 1;
      latestInstallState.current = state;
      setInfo((previous) => ({
        // Install events are already confirmation from Google Play. They can
        // arrive before the first metadata request completes (or if it fails).
        updateAvailable: false, immediateInProgress: false, availableVersionCode: 0,
        flexibleAllowed: false, immediateAllowed: false,
        ...previous, ...state,
        ...(state.installStatus === 'installed' ? { updateAvailable: false, immediateInProgress: false } : {}),
      }));
      if (state.installStatus === 'failed') {
        setError('The download failed. Tap Update now to retry.');
      } else {
        setError(null);
      }
    });
    void refresh();
    return () => {
      mounted.current = false;
      installSubscription.remove();
      appSubscription.remove();
    };
  }, [refresh]);

  const startUpdate = useCallback(
    () => performUpdate(requiredRef.current ? 'immediate' : 'flexible', true),
    [performUpdate],
  );

  const completeUpdate = useCallback(async () => {
    if (!mounted.current || appState.current !== 'active' || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await PlayStoreUpdates.completeUpdate();
    } catch {
      // Google can remove/cancel a download before the user taps Restart.
      // Refresh so the screen does not remain stuck offering an invalid action.
      let current: PlayUpdateInfo | null = null;
      try { current = await readInfo(); } catch { /* keep the last known state */ }
      if (mounted.current) setError(current && current.installStatus !== 'downloaded'
        ? 'Could not install the update. Tap Update now to retry.'
        : 'Could not install the update. Tap Restart to retry.');
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [readInfo]);

  const downloaded = info?.installStatus === 'downloaded';
  const downloading = info?.installStatus === 'pending' || info?.installStatus === 'downloading';
  const installing = info?.installStatus === 'installing';
  const progress = info && info.totalBytesToDownload > 0
    ? Math.min(100, Math.max(0, Math.round(info.bytesDownloaded / info.totalBytesToDownload * 100)))
    : null;
  const showBanner = Boolean(info && (downloaded || downloading || installing || info.immediateInProgress
    || (info.updateAvailable && info.availableVersionCode !== dismissedVersion)));

  return {
    showBanner, busy, error, downloaded, downloading, installing, progress,
    startUpdate, completeUpdate, openStore: visitStore,
    dismiss: () => setDismissedVersion(info?.availableVersionCode ?? null),
  };
}

export type PlayStoreUpdateController = ReturnType<typeof usePlayStoreUpdate>;
