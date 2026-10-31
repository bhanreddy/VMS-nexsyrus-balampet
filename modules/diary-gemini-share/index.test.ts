/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: jest.fn() }));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
const { requireOptionalNativeModule } = require('expo-modules-core');
const { Platform } = require('react-native');
const native = { shareImage: jest.fn(async () => 'opened') };
function load(os: string) {
  Platform.OS = os;
  let bridge: typeof import('./index').DiaryGeminiShare;
  jest.isolateModules(() => { bridge = require('./index').DiaryGeminiShare; });
  return bridge!;
}
beforeEach(() => { jest.clearAllMocks(); requireOptionalNativeModule.mockReturnValue(native); });

it('forwards only the image and question to the optional Android module', async () => {
  const bridge = load('android');
  expect(bridge.isSupported).toBe(true);
  expect(requireOptionalNativeModule).toHaveBeenCalledWith('DiaryGeminiShare');
  expect(await bridge.shareImage('content://school/photo', 'తెలుగులో వివరించండి')).toBe('opened');
  expect(native.shareImage).toHaveBeenCalledWith('content://school/photo', 'తెలుగులో వివరించండి');
});
it.each(['ios', 'web'])('loads without Android native code on %s', async (os) => {
  const bridge = load(os);
  expect(requireOptionalNativeModule).not.toHaveBeenCalled();
  expect(await bridge.shareImage('content://school/photo', 'Question')).toBe('unavailable');
});
it('supports older binaries and Expo Go through the fallback', async () => {
  requireOptionalNativeModule.mockReturnValue(null);
  expect(await load('android').shareImage('content://school/photo', 'Question')).toBe('unavailable');
});
