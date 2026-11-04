import { scanFromURLAsync } from 'expo-camera';
import { scanQrImage } from './qrImage';

jest.mock('expo-camera', () => ({ scanFromURLAsync: jest.fn() }));

it('decodes gallery images with the native QR scanner', async () => {
  (scanFromURLAsync as jest.Mock).mockResolvedValue([{ data: 'login-credential' }]);
  await expect(scanQrImage('file:///qr.png')).resolves.toBe('login-credential');
  expect(scanFromURLAsync).toHaveBeenCalledWith('file:///qr.png', ['qr']);
});

it('returns null when the native scanner finds no QR', async () => {
  (scanFromURLAsync as jest.Mock).mockResolvedValue([]);
  await expect(scanQrImage('file:///blank.png')).resolves.toBeNull();
});
