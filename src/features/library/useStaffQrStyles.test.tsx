/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { useStaffQrStyles } from './useStaffQrStyles';
import { defaultLightTheme, defaultDarkTheme } from '../../theme/types';
const { create, act } = require('react-test-renderer');
let mockDark = false;
jest.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ theme: mockDark ? require('../../theme/types').defaultDarkTheme : require('../../theme/types').defaultLightTheme, isDark: mockDark }) }));
const base: Record<string, { color?: string; backgroundColor?: string; borderRadius?: number; boxShadow?: string }> = Object.fromEntries(['content','hero','heroTitle','heroCopy','darkCard','tableHeader','studentRow','avatar','avatarText','workingBanner','pickerOptionActive','busyOverlay','searchBox','primaryAction','qrPreviewWrap','previewSchool'].map((key) => [key, {}]));
Object.assign(base.heroTitle, { color: '#0F172A' });
Object.assign(base.primaryAction, { backgroundColor: '#0F766E' });
Object.assign(base.qrPreviewWrap, { backgroundColor: '#FFFFFF' });
Object.assign(base.previewSchool, { color: '#0F172A' });
let current: typeof base;
let tree: any;
function Probe({ enabled }: { enabled: boolean }) { current = useStaffQrStyles(base, enabled); return null; }
beforeEach(() => { mockDark = false; });
afterEach(() => { act(() => tree?.unmount()); });
it('applies flat surfaces to library QR tools and preserves printable QR paper in dark mode', () => {
  act(() => { tree = create(<Probe enabled />); });
  expect(current.primaryAction.backgroundColor).toBe(defaultLightTheme.colors.primary);
  expect(current.hero.borderRadius).toBe(16);
  expect(current.hero.boxShadow).toBe('none');
  expect(current.searchBox.boxShadow).toBe('none');
  mockDark = true;
  act(() => { tree.update(<Probe enabled />); });
  expect(current.heroTitle.color).toBe(defaultDarkTheme.colors.textStrong);
  expect(current.qrPreviewWrap.backgroundColor).toBe('#FFFFFF');
  expect(current.previewSchool.color).toBe('#0F172A');
  expect(base.heroTitle.color).toBe('#0F172A');
});
it('retains existing QR styles outside the librarian portal', () => {
  act(() => { tree = create(<Probe enabled={false} />); });
  expect(current).toBe(base);
});
