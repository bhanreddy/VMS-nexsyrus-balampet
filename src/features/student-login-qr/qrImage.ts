import { scanFromURLAsync } from 'expo-camera';

/** Decode locally; only the QR credential is sent through the login API. */
export async function scanQrImage(uri: string): Promise<string | null> {
  const codes = await scanFromURLAsync(uri, ['qr']);
  return codes[0]?.data || null;
}
