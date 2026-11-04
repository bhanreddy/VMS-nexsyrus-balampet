import QRCode from 'qrcode';
import { scanQrImage } from './qrImage.web';

const credential = JSON.stringify({
  type: 'SCHOOLIMS_LOGIN', version: 1, schoolId: 17,
  payload: `123e4567-e89b-42d3-a456-426614174000.${'A'.repeat(43)}`,
});

// Real generated QR pixels exercise the bundled decoder, rather than mocking it.
function qrPixels(inverted = false) {
  const { modules } = QRCode.create(credential, { errorCorrectionLevel: 'M' });
  const scale = 5;
  const size = (modules.size + 8) * scale;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const row = Math.floor(y / scale) - 4;
      const col = Math.floor(x / scale) - 4;
      const dark = row >= 0 && row < modules.size && col >= 0 && col < modules.size && modules.get(row, col);
      const value = Boolean(dark) !== inverted ? 0 : 255;
      const offset = (y * size + x) * 4;
      data[offset] = data[offset + 1] = data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return { data, width: size, height: size };
}

let pixels: ReturnType<typeof qrPixels>;
let naturalWidth: number;
let naturalHeight: number;
let imageFails: boolean;
let context: { fillStyle: string; fillRect: jest.Mock; drawImage: jest.Mock; getImageData: jest.Mock };
let canvas: { width: number; height: number; getContext: jest.Mock };
let originalDocument: typeof globalThis.document;

beforeEach(() => {
  pixels = qrPixels();
  naturalWidth = pixels.width;
  naturalHeight = pixels.height;
  imageFails = false;
  context = { fillStyle: '', fillRect: jest.fn(), drawImage: jest.fn(), getImageData: jest.fn(() => pixels) };
  canvas = { width: 0, height: 0, getContext: jest.fn(() => context) };
  originalDocument = globalThis.document;
  globalThis.document = {
    createElement: (tag: string) => tag === 'canvas' ? canvas : {
      get naturalWidth() { return naturalWidth; },
      get naturalHeight() { return naturalHeight; },
      onload: () => {}, onerror: () => {},
      set src(_uri: string) { if (imageFails) this.onerror(); else this.onload(); },
    },
  } as unknown as Document;
});
afterEach(() => { globalThis.document = originalDocument; });

it.each([false, true])('decodes a real login QR image locally (inverted: %s)', async (inverted) => {
  pixels = qrPixels(inverted);
  await expect(scanQrImage('blob:qr-image')).resolves.toBe(credential);
  expect(context.fillStyle).toBe('#FFFFFF');
  expect(canvas.width).toBe(0);
  expect(canvas.height).toBe(0);
});

it('returns null for an image without a QR', async () => {
  pixels.data.fill(255);
  await expect(scanQrImage('blob:blank-image')).resolves.toBeNull();
});

it('limits large image dimensions before decoding', async () => {
  naturalWidth = 8000;
  naturalHeight = 4000;
  await scanQrImage('blob:large-image');
  expect(context.getImageData).toHaveBeenCalledWith(0, 0, 2048, 1024);
});

it('rejects unreadable image files', async () => {
  imageFails = true;
  await expect(scanQrImage('blob:bad-image')).rejects.toThrow('Unable to load QR image');
});
