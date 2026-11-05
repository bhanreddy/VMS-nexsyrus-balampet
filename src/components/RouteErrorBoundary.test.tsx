/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Text } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import RouteErrorBoundary from './RouteErrorBoundary';
const renderer = require('react-test-renderer');
const { act } = renderer;

it('shows a retry action for the error and retry props supplied by Expo Router', async () => {
  const error = new Error('startup render failed');
  const retry = jest.fn(async () => {});
  const hide = jest.spyOn(SplashScreen, 'hideAsync').mockResolvedValue(undefined);
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  let root: any;
  try {
    await act(async () => { root = renderer.create(<RouteErrorBoundary error={error} retry={retry} />); });
    expect(root.root.findAllByType(Text).map((node: any) => node.props.children)).toContain('Unable to open the app');
    expect(hide).toHaveBeenCalled();
    await act(async () => { root.root.findAll((node: any) => node.props.accessibilityRole === 'button' && node.props.onPress)[0].props.onPress(); });
    expect(retry).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => { root?.unmount(); });
    hide.mockRestore();
    log.mockRestore();
  }
});
