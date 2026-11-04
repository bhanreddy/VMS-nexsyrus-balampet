/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import Screen from '../../app/Screen/busTracker';
import { Text } from 'react-native';
import { api } from '../services/apiClient';
const { act, create } = require('react-test-renderer');
jest.mock('../utils/lang', () => ({ isTelugu: () => false }));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
jest.mock('../features/app-tour', () => ({ TourTarget: ({ children }: any) => children, TourScrollView: require('react-native').ScrollView }));
jest.mock('../components/StudentHeader', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/ScreenLayout', () => ({ __esModule: true, default: ({ children }: any) => children }));
jest.mock('../components/LogoLoader', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/LiveBusMap', () => ({ __esModule: true, default: 'BusMap' }));
jest.mock('../components/LiveRouteTracker', () => ({ __esModule: true, default: 'RouteTracker' }));
jest.mock('../hooks/useTheme', () => ({ useTheme: () => ({ theme: require('../theme/themes').lightTheme }) }));
jest.mock('../hooks/useTransportPolling', () => ({ useTransportPolling: (load: () => Promise<void>) => { require('react').useEffect(() => { void load(); }, []); } }));
jest.mock('../services/busAttendanceService', () => ({ BusAttendanceService: { getMyAttendance: async () => [] } }));
jest.mock('../services/apiClient', () => ({ api: { get: jest.fn() } }));
const stops = [{ id: 'a', name: 'School', stop_order: 1, exec_order: 1, latitude: 17, longitude: 78, status: 'completed' }, { id: 'b', name: 'Library', stop_order: 2, exec_order: 2, latitude: 17.01, longitude: 78.01, status: 'pending' }];
const trip = { id: 'trip-1', status: 'in_progress', started_at: '2026-11-03T02:50:00Z' };
let assignment: any;
let live: any;
let tree: any;
beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-11-03T03:00:00Z'));
  assignment = { assigned: true, route_name: 'North route', trip, stops, boarding_stop_id: 'b', boarding_stop: 'Library' };
  live = { assigned: true, live: true, trip, stops, eta_minutes: 3, location: { latitude: 17, longitude: 78, speed: 30, heading: 90, recorded_at: '2026-11-03T03:00:00Z', is_fresh: true } };
  jest.mocked(api.get).mockImplementation(async (path: string) => path.endsWith('/live') ? live : assignment);
});
afterEach(() => { act(() => tree?.unmount()); jest.useRealTimers(); jest.clearAllMocks(); });
const render = async () => { await act(async () => { tree = create(<Screen />); }); };
it('opens the parent street map with the boarding stop and real current-trip fix', async () => {
  await render();
  const props = tree.root.findByType('BusMap').props;
  expect(props.boardingStopId).toBe('b');
  expect(props.busLocation).toEqual({ latitude: 17, longitude: 78 });
  expect(props.isFresh).toBe(true);
});
it('does not reuse another trip’s GPS even when the timestamp is recent', async () => {
  live.trip = { ...trip, id: 'old-trip' };
  await render();
  expect(tree.root.findByType('BusMap').props.busLocation).toBeNull();
  expect(tree.root.findByType('BusMap').props.isFresh).toBe(false);
});
it('ages a previously fresh fix without waiting for the next response', async () => {
  await render();
  await act(async () => { jest.advanceTimersByTime(121000); });
  expect(tree.root.findByType('BusMap').props.isFresh).toBe(false);
});
it('shows scheduled route geometry without inventing a bus position', async () => {
  assignment.trip = { ...trip, status: 'scheduled' };
  live = { assigned: true, live: false };
  await render();
  expect(tree.root.findByType('BusMap').props.stops).toHaveLength(2);
  expect(tree.root.findByType('BusMap').props.busLocation).toBeNull();
});

it('keeps the street map on observed GPS instead of projecting across unobserved turns', async () => {
  live.location.recorded_at = '2026-11-03T02:59:50Z';
  await render();
  expect(tree.root.findByType('BusMap').props.busLocation).toEqual({ latitude: 17, longitude: 78 });
});
it('switches explicitly to the diagram when a parent starts a route simulation', async () => {
  assignment.trip = { ...trip, status: 'scheduled' };
  live = { assigned: true, live: false };
  await render();
  const start = tree.root.findAll((node: any) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')
    .find((node: any) => node.findAllByType(Text).some((text: any) => text.props.children === 'busTracker.start'));
  await act(async () => { start.props.onPress(); });
  expect(tree.root.findAllByType('BusMap')).toHaveLength(0);
  expect(tree.root.findAllByType('RouteTracker')).toHaveLength(1);
});

it('marks fixes older than thirty seconds as delayed and passes the accuracy radius to the map', async () => {
  live.location.recorded_at = '2026-11-03T02:59:29Z';
  live.location.accuracy = 35;
  await render();
  const props = tree.root.findByType('BusMap').props;
  expect(props.isFresh).toBe(false);
  expect(props.accuracy).toBe(35);
});
