/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Text } from 'react-native';
import Screen from '../../app/admin/live-bus-tracking';
import { api } from '../services/apiClient';
const { act, create } = require('react-test-renderer');
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ routeId: 'a' }) }));
jest.mock('../features/app-tour', () => ({ TourTarget: ({ children }: any) => children, TourScrollView: require('react-native').ScrollView }));
jest.mock('../components/AdminHeader', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/LogoLoader', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/LiveBusMap', () => ({ __esModule: true, default: 'BusMap' }));
jest.mock('../hooks/useTheme', () => ({ useTheme: () => ({ theme: require('../theme/themes').lightTheme }) }));
jest.mock('../hooks/useTransportPolling', () => ({ useTransportPolling: (load: () => Promise<void>, _interval: number, key: string) => { require('react').useEffect(() => { void load(); }, [key]); } }));
jest.mock('../services/apiClient', () => ({ api: { get: jest.fn() } }));
const fleet = [{ route_id: 'a', route_name: 'North route', status: 'in_progress', driver_name: 'Ravi' }, { route_id: 'b', route_name: 'South route', status: 'scheduled' }];
const detail = (id = 'a') => ({ route: id === 'a' ? 'North route' : 'South route', trip: { id, status: 'in_progress', driver_name: 'Ravi' }, location: { latitude: 17, longitude: 78, speed: 30, heading: 90, recorded_at: '2026-11-03T03:00:00Z', is_fresh: true }, stops: [{ id: 's1', name: 'School', latitude: 17, longitude: 78, exec_order: 1, status: 'completed' }, { id: 's2', name: 'Library', latitude: 17.01, longitude: 78.01, exec_order: 2, status: 'pending' }], tracking_health: { automatic_stops_enabled: true, pending_notifications: 2, failed_notifications: 1, oldest_pending_seconds: 10, heartbeat_age_seconds: 0 } });
let tree: any;
const texts = () => tree.root.findAllByType(Text).map((node: any) => [node.props.children].flat().join('')).join(' ');
const buttons = () => tree.root.findAll((node: any) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function');
const byText = (value: string) => buttons().find((node: any) => node.findAllByType(Text).some((text: any) => text.props.children === value));
const render = async () => { await act(async () => { tree = create(<Screen />); }); };
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-11-03T03:00:00Z')); jest.mocked(api.get).mockImplementation(async (path: string) => (path === '/transport/live-today' ? fleet : detail(path.includes('/b/') ? 'b' : 'a')) as any); });
afterEach(() => { act(() => tree?.unmount()); jest.useRealTimers(); jest.clearAllMocks(); });
it('shows route progress, the next stop, real GPS and delivery health', async () => {
  await render();
  expect(texts()).toContain('1 of 2 stops resolved');
  expect(texts()).toContain('Library');
  expect(texts()).toContain('2 pending · 1 failed');
  expect(tree.root.findByType('BusMap').props.isFresh).toBe(true);
});
it('ages the saved GPS locally when the network stops updating', async () => {
  await render();
  await act(async () => { jest.advanceTimersByTime(121000); });
  expect(texts()).toContain('Signal delayed');
  expect(texts()).toContain('Connection delayed');
  expect(tree.root.findByType('BusMap').props.isFresh).toBe(false);
});
it('clears the previous route while switching, and ignores a late response from it', async () => {
  await render();
  let resolveOld: (value: any) => void = () => {};
  jest.mocked(api.get).mockImplementation((path: string) => path === '/transport/live-today' ? Promise.resolve(fleet) : path.includes('/a/') ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve(detail('b')) as any);
  await act(async () => { buttons().find((node: any) => node.props.accessibilityLabel === 'Refresh tracking').props.onPress(); });
  await act(async () => { buttons().find((node: any) => node.props.accessibilityLabel === 'Change route').props.onPress(); });
  await act(async () => { byText('South route').props.onPress(); });
  expect(texts()).toContain('South route');
  expect(tree.root.findByType('BusMap').props.stops).toHaveLength(2);
  await act(async () => { resolveOld({ ...detail(), route: 'WRONG OLD ROUTE' }); });
  expect(texts()).not.toContain('WRONG OLD ROUTE');
});
it('keeps the directory usable if the requested route cannot load', async () => {
  jest.mocked(api.get).mockImplementation(async (path: string) => { if (path === '/transport/live-today') return fleet as any; throw new Error('Unavailable'); });
  await render();
  await act(async () => { buttons().find((node: any) => node.props.accessibilityLabel === 'Change route').props.onPress(); });
  expect(texts()).toContain('North route');
  expect(texts()).toContain('South route');
  expect(texts()).toContain('Choose a route');
});

it('keeps the map prominent on phones with an expandable route selector', async () => {
  await render();
  const picker = buttons().find((node: any) => node.props.accessibilityLabel === 'Change route');
  expect(picker.props.accessibilityState.expanded).toBe(false);
  await act(async () => { picker.props.onPress(); });
  expect(byText('South route')).toBeDefined();
});
