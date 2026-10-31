import { Linking, Platform } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { getAndroidPackageName, openPlayStore } from './openPlayStore';

jest.mock('expo-application', () => ({ applicationId: 'com.schoolims.installed' }));
jest.mock('expo-constants', () => ({ expoConfig: { android: { package: 'com.schoolims.config' } } }));
jest.mock('./crossPlatformAlert', () => ({ alertCompat: jest.fn() }));
beforeEach(() => { jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined); });
afterEach(() => { jest.restoreAllMocks(); });
it('uses the installed school package even when Expo configuration has a different package', () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  expect(getAndroidPackageName()).toBe('com.schoolims.installed');
});
it('opens the native store directly without canOpenURL package-visibility false negatives', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const canOpen = jest.spyOn(Linking, 'canOpenURL');
  await openPlayStore();
  expect(Linking.openURL).toHaveBeenCalledWith('market://details?id=com.schoolims.installed');
  expect(canOpen).not.toHaveBeenCalled();
});
it('falls back to the HTTPS listing if no native store handler exists', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  (Linking.openURL as jest.Mock).mockRejectedValueOnce(new Error('no handler'));
  await openPlayStore();
  expect(Linking.openURL).toHaveBeenLastCalledWith('https://play.google.com/store/apps/details?id=com.schoolims.installed');
});
it('surfaces failures so the update UI can display retry instructions', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  (Linking.openURL as jest.Mock).mockRejectedValue(new Error('store unavailable'));
  await expect(openPlayStore()).rejects.toThrow('store unavailable');
});
it('uses the config fallback when no installed binary ID is available', () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.replaceProperty(Application, 'applicationId', null);
  expect(getAndroidPackageName()).toBe(Constants.expoConfig?.android?.package);
});
it('keeps the Android listing config on iOS rather than using an iOS bundle identifier', () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  expect(getAndroidPackageName()).toBe(Constants.expoConfig?.android?.package);
});
