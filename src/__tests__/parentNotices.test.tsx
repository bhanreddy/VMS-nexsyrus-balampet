/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Text } from 'react-native';
import AnnouncementsScreen from '../../app/Screen/announcements';
import ReadAloudButton from '../components/ReadAloudButton';
const { act, create } = require('react-test-renderer');
let mockError: Error | null = null;
let mockNotices: any[];
const longBody = 'School will reopen on Monday. Please bring all your books and arrive before the morning assembly. '.repeat(4);
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_: string, fallback: any) => typeof fallback === 'string' ? fallback : fallback?.defaultValue, i18n: { language: 'en' } }) }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../features/app-tour', () => ({ TourTarget: ({ children }: any) => children }));
jest.mock('../components/ScreenLayout', () => ({ __esModule: true, default: ({ children }: any) => children }));
jest.mock('../components/StudentHeader', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/ErrorBoundary', () => ({ ErrorBoundary: ({ children }: any) => children }));
jest.mock('../components/LogoLoader', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/ReadAloudButton', () => ({ __esModule: true, default: () => null }));
jest.mock('../services/readAloudService', () => ({ readAloudService: { stop: jest.fn() } }));
jest.mock('../hooks/useTheme', () => ({ useTheme: () => ({ theme: require('../theme/types').defaultLightTheme, isDark: false }) }));
jest.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'parent-1' } }) }));
jest.mock('../hooks/useStudentQuery', () => ({ useStudentQuery: () => ({ data: mockNotices, loading: false, error: mockError, refetch: jest.fn() }) }));
jest.mock('../utils/lang', () => ({ t_field: (english: string) => english }));
let tree: any;
const text = () => tree.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' ');
const button = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
beforeEach(async () => {
  mockError = null;
  mockNotices = [
    { id: 'one', title: 'Exam reminder', content: 'Exam reminder', priority: 'high', author_name: 'School office', created_at: '2026-07-18T10:00:00Z' },
    { id: 'two', title: 'School reopening', content: longBody, priority: 'normal', author_name: 'Principal', created_at: '2026-06-18T10:00:00Z' },
  ];
  await act(async () => { tree = create(<AnnouncementsScreen />); });
});
afterEach(() => { act(() => tree?.unmount()); });
it('expands notice text with a dedicated control while preserving independent read-aloud content', async () => {
  expect(button('Read more: School reopening').props.accessibilityState.expanded).toBe(false);
  await act(async () => { button('Read more: School reopening').props.onPress(); });
  expect(button('Show less: School reopening').props.accessibilityState.expanded).toBe(true);
  expect(tree.root.findAllByType(ReadAloudButton).find((node: any) => node.props.id === 'announcement-two').props.text).toEqual(['School reopening', longBody]);
});
it('filters important notices and avoids repeating a duplicate title in the audio', async () => {
  const audio = tree.root.findAllByType(ReadAloudButton).find((node: any) => node.props.id === 'announcement-one');
  expect(audio.props.text).toEqual(['Exam reminder', undefined]);
  await act(async () => { button('Important, 1').props.onPress(); });
  expect(text()).toContain('Exam reminder');
  expect(text()).not.toContain('School reopening');
});
it('distinguishes a failed load from an empty notice board', async () => {
  mockNotices = [];
  mockError = new Error('Offline');
  await act(async () => { tree.update(<AnnouncementsScreen />); });
  expect(text()).toContain('Unable to load notices');
  expect(text()).not.toContain("You're all caught up");
});
