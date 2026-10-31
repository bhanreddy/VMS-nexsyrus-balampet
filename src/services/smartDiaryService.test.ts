import { Platform } from 'react-native';
import { SmartDiaryService } from './smartDiaryService';
import { api } from './apiClient';
jest.mock('./apiClient', () => ({ api: { uploadFormData: jest.fn(async () => ({ attachments: [] })) } }));

afterEach(() => jest.restoreAllMocks());

it('uploads browser image bytes as files instead of serializing native URI objects', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const blob = new Blob(['photo'], { type: 'image/jpeg' });
  const append = jest.fn();
  jest.spyOn(global, 'FormData').mockImplementation(() => ({ append } as unknown as FormData));
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, blob: async () => blob } as Response);
  await SmartDiaryService.uploadPhotos(['data:image/jpeg;base64,cGhvdG8=']);
  expect(append).toHaveBeenCalledWith('photos', blob, 'diary-0.jpg');
  expect(api.uploadFormData).toHaveBeenCalledWith('/diary/smart/upload', expect.anything(), expect.anything());
});

it('stops before publishing an unreadable browser file', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
  await expect(SmartDiaryService.extractPhotos(['blob:expired'])).rejects.toThrow('Could not read the selected diary file');
});
