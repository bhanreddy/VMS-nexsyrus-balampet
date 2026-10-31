/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Image, Text } from 'react-native';
import DiaryPhotoViewer from './DiaryPhotoViewer';
import DiaryGeminiHelp from './DiaryGeminiHelp';
import { DiaryPhotoStrip } from './DiaryPhotoStrip';
import { shareDiaryPdf, shareDiaryPhoto } from './document/diaryPhotoFiles';
const { create, act } = require('react-test-renderer');
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('./document/diaryPhotoFiles', () => ({ shareDiaryPdf: jest.fn(async () => {}), shareDiaryPhoto: jest.fn(async () => {}) }));
jest.mock('./DiaryGeminiHelp', () => ({ __esModule: true, default: () => null }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, fallback?: string) => fallback || key }) }));
let tree: any;
const photos = ['https://school.test/one.jpg', 'https://school.test/two.jpg', 'https://school.test/three.jpg', 'https://school.test/four.jpg'];
const tool = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const text = () => tree.root.findAllByType(Text).map((node: any) => String(node.props.children)).join(' ');
const image = () => tree.root.findAllByType(Image).find((node: any) => node.props.accessibilityLabel?.startsWith('Diary page'));
async function renderViewer() { await act(async () => { tree = create(<DiaryPhotoViewer photos={photos} initialIndex={1} onClose={jest.fn()} />); }); }
async function ready() { await act(async () => image().props.onLoad({ nativeEvent: { source: { width: 1000, height: 1500 } } })); }
async function press(label: string) { await act(async () => tool(label).props.onPress()); }
beforeEach(() => jest.clearAllMocks());
afterEach(() => { act(() => tree?.unmount()); });

it('navigates every page and resets zoom when switching pages', async () => {
  await renderViewer(); await ready(); await press('Zoom in');
  expect(text()).toContain('125');
  await press('Next page');
  expect(image().props.source.uri).toBe(photos[2]);
  expect(text()).toContain('100');
  await press('View page 4');
  expect(image().props.source.uri).toBe(photos[3]);
  expect(tool('Next page').props.disabled).toBe(true);
});

it('retries failed images and exports the current image or all pages', async () => {
  await renderViewer();
  await act(async () => image().props.onError());
  expect(tool('Retry photo')).toBeDefined();
  expect(tool('Save / share').props.disabled).toBe(true);
  await press('Retry photo'); await ready();
  await press('Save / share');
  expect(shareDiaryPhoto).toHaveBeenCalledWith(photos[1]);
  await press('All pages PDF');
  expect(shareDiaryPdf).toHaveBeenCalledWith(photos);
});

it('accepts browser image load events and reports export failures', async () => {
  await renderViewer();
  await act(async () => image().props.onLoad({ target: { naturalWidth: 1200, naturalHeight: 800 } }));
  expect(tool('Save / share').props.disabled).toBe(false);
  (shareDiaryPhoto as jest.Mock).mockRejectedValueOnce(new Error('Network unavailable'));
  await press('Save / share');
  expect(text()).toContain('Network unavailable');
});

it('opens the fourth attachment in the shared viewer', async () => {
  await act(async () => { tree = create(<DiaryPhotoStrip attachments={photos} />); });
  await press('View diary page 4');
  expect(tree.root.findByType(DiaryPhotoViewer).props.initialIndex).toBe(3);
  expect(tree.root.findByType(DiaryPhotoViewer).props.photos).toEqual(photos);
});


it('offers Gemini only when enabled for the parent viewer and uses the selected page', async () => {
  await renderViewer(); await ready();
  expect(tool('Ask Gemini · Telugu')).toBeUndefined();
  await act(async () => tree.update(<DiaryPhotoViewer photos={photos} initialIndex={1} allowGemini onClose={jest.fn()} />));
  await press('Ask Gemini · Telugu');
  expect(tree.root.findByType(DiaryGeminiHelp).props.uri).toBe(photos[1]);
  await act(async () => tree.root.findByType(DiaryGeminiHelp).props.onClose());
  expect(tree.root.findAllByType(DiaryGeminiHelp)).toHaveLength(0);
});

it('opens the Gemini guide directly from a parent diary photo action', async () => {
  await act(async () => { tree = create(<DiaryPhotoViewer photos={photos} initialIndex={3} allowGemini initialGeminiOpen onClose={jest.fn()} />); });
  expect(tree.root.findByType(DiaryGeminiHelp).props.uri).toBe(photos[3]);
});
