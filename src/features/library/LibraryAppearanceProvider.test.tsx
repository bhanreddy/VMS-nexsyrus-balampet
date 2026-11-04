/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import LibraryAppearanceProvider from './LibraryAppearanceProvider';
import { ThemeContext } from '../../context/ThemeContext';
import { useTheme } from '../../hooks/useTheme';
import { useFlatSurface } from '../../contexts/SurfaceAppearanceContext';
import { defaultLightTheme, defaultDarkTheme } from '../../theme/types';
const { act, create } = require('react-test-renderer');
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
const captured: Record<string, { theme: ReturnType<typeof useTheme>; flat: boolean }> = {};
function Probe({ name }: { name: string }) {
  captured[name] = { theme: useTheme(), flat: useFlatSurface() };
  return null;
}
it('scopes the flat admin palette to the library and retains working theme controls', () => {
  const toggleTheme = jest.fn();
  const render = (isDark: boolean) => <ThemeContext.Provider value={{ theme: isDark ? defaultDarkTheme : defaultLightTheme, isDark, toggleTheme, setTheme: jest.fn() }}>
    <Probe name="outside" />
    <LibraryAppearanceProvider><Probe name="library" /></LibraryAppearanceProvider>
  </ThemeContext.Provider>;
  let tree: any;
  act(() => { tree = create(render(false)); });
  expect(captured.outside.flat).toBe(false);
  expect(captured.outside.theme.theme).toBe(defaultLightTheme);
  expect(captured.library.flat).toBe(true);
  expect(captured.library.theme.theme.colors.background).toBe('#F6F7FB');
  expect(captured.library.theme.theme.shadows.md.elevation).toBe(0);
  captured.library.theme.toggleTheme();
  expect(toggleTheme).toHaveBeenCalledTimes(1);
  act(() => { tree.update(render(true)); });
  expect(captured.library.theme.isDark).toBe(true);
  expect(captured.library.theme.theme.colors.background).toBe('#0D1220');
  expect(captured.library.theme.theme.colors.card).toBe('#151D2D');
  expect(captured.outside.theme.theme).toBe(defaultDarkTheme);
  act(() => tree.unmount());
});
