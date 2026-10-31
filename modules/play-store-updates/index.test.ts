/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: jest.fn() }));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
const { requireOptionalNativeModule } = require('expo-modules-core');
const { Platform } = require('react-native');
const native = {
  getUpdateInfo: jest.fn(), startUpdate: jest.fn(), completeUpdate: jest.fn(), addListener: jest.fn(),
};
function load(os: string) {
  Platform.OS = os;
  let bridge: typeof import('./index').PlayStoreUpdates;
  jest.isolateModules(() => { bridge = require('./index').PlayStoreUpdates; });
  return bridge!;
}
beforeEach(() => {
  jest.clearAllMocks();
  requireOptionalNativeModule.mockReturnValue(native);
});
it('loads the native module on Android and forwards update commands and download events', async () => {
  const bridge = load('android');
  expect(requireOptionalNativeModule).toHaveBeenCalledWith('PlayStoreUpdates');
  expect(bridge.isSupported).toBe(true);
  native.getUpdateInfo.mockResolvedValue({ updateAvailable: true });
  expect(await bridge.getUpdateInfo()).toEqual({ updateAvailable: true });
  await bridge.startUpdate('immediate');
  expect(native.startUpdate).toHaveBeenCalledWith('immediate');
  await bridge.completeUpdate();
  expect(native.completeUpdate).toHaveBeenCalled();
  const listener = jest.fn();
  bridge.addInstallListener(listener);
  expect(native.addListener).toHaveBeenCalledWith('onInstallState', listener);
});
it.each(['ios', 'web'])('does not try to load Android code on %s', async (os) => {
  const bridge = load(os);
  expect(requireOptionalNativeModule).not.toHaveBeenCalled();
  expect(bridge.isSupported).toBe(false);
  expect(await bridge.getUpdateInfo()).toBeNull();
});
it('loads safely in Expo Go and older binaries without the native module', async () => {
  requireOptionalNativeModule.mockReturnValue(null);
  const bridge = load('android');
  expect(bridge.isSupported).toBe(false);
  expect(await bridge.startUpdate('flexible')).toBe('unavailable');
  await expect(bridge.completeUpdate()).rejects.toThrow('unavailable');
  expect(() => bridge.addInstallListener(jest.fn()).remove()).not.toThrow();
});
