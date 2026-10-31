/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Text, TextInput } from 'react-native';
import DiaryGeminiHelp from './DiaryGeminiHelp';
import { askGeminiWithDiaryPhoto, copyDiaryGeminiQuestion, DIARY_TELUGU_PROMPT } from '../../services/diaryGeminiService';
const { create, act } = require('react-test-renderer');
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key.split('.').reduce((value: any, part: string) => value?.[part], require('../../Locale/en.json')) || key }) }));
jest.mock('../AppTextInput', () => ({ __esModule: true, default: require('react-native').TextInput }));
jest.mock('../../services/diaryGeminiService', () => ({
  DIARY_TELUGU_PROMPT: 'హోంవర్క్‌ను సులభమైన తెలుగులో వివరించండి.',
  askGeminiWithDiaryPhoto: jest.fn(async () => 'opened'), copyDiaryGeminiQuestion: jest.fn(async () => {}),
  openGeminiWebsite: jest.fn(), GEMINI_PLAY_STORE: 'https://play.google.com/store/apps/details?id=com.google.android.apps.bard',
}));
jest.mock('./document/diaryPhotoFiles', () => ({ shareDiaryPhoto: jest.fn() }));
let tree: any;
const button = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const text = () => tree.root.findAllByType(Text).map((node: any) => String(node.props.children)).join(' ');
async function render() { await act(async () => { tree = create(<DiaryGeminiHelp uri="https://school.test/selected-page.jpg" onClose={jest.fn()} />); }); }
beforeEach(() => { jest.clearAllMocks(); });
afterEach(() => { act(() => tree?.unmount()); });

it('lets the parent customize the Telugu question before opening Gemini with the selected photo', async () => {
  await render();
  expect(tree.root.findByType(TextInput).props.value).toBe(DIARY_TELUGU_PROMPT);
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('గణితం హోంవర్క్ తెలుగులో వివరించండి.'));
  await act(async () => button('Open Gemini with photo').props.onPress());
  expect(askGeminiWithDiaryPhoto).toHaveBeenCalledWith('https://school.test/selected-page.jpg', 'గణితం హోంవర్క్ తెలుగులో వివరించండి.', expect.anything());
  expect(text()).toContain('If the question is blank');
});

it('copies the question independently and leaves the guide open after a failed handoff', async () => {
  await render();
  await act(async () => button('Copy Telugu question').props.onPress());
  expect(copyDiaryGeminiQuestion).toHaveBeenCalledWith(DIARY_TELUGU_PROMPT);
  (askGeminiWithDiaryPhoto as jest.Mock).mockRejectedValueOnce(new Error('Photo expired'));
  await act(async () => button('Open Gemini with photo').props.onPress());
  expect(text()).toContain('Could not complete this step');
  expect(button('Open Gemini website')).toBeDefined();
});
