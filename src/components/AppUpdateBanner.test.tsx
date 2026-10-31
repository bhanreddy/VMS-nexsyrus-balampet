/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import AppUpdateBanner from './AppUpdateBanner';
import ForceUpdateScreen from './ForceUpdateScreen';
import type { PlayStoreUpdateController } from '../hooks/usePlayStoreUpdate';
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
const { act, create } = require('react-test-renderer');
let root: ReturnType<typeof create>;
const update = (overrides: Partial<PlayStoreUpdateController> = {}): PlayStoreUpdateController => ({
  showBanner: true, busy: false, error: null, downloaded: false, downloading: false,
  installing: false, progress: null, startUpdate: jest.fn(async () => {}),
  completeUpdate: jest.fn(async () => {}), openStore: jest.fn(async () => {}), dismiss: jest.fn(),
  ...overrides,
});
afterEach(async () => { await act(async () => { root?.unmount(); }); });

it('renders nothing when no update has been confirmed', async () => {
  await act(async () => { root = create(<AppUpdateBanner update={update({ showBanner: false })} />); });
  expect(root.toJSON()).toBeNull();
});

it('connects the banner update and dismiss buttons to the controller', async () => {
  const controller = update();
  await act(async () => { root = create(<AppUpdateBanner update={controller} />); });
  expect(JSON.stringify(root.toJSON())).toContain('A new version is available');
  await act(async () => { root.root.findByProps({ accessibilityLabel: 'Update app now' }).props.onPress(); });
  expect(controller.startUpdate).toHaveBeenCalledTimes(1);
  await act(async () => { root.root.findByProps({ accessibilityLabel: 'Dismiss update reminder' }).props.onPress(); });
  expect(controller.dismiss).toHaveBeenCalledTimes(1);
});

it('shows accessible download progress and removes the start/dismiss controls during a download', async () => {
  await act(async () => { root = create(<AppUpdateBanner update={update({ downloading: true, progress: 37 })} />); });
  expect(JSON.stringify(root.toJSON())).toContain('37%');
  expect(root.root.findByProps({ accessibilityRole: 'progressbar' }).props.accessibilityValue.now).toBe(37);
  expect(root.root.findAllByProps({ accessibilityRole: 'button' })).toHaveLength(0);
});

it('offers restart after download and sends it to completeUpdate', async () => {
  const controller = update({ downloaded: true });
  await act(async () => { root = create(<AppUpdateBanner update={controller} />); });
  expect(JSON.stringify(root.toJSON())).toContain('Restart');
  expect(root.root.findAllByProps({ accessibilityLabel: 'Dismiss update reminder' })).toHaveLength(0);
  await act(async () => { root.root.findByProps({ accessibilityLabel: 'Restart to install update' }).props.onPress(); });
  expect(controller.completeUpdate).toHaveBeenCalledTimes(1);
  expect(controller.startUpdate).not.toHaveBeenCalled();
});

it('connects the required update screen to the immediate-flow action and explicit store fallback', async () => {
  const controller = update();
  await act(async () => { root = create(<ForceUpdateScreen update={controller} />); });
  await act(async () => { root.root.findByProps({ accessibilityRole: 'button' }).props.onPress(); });
  expect(controller.startUpdate).toHaveBeenCalledTimes(1);
  await act(async () => { root.root.findByProps({ accessibilityRole: 'link' }).props.onPress(); });
  expect(controller.openStore).toHaveBeenCalledTimes(1);
});

it('keeps required updates blocked during download and allows restart or retry afterward', async () => {
  await act(async () => { root = create(<ForceUpdateScreen update={update({ downloading: true, progress: 80 })} />); });
  expect(root.root.findByProps({ accessibilityRole: 'button' }).props.disabled).toBe(true);
  expect(JSON.stringify(root.toJSON())).toContain('80%');
  const controller = update({ downloaded: true, error: 'Please retry installation' });
  await act(async () => { root.update(<ForceUpdateScreen update={controller} />); });
  expect(JSON.stringify(root.toJSON())).toContain('Please retry installation');
  await act(async () => { root.root.findByProps({ accessibilityRole: 'button' }).props.onPress(); });
  expect(controller.completeUpdate).toHaveBeenCalledTimes(1);
});
