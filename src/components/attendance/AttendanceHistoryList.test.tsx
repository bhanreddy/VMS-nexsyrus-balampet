/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { FlatList, RefreshControl, Text } from 'react-native';
import AttendanceHistoryList from './AttendanceHistoryList';
const { act, create } = require('react-test-renderer');
const mockLoadMore = jest.fn();
const mockRefreshHistory = jest.fn();
const mockRefreshMonth = jest.fn();
const mockRecords = [
  { attendance_date: '2026-11-01', status: 'present' },
  { attendance_date: '2026-09-30', status: 'half_day' },
];
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useAnimatedStyle: (style: () => unknown) => style() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_: string, fallback: string) => fallback }) }));
jest.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ theme: require('../../theme/themes').lightTheme }) }));
jest.mock('../../hooks/useAttendanceHistory', () => ({ useAttendanceHistory: () => ({ records: mockRecords, hasMore: true, loading: false, error: false, loadMore: mockLoadMore, refresh: mockRefreshHistory }) }));
let tree: any;
beforeEach(async () => {
  jest.clearAllMocks();
  await act(async () => { tree = create(<AttendanceHistoryList studentId="child-1" userId="parent-1" enabled dateLocale="en-IN" header={<Text>Calendar</Text>} onRefresh={mockRefreshMonth} />); });
});
afterEach(() => { act(() => tree?.unmount()); });
const list = () => tree.root.findByType(FlatList);
it('keeps records across months and requests the next page at the end of the list', () => {
  expect(list().props.data).toEqual(mockRecords);
  list().props.onEndReached();
  expect(mockLoadMore).toHaveBeenCalledTimes(1);
});
it('reveals each card when it enters the viewport and retains the reveal after it leaves', async () => {
  expect(list().props.extraData.size).toBe(0);
  await act(async () => { list().props.onViewableItemsChanged({ viewableItems: [{ item: mockRecords[0], isViewable: true }] }); });
  expect(list().props.extraData.has('2026-11-01')).toBe(true);
  expect(list().props.extraData.has('2026-09-30')).toBe(false);
  await act(async () => { list().props.onViewableItemsChanged({ viewableItems: [{ item: mockRecords[1], isViewable: true }] }); });
  expect(list().props.extraData.size).toBe(2);
});
it('refreshes both the monthly calendar and complete history', async () => {
  await act(async () => { await tree.root.findByType(RefreshControl).props.onRefresh(); });
  expect(mockRefreshHistory).toHaveBeenCalledTimes(1);
  expect(mockRefreshMonth).toHaveBeenCalledTimes(1);
});

it('keeps cards fully visible even before any viewport callback is delivered', () => {
  const cards = tree.root.findAll((node: any) => Array.isArray(node.props.style) && node.props.style[0]?.borderRadius === 16 && typeof node.props.style[1]?.opacity === 'number');
  expect(cards.length).toBeGreaterThanOrEqual(mockRecords.length);
  for (const card of cards) expect(card.props.style[1].opacity).toBe(1);
});

it('loads the next page from scroll geometry even if end-reached callbacks are delayed', () => {
  list().props.onScroll({ nativeEvent: { contentOffset: { y: 1400 }, layoutMeasurement: { height: 600 }, contentSize: { height: 2200 } } });
  expect(mockLoadMore).toHaveBeenCalledTimes(1);
});
