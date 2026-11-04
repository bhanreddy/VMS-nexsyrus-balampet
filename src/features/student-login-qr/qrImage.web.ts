import jsQR from 'jsqr';

/** Expo's image scanner is native-only, so decode browser uploads locally. */
export async function scanQrImage(uri: string): Promise<string | null> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = document.createElement('img');
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load QR image'));
    image.src = uri;
  });
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('Empty QR image');

  // Bound memory and decoding time for full-resolution gallery photos.
  const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to read QR image');
    // Transparent QR exports need a white background for reliable decoding.
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' })?.data || null;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
