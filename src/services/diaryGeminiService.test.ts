import { Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import { DiaryGeminiShare } from '../../modules/diary-gemini-share';
import { askGeminiWithDiaryPhoto, copyDiaryGeminiQuestion, DIARY_TELUGU_PROMPT, GEMINI_WEBSITE, openGeminiWebsite } from './diaryGeminiService';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ getContentUriAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ SaveFormat: { JPEG: 'jpeg' }, manipulateAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('../../modules/diary-gemini-share', () => ({ DiaryGeminiShare: { isSupported: true, shareImage: jest.fn() } }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'android');
  DiaryGeminiShare.isSupported = true;
  (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(true);
  (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({ uri: 'file://cache/diary.jpg' });
  (FileSystem.getContentUriAsync as jest.Mock).mockResolvedValue('content://school/photo');
  (DiaryGeminiShare.shareImage as jest.Mock).mockResolvedValue('opened');
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
});
afterEach(() => jest.restoreAllMocks());

it('opens Android Gemini with an image URI and editable Telugu question, copying it for fallback', async () => {
  expect(await askGeminiWithDiaryPhoto('https://school.test/page.jpg', DIARY_TELUGU_PROMPT)).toBe('opened');
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith(DIARY_TELUGU_PROMPT);
  expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith('https://school.test/page.jpg', [], expect.objectContaining({ format: 'jpeg' }));
  expect(DiaryGeminiShare.shareImage).toHaveBeenCalledWith('content://school/photo', DIARY_TELUGU_PROMPT);
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});

it.each([true, false])('falls back to system sharing when direct launching is unavailable (native=%s)', async (native) => {
  DiaryGeminiShare.isSupported = native;
  (DiaryGeminiShare.shareImage as jest.Mock).mockResolvedValue('unavailable');
  expect(await askGeminiWithDiaryPhoto('https://school.test/page.jpg', '  తెలుగులో వివరించండి  ')).toBe('share-menu');
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith('తెలుగులో వివరించండి');
  expect(Sharing.shareAsync).toHaveBeenCalledWith('file://cache/diary.jpg', expect.objectContaining({ mimeType: 'image/jpeg' }));
});

it('uses the iOS share menu without invoking the Android module', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  expect(await askGeminiWithDiaryPhoto('file://photo.jpg', DIARY_TELUGU_PROMPT)).toBe('share-menu');
  expect(DiaryGeminiShare.shareImage).not.toHaveBeenCalled();
  expect(FileSystem.getContentUriAsync).not.toHaveBeenCalled();
});

it('keeps web attachment manual and opens only the public Gemini URL', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  expect(await askGeminiWithDiaryPhoto('https://private.test/photo?token=secret', DIARY_TELUGU_PROMPT)).toBe('manual');
  expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
  await openGeminiWebsite();
  expect(open).toHaveBeenCalledWith(GEMINI_WEBSITE);
});

it('does not launch another app after a cancelled photo preparation', async () => {
  const controller = new AbortController();
  (ImageManipulator.manipulateAsync as jest.Mock).mockImplementation(async () => { controller.abort(); return { uri: 'file://cancelled.jpg' }; });
  await expect(askGeminiWithDiaryPhoto('file://photo.jpg', DIARY_TELUGU_PROMPT, controller.signal)).rejects.toThrow('cancelled');
  expect(DiaryGeminiShare.shareImage).not.toHaveBeenCalled();
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});

it('keeps failures local when the question cannot be copied or the photo cannot be read', async () => {
  (Clipboard.setStringAsync as jest.Mock).mockResolvedValueOnce(false);
  await expect(askGeminiWithDiaryPhoto('file://photo.jpg', DIARY_TELUGU_PROMPT)).rejects.toThrow('Could not copy');
  expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
  (ImageManipulator.manipulateAsync as jest.Mock).mockRejectedValueOnce(new Error('Photo expired'));
  await expect(askGeminiWithDiaryPhoto('file://photo.jpg', DIARY_TELUGU_PROMPT)).rejects.toThrow('Photo expired');
  expect(DiaryGeminiShare.shareImage).not.toHaveBeenCalled();
});

it('requires a question and gives manual steps when sharing is unavailable', async () => {
  await expect(copyDiaryGeminiQuestion(' ')).rejects.toThrow('enter a question');
  DiaryGeminiShare.isSupported = false;
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);
  expect(await askGeminiWithDiaryPhoto('file://photo.jpg', DIARY_TELUGU_PROMPT)).toBe('manual');
});
