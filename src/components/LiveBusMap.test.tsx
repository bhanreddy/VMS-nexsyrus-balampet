/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import LiveBusMap from './LiveBusMap';
const { act, create } = require('react-test-renderer');
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../hooks/useTheme', () => ({ useTheme: () => ({ theme: require('../theme/themes').lightTheme }) }));
jest.mock('./MapWrapper', () => ({ Map: 'Map', Camera: 'Camera', GeoJSONSource: 'Source', Layer: 'Layer', Marker: 'Marker' }));
const stops = [{ id: 'a', name: 'School', latitude: 17, longitude: 78, status: 'completed', exec_order: 1 }, { id: 'b', name: 'Home', latitude: 17.02, longitude: 78.02, status: 'pending', exec_order: 2 }];
let tree: any;
const render = async (props = {}) => { await act(async () => { tree = create(<LiveBusMap stops={stops} busLocation={{ latitude: 17.01, longitude: 78.01 }} {...props} />); }); };
const button = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label)[0];
afterEach(() => act(() => tree?.unmount()));
it('opens with the entire route visible and lets the user follow or fit the route', async () => {
  await render();
  expect(tree.root.findByType('Camera').props.bounds).toBeDefined();
  await act(async () => button('busTracker.recenter_bus').props.onPress());
  expect(tree.root.findByType('Camera').props.center).toEqual([78.01, 17.01]);
  await act(async () => button('busTracker.route_overview').props.onPress());
  expect(tree.root.findByType('Camera').props.bounds).toBeDefined();
});
it('releases camera control on a user gesture and explicitly resumes following', async () => {
  await render();
  await act(async () => tree.root.findByType('Map').props.onRegionWillChange({ nativeEvent: { userInteraction: true } }));
  expect(tree.root.findAllByType('Camera')).toHaveLength(0);
  await act(async () => button('busTracker.recenter_bus').props.onPress());
  expect(tree.root.findAllByType('Camera')).toHaveLength(1);
});
it('can focus a selected stop and return to the bus', async () => {
  await render({ selectedStopId: 'b' });
  expect(tree.root.findByType('Camera').props.center).toEqual([78.02, 17.02]);
  await act(async () => button('busTracker.recenter_bus').props.onPress());
  expect(tree.root.findByType('Camera').props.center).toEqual([78.01, 17.01]);
});
it('does not render malformed GPS or claim a live bus without a fix', async () => {
  await render({ busLocation: { latitude: NaN, longitude: 78 } });
  expect(tree.root.findAllByType('Marker').some((node: any) => node.props.id === 'live-bus-marker')).toBe(false);
  expect(button('busTracker.recenter_bus')).toBeUndefined();
});

it('shows reported GPS uncertainty without making a new GPS coordinate', async () => {
  await render({ accuracy: 20 });
  const sources = tree.root.findAllByType('Source');
  const uncertainty = sources.find((node: any) => node.props.id === 'bus-accuracy-source');
  expect(uncertainty.props.data.features[0].geometry.type).toBe('Polygon');
  expect(tree.root.findAllByType('Marker').find((node: any) => node.props.id === 'live-bus-marker').props.lngLat).toEqual([78.01, 17.01]);
});
