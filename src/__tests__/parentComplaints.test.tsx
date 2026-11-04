/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Text } from 'react-native';
import ComplaintsScreen from '../../app/Screen/complaints';
import ReadAloudButton from '../components/ReadAloudButton';
const { act, create } = require('react-test-renderer');
let mockError: Error | null = null;
let mockRecords: any[];
const longDescription = 'Please discuss this report with the class teacher and review the suggested follow-up. '.repeat(4);
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
jest.mock('../hooks/useStudentQuery', () => ({ useStudentQuery: (endpoint: string) => endpoint.includes('profile') ? { data: { id: 'child-1' }, refetch: jest.fn() } : { data: mockRecords, loading: false, error: mockError, refetch: jest.fn() } }));
jest.mock('../utils/lang', () => ({ t_field: (english: string) => english }));
let tree: any;
const text = () => tree.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' ');
const button = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
beforeEach(async () => {
  mockError = null;
  mockRecords = [
    { id: 'one', title: 'Uniform reminder', description: 'Uniform reminder', priority: 'high', status: 'resolved', category: 'disciplinary', raised_by_name: 'Teacher', created_at: '2026-07-07T10:00:00Z' },
    { id: 'two', title: 'Homework follow-up', description: longDescription, priority: 'medium', status: 'open', category: 'academic', raised_by_name: 'Class teacher', created_at: '2026-06-10T10:00:00Z' },
  ];
  await act(async () => { tree = create(<ComplaintsScreen />); });
});
afterEach(() => { act(() => tree?.unmount()); });
it('filters reports by severity while preserving their resolution status', async () => {
  await act(async () => { button('High, 1').props.onPress(); });
  expect(text()).toContain('Uniform reminder');
  expect(text()).toContain('Resolved');
  expect(text()).not.toContain('Homework follow-up');
});
it('expands full descriptions independently of read-aloud and skips duplicate description audio', async () => {
  expect(button('Read more: Homework follow-up').props.accessibilityState.expanded).toBe(false);
  await act(async () => { button('Read more: Homework follow-up').props.onPress(); });
  expect(button('Show less: Homework follow-up').props.accessibilityState.expanded).toBe(true);
  const audio = tree.root.findAllByType(ReadAloudButton).find((node: any) => node.props.id === 'complaint-one');
  expect(audio.props.text).toEqual(['Uniform reminder', undefined]);
});
it('shows an accurate empty filter state instead of claiming a clean record', async () => {
  await act(async () => { button('Low, 0').props.onPress(); });
  expect(text()).toContain('No reports match this severity.');
  expect(text()).not.toContain('Clean Record');
});
it('shows a load error separately from an empty report list', async () => {
  mockRecords = [];
  mockError = new Error('Offline');
  await act(async () => { tree.update(<ComplaintsScreen />); });
  expect(text()).toContain('Unable to load reports');
  expect(text()).not.toContain('No reports to show');
});
