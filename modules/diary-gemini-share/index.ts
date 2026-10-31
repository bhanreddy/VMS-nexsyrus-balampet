import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

interface NativeDiaryGeminiShare {
  shareImage(contentUri: string, prompt: string): Promise<'opened' | 'unavailable'>;
}

// Expo Go, old installed binaries, iOS and web retain the guided sharing flow.
const native = Platform.OS === 'android'
  ? requireOptionalNativeModule<NativeDiaryGeminiShare>('DiaryGeminiShare') : null;

export const DiaryGeminiShare = {
  isSupported: Boolean(native),
  async shareImage(contentUri: string, prompt: string): Promise<'opened' | 'unavailable'> {
    return native ? native.shareImage(contentUri, prompt) : 'unavailable';
  },
};
