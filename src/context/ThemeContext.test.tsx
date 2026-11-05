/* eslint-disable import/first, @typescript-eslint/no-require-imports */
jest.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
import React, { useContext } from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext, ThemeProvider } from './ThemeContext';
const renderer = require('react-test-renderer');
const { act } = renderer;

it('renders immediately even if the stored theme never arrives', async () => {
  (AsyncStorage.getItem as jest.Mock).mockReturnValueOnce(new Promise(() => {}));
  let root: any;
  await act(async () => {
    root = renderer.create(<ThemeProvider><Text>App content</Text></ThemeProvider>);
  });
  expect(root.root.findByType(Text).props.children).toBe('App content');
  await act(async () => { root.unmount(); });
});

it('applies a saved dark preference after first render', async () => {
  let finish!: (value: string) => void;
  (AsyncStorage.getItem as jest.Mock).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  function Probe() { return <Text>{useContext(ThemeContext).isDark ? 'dark' : 'light'}</Text>; }
  let root: any;
  await act(async () => { root = renderer.create(<ThemeProvider><Probe /></ThemeProvider>); });
  expect(root.root.findByType(Text).props.children).toBe('light');
  await act(async () => { finish('dark'); });
  expect(root.root.findByType(Text).props.children).toBe('dark');
  await act(async () => { root.unmount(); });
});
