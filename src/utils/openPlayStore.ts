import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { alertCompat } from './crossPlatformAlert';

/** Play Store listing URL — `{packageName}` is filled from app.json `expo.android.package`. */
const PLAY_STORE_URL_TEMPLATE =
  'https://play.google.com/store/apps/details?id={packageName}';

/**
 * Installed binary's applicationId, with Expo config fallback for web.
 * Per-school builds swap package via app.template.json → app.json.
 */
export function getAndroidPackageName(): string {
  return (
    (Platform.OS === 'android' ? Application.applicationId : null) ||
    Constants.expoConfig?.android?.package ||
    ''
  );
}

export function getPlayStoreUrl(packageName = getAndroidPackageName()): string {
  return PLAY_STORE_URL_TEMPLATE.replace('{packageName}', packageName);
}

/** Opens this build's Play Store listing (market:// on Android, https fallback). */
export async function openPlayStore(): Promise<void> {
  const packageName = getAndroidPackageName();
  if (!packageName) {
    throw new Error('No Android application ID is available');
  }

  const httpsUrl = getPlayStoreUrl(packageName);
  const marketUrl = `market://details?id=${packageName}`;

  if (Platform.OS === 'android') {
    try {
      // Attempt directly: Android package-visibility restrictions can make
      // canOpenURL return false even when the Play Store can handle the link.
      await Linking.openURL(marketUrl);
      return;
    } catch { /* no market handler: use the browser */ }
  }
  await Linking.openURL(httpsUrl);
}

/**
 * After a successful multi-student action: thank the user and invite a Play Store review.
 */
export function promptAppReviewAfterSuccess(
  title: string,
  successMessage: string,
): void {
  alertCompat(
    title,
    `${successMessage}\n\nEnjoying the app? A quick Play Store review helps other schools find us.`,
    [
      { text: 'Maybe later', style: 'cancel' },
      {
        text: 'Rate on Play Store',
        onPress: () => {
          void openPlayStore();
        },
      },
    ],
  );
}
