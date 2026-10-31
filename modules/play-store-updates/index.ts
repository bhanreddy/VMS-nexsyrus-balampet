import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export type InstallStatus = 'unknown' | 'pending' | 'downloading' | 'downloaded'
  | 'installing' | 'installed' | 'failed' | 'cancelled';
export type InstallState = {
  installStatus: InstallStatus;
  bytesDownloaded: number;
  totalBytesToDownload: number;
  installErrorCode?: number;
};
export type PlayUpdateInfo = InstallState & {
  updateAvailable: boolean;
  immediateInProgress: boolean;
  availableVersionCode: number;
  flexibleAllowed: boolean;
  immediateAllowed: boolean;
};
export type UpdateMode = 'flexible' | 'immediate';
export type UpdateResult = 'accepted' | 'cancelled' | 'unavailable' | 'in_progress';

interface NativeUpdates {
  getUpdateInfo(): Promise<PlayUpdateInfo>;
  startUpdate(mode: UpdateMode): Promise<UpdateResult>;
  completeUpdate(): Promise<void>;
  addListener(event: 'onInstallState', listener: (state: InstallState) => void): { remove(): void };
}

// Old binaries / Expo Go / iOS / web must still be able to load the app.
const native = Platform.OS === 'android'
  ? requireOptionalNativeModule<NativeUpdates>('PlayStoreUpdates')
  : null;

export const PlayStoreUpdates = {
  isSupported: Boolean(native),
  async getUpdateInfo(): Promise<PlayUpdateInfo | null> {
    return native ? native.getUpdateInfo() : null;
  },
  async startUpdate(mode: UpdateMode): Promise<UpdateResult> {
    return native ? native.startUpdate(mode) : 'unavailable';
  },
  async completeUpdate(): Promise<void> {
    if (!native) throw new Error('Google Play updates are unavailable');
    await native.completeUpdate();
  },
  addInstallListener(listener: (state: InstallState) => void) {
    return native?.addListener('onInstallState', listener) ?? { remove() {} };
  },
};
