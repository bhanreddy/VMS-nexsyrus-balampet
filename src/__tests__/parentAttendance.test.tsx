/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Text } from 'react-native';
import AttendanceScreen from '../../app/Screen/attendance';
import { useStudentQuery } from '../hooks/useStudentQuery';
const { act, create } = require('react-test-renderer');

const mockRefetch = jest.fn();
const mockProfileRefetch = jest.fn();
let mockRole = 'parent';
let mockError: Error | null = null;
const mockRecords = [
  { attendance_date: '2026-10-09', status: 'absent' },
  { attendance_date: '2026-10-20T00:00:00.000Z', status: 'present' },
  { attendance_date: '2026-10-21', status: 'half_day' },
  { attendance_date: '2026-10-22', status: 'late' },
];
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback, i18n: { language: 'en' } }) }));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('../hooks/useAttendanceHistory', () => ({ useAttendanceHistory: () => ({ records: [], total: 0, hasMore: false, loading: false, error: false, loadMore: jest.fn(), retry: jest.fn(), refresh: jest.fn() }) }));
jest.mock('../utils/lang', () => ({ isTelugu: () => false }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../features/app-tour', () => ({ TourTarget: ({ children }: any) => children }));
jest.mock('../components/ScreenLayout', () => ({ __esModule: true, default: ({ children }: any) => children }));
jest.mock('../components/StudentHeader', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/ErrorBoundary', () => ({ ErrorBoundary: ({ children }: any) => children }));
jest.mock('../components/LogoLoader', () => ({ __esModule: true, default: () => null }));
jest.mock('../hooks/useTheme', () => ({ useTheme: () => ({ theme: require('../theme/themes').lightTheme }) }));
jest.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'parent-1' }, role: mockRole }) }));
jest.mock('../hooks/useStudentQuery', () => ({ useStudentQuery: jest.fn((endpoint: string) => endpoint === '/students/profile/me'
  ? { data: { id: 'child-1' }, loading: false, error: null, refetch: mockProfileRefetch }
  : { data: { records: mockRecords, summary: { present: 1, absent: 1, late: 1, half_day: 1, total: 4, attendance_percentage: 62.5 } }, loading: false, error: mockError, refetch: mockRefetch }) }));

let tree: any;
const text = () => tree.root.findAllByType(Text).map((node: any) => Array.isArray(node.props.children) ? node.props.children.join('') : node.props.children).join(' ');
const button = (label: string) => tree.root.findAll((node: any) => typeof node.props.onPress === 'function' && node.props.accessibilityLabel === label)[0];
async function render() { await act(async () => { tree = create(<AttendanceScreen />); }); }
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 20, 12));
  jest.clearAllMocks();
  mockRole = 'parent';
  mockError = null;
});
afterEach(() => { act(() => tree?.unmount()); jest.useRealTimers(); });

it('loads the full selected month for parent accounts and uses the weighted server percentage', async () => {
  await render();
  expect(useStudentQuery).toHaveBeenLastCalledWith('/students/child-1/attendance', 'attendance:child-1:2026-10-01', 90000, 'parent-1', { enabled: true, query: { from_date: '2026-10-01', to_date: '2026-10-31' } });
  expect(text()).toContain('October 2026');
  expect(text()).toContain('63%');
  expect(button('20 October 2026, Present').props.accessibilityState.selected).toBe(true);
});

it('selects a recorded day and shows its actual status', async () => {
  await render();
  await act(async () => { button('9 October 2026, Absent').props.onPress(); });
  expect(button('9 October 2026, Absent').props.accessibilityState.selected).toBe(true);
  expect(text()).toContain('Friday, 9 October 2026');
});

it('changes the requested date range across a year boundary and clears old month records', async () => {
  await render();
  for (let i = 0; i < 3; i++) await act(async () => { button('Next month').props.onPress(); });
  expect(useStudentQuery).toHaveBeenLastCalledWith('/students/child-1/attendance', 'attendance:child-1:2027-01-01', 90000, 'parent-1', { enabled: true, query: { from_date: '2027-01-01', to_date: '2027-01-31' } });
  expect(button('20 October 2026, Present')).toBeUndefined();
  expect(text()).toContain('No attendance records for this month.');
  await act(async () => { button('Previous month').props.onPress(); });
  expect(text()).toContain('December 2026');
});

it('keeps adjacent-month cells disabled and distinguishes late and half-day statuses', async () => {
  await render();
  expect(button('27 September 2026, No attendance recorded').props.disabled).toBe(true);
  expect(button('21 October 2026, Half Day')).toBeDefined();
  expect(button('22 October 2026, Late')).toBeDefined();
  expect(text()).toContain('Half Day');
});

it('includes leap day in the calendar and the requested date range', async () => {
  jest.setSystemTime(new Date(2032, 1, 20, 12));
  await render();
  expect(useStudentQuery).toHaveBeenLastCalledWith('/students/child-1/attendance', 'attendance:child-1:2032-02-01', 90000, 'parent-1', { enabled: true, query: { from_date: '2032-02-01', to_date: '2032-02-29' } });
  expect(button('29 February 2032, No attendance recorded')).toBeDefined();
  expect(new Set(tree.root.findAll((node: any) => node.props.accessibilityRole === 'button').map((node: any) => node.props.accessibilityLabel)).size).toBe(38);
});

it('shows a retry action when attendance cannot load', async () => {
  mockError = new Error('Network unavailable');
  await render();
  expect(text()).toContain('Could not load attendance.');
  const retry = tree.root.findAll((node: any) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function' && !node.props.accessibilityLabel)[0];
  await act(async () => { await retry.props.onPress(); });
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});

it('renders a sixth week when the end of the month needs it', async () => {
  jest.setSystemTime(new Date(2026, 7, 1, 12));
  await render();
  expect(button('31 August 2026, No attendance recorded')).toBeDefined();
  expect(new Set(tree.root.findAll((node: any) => node.props.accessibilityRole === 'button').map((node: any) => node.props.accessibilityLabel)).size).toBe(45);
});

it('opens a past month on its latest recorded day and can return to today', async () => {
  jest.setSystemTime(new Date(2026, 10, 1, 12));
  await render();
  await act(async () => { button('Previous month').props.onPress(); });
  expect(button('22 October 2026, Late').props.accessibilityState.selected).toBe(true);
  await act(async () => { button('Go to today').props.onPress(); });
  expect(button('1 November 2026, No attendance recorded').props.accessibilityState.selected).toBe(true);
});

it('explains half-day weighting and omits unused leave status from the legend', async () => {
  await render();
  expect(text()).toContain('A half day counts as ½ day of attendance.');
  expect(text()).toContain('4 recorded days');
  expect(text()).not.toContain('On Leave');
});
