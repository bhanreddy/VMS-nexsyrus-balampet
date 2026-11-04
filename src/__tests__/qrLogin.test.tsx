/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import NetInfo from '@react-native-community/netinfo';
import QrLoginScannerScreen from '../../app/qr-login';
import { scanQrImage } from '../features/student-login-qr/qrImage';
import { LOGIN_QR_USER_ERRORS } from '../features/student-login-qr/qrLoginErrors';

const { act, create } = require('react-test-renderer');
const mockRouter = { replace: jest.fn(), back: jest.fn() };
const mockSignIn = jest.fn();
const mockAddAccount = jest.fn();
const mockSwitchAccount = jest.fn();
const mockRequestPermission = jest.fn();
let mockPermission: { granted: boolean; canAskAgain: boolean } | null;
let mockMode: string | undefined;

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [mockPermission, mockRequestPermission],
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('../features/student-login-qr/qrImage', () => ({ scanQrImage: jest.fn() }));
jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: { fetch: jest.fn() } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ mode: mockMode }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
jest.mock('../hooks/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock('../hooks/useAuth', () => ({ useAuth: () => ({ signInWithQr: mockSignIn, addAccountWithQr: mockAddAccount, switchAccount: mockSwitchAccount }) }));
jest.mock('../constants/school', () => ({ SCHOOL_ID: 17 }));
jest.mock('../services/apiClient', () => ({
  APIError: class extends Error {
    statusCode: number;
    code?: string;
    constructor(message: string, statusCode: number, _details?: unknown, _response?: unknown, code?: string) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
    }
  },
}));

const validQr = JSON.stringify({
  type: 'SCHOOLIMS_LOGIN', version: 1, schoolId: 17,
  payload: `123e4567-e89b-42d3-a456-426614174000.${'A'.repeat(43)}`,
});
const selectedImage = { canceled: false, assets: [{ uri: 'file:///login-qr.png' }] } as ImagePicker.ImagePickerResult;
const session = (role = 'student') => ({ validatedUser: { userId: 'qr-account', role: { code: role } } });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
let tree: any;
const upload = () => tree.root.findAll((node: any) => node.props.accessibilityRole === 'button'
  && node.props.accessibilityLabel === 'Upload QR from gallery')[0];
const camera = () => tree.root.findByType('CameraView');
const text = () => tree.root.findAllByType(Text).map((node: any) => node.props.children).join(' ');
async function render() { await act(async () => { tree = create(<QrLoginScannerScreen />); }); }
async function pickImage() { await act(async () => { await upload().props.onPress(); }); }

beforeEach(() => {
  jest.clearAllMocks();
  mockPermission = { granted: false, canAskAgain: false };
  mockMode = undefined;
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue(selectedImage);
  (scanQrImage as jest.Mock).mockResolvedValue(validQr);
  (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
  mockSignIn.mockResolvedValue({ session: session(), error: null });
  mockAddAccount.mockResolvedValue({ session: session('staff'), error: null });
  mockSwitchAccount.mockResolvedValue({ session: session('staff'), error: null });
});
afterEach(() => { act(() => tree?.unmount()); tree = undefined; });

it.each([
  ['student', '/(tabs)/home'], ['teacher', '/staff/dashboard'],
  ['admin', '/admin/dashboard'], ['accounts', '/accounts/dashboard'],
])('logs into the uploaded QR account and opens the %s portal without camera permission', async (role, route) => {
  mockSignIn.mockResolvedValue({ session: session(role), error: null });
  await render();
  await pickImage();
  expect(scanQrImage).toHaveBeenCalledWith('file:///login-qr.png');
  expect(mockSignIn).toHaveBeenCalledTimes(1);
  expect(mockSignIn).toHaveBeenCalledWith(validQr);
  expect(mockRouter.replace).toHaveBeenCalledWith(route);
  expect(mockRequestPermission).not.toHaveBeenCalled();
});

it('allows uploading while camera permission is still loading', async () => {
  mockPermission = null;
  await render();
  await pickImage();
  expect(mockSignIn).toHaveBeenCalledWith(validQr);
});

it('adds the uploaded account and switches to that particular account', async () => {
  mockMode = 'add';
  await render();
  await pickImage();
  expect(mockAddAccount).toHaveBeenCalledWith(validQr);
  expect(mockSwitchAccount).toHaveBeenCalledWith('qr-account');
  expect(mockSignIn).not.toHaveBeenCalled();
  expect(mockRouter.replace).toHaveBeenCalledWith('/staff/dashboard');
});

it('keeps the no-profile redirect for uploaded login credentials', async () => {
  mockSignIn.mockResolvedValue({ session: { validatedUser: { ...session().validatedUser, has_student_profile: false } } });
  await render();
  await pickImage();
  expect(mockRouter.replace).toHaveBeenCalledWith('/no-profile');
});

it.each([
  ['not a login code', LOGIN_QR_USER_ERRORS.INVALID],
  [validQr.replace('"schoolId":17', '"schoolId":18'), LOGIN_QR_USER_ERRORS.SCHOOL_MISMATCH],
])('rejects an invalid uploaded credential before authentication: %s', async (qr, expected) => {
  (scanQrImage as jest.Mock).mockResolvedValue(qr);
  await render();
  await pickImage();
  expect(text()).toContain(expected);
  expect(mockSignIn).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it.each([
  ['QR_TOKEN_EXPIRED', LOGIN_QR_USER_ERRORS.EXPIRED],
  ['QR_TOKEN_REVOKED', LOGIN_QR_USER_ERRORS.REVOKED],
])('shows the server error for an uploaded QR: %s', async (code, expected) => {
  mockSignIn.mockResolvedValue({ error: 'Invalid credential', code });
  await render();
  await pickImage();
  expect(text()).toContain(expected);
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(upload().props.disabled).toBe(false);
});

it('shows the offline error without trying to authenticate', async () => {
  (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
  await render();
  await pickImage();
  expect(text()).toContain(LOGIN_QR_USER_ERRORS.NETWORK);
  expect(mockSignIn).not.toHaveBeenCalled();
});

it('resumes scanning when the image picker is canceled', async () => {
  mockPermission = { granted: true, canAskAgain: true };
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: null });
  await render();
  await pickImage();
  expect(camera().props.onBarcodeScanned).toEqual(expect.any(Function));
  expect(upload().props.disabled).toBe(false);
  expect(scanQrImage).not.toHaveBeenCalled();
  expect(mockSignIn).not.toHaveBeenCalled();
});

it('shows a readable error for an image without a QR and lets the user retry', async () => {
  (scanQrImage as jest.Mock).mockResolvedValueOnce(null);
  await render();
  await pickImage();
  expect(text()).toContain('No QR code found.');
  expect(mockSignIn).not.toHaveBeenCalled();
  await pickImage();
  expect(mockSignIn).toHaveBeenCalledWith(validQr);
});

it.each(['picker', 'decoder'])('recovers from a %s failure', async (failure) => {
  const operation = failure === 'picker' ? ImagePicker.launchImageLibraryAsync : scanQrImage;
  (operation as jest.Mock).mockRejectedValueOnce(new Error('Unreadable image'));
  await render();
  await pickImage();
  expect(text()).toContain('Could not read this image.');
  expect(mockSignIn).not.toHaveBeenCalled();
  await pickImage();
  expect(mockSignIn).toHaveBeenCalledWith(validQr);
});

it('prevents duplicate uploads and camera login while selecting and decoding an image', async () => {
  mockPermission = { granted: true, canAskAgain: true };
  const picker = deferred<ImagePicker.ImagePickerResult>();
  const decoder = deferred<string | null>();
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockReturnValue(picker.promise);
  (scanQrImage as jest.Mock).mockReturnValue(decoder.promise);
  await render();
  const staleCameraScan = camera().props.onBarcodeScanned;
  const startUpload = upload().props.onPress;
  let pending: Promise<void>;
  await act(async () => {
    pending = startUpload();
    await startUpload();
    await staleCameraScan({ data: validQr });
  });
  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
  expect(camera().props.onBarcodeScanned).toBeUndefined();
  expect(mockSignIn).not.toHaveBeenCalled();
  await act(async () => { picker.resolve(selectedImage); });
  expect(text()).toContain('Reading QR image…');
  await act(async () => { await staleCameraScan({ data: validQr }); });
  expect(mockSignIn).not.toHaveBeenCalled();
  await act(async () => { decoder.resolve(validQr); await pending!; });
  expect(mockSignIn).toHaveBeenCalledTimes(1);
});

it('does not sign in if the screen is closed while decoding the image', async () => {
  const decoder = deferred<string | null>();
  (scanQrImage as jest.Mock).mockReturnValue(decoder.promise);
  await render();
  let pending: Promise<void>;
  await act(async () => { pending = upload().props.onPress(); });
  act(() => tree.unmount());
  tree = undefined;
  await act(async () => { decoder.resolve(validQr); await pending!; });
  expect(mockSignIn).not.toHaveBeenCalled();
});

it('keeps camera QR login working', async () => {
  mockPermission = { granted: true, canAskAgain: true };
  await render();
  await act(async () => { await camera().props.onBarcodeScanned({ data: validQr }); });
  expect(mockSignIn).toHaveBeenCalledWith(validQr);
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/home');
  expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
});
