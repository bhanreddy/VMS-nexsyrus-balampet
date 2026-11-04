/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import StudentHero from './StudentHero';
import HeroSlidesCarousel from '../hero-slides/HeroSlidesCarousel';
import SchoolStoriesStrip from '../school-stories/SchoolStoriesStrip';
const { act, create } = require('react-test-renderer');
const mockOpenSheet = jest.fn();
const mockNext = jest.fn().mockResolvedValue(true);
const mockView = jest.fn();
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_: string, fallback: any) => typeof fallback === 'string' ? fallback : fallback?.defaultValue }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ theme: require('../../theme/types').defaultLightTheme, isDark: false }) }));
jest.mock('../../hooks/useQuickAccountSwitch', () => ({ useQuickAccountSwitch: () => ({ accounts: [{ userId: 'one' }, { userId: 'two' }], activeId: 'one', sheetOpen: false, switching: false, switchToNext: mockNext, switchTo: jest.fn(), openSheet: mockOpenSheet, closeSheet: jest.fn() }) }));
jest.mock('../StudentPhoto', () => ({ __esModule: true, default: () => null }));
jest.mock('../QuickAccountPickerSheet', () => ({ __esModule: true, default: () => null }));
jest.mock('../hero-slides/HeroSlidesCarousel', () => ({ __esModule: true, default: () => null }));
jest.mock('../school-stories/SchoolStoriesStrip', () => ({ __esModule: true, default: () => null }));
let tree: any;
const button = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
beforeEach(async () => { jest.clearAllMocks(); await act(async () => { tree = create(<StudentHero firstName="Bharath" classLabel="Class 10 A" inchargeLabel="Incharge · Arun Kura" unreadCount={0} slides={[]} stories={[]} onViewNotifications={mockView} />); }); });
afterEach(() => { act(() => tree?.unmount()); });
it('opens notifications with a meaningful accessible empty-notification label', () => {
  button('No urgent notifications. View notifications').props.onPress();
  expect(mockView).toHaveBeenCalledTimes(1);
});
it('provides direct access to the account picker without switching immediately', () => {
  button('Switch student').props.onPress();
  expect(mockOpenSheet).toHaveBeenCalledTimes(1);
  expect(mockNext).not.toHaveBeenCalled();
});
it('preserves the photo double-tap shortcut for switching to the next account', async () => {
  const avatar = button('Hold to switch accounts; double-tap the photo for the next account');
  await act(async () => { avatar.props.onPress(); avatar.props.onPress(); });
  expect(mockNext).toHaveBeenCalledTimes(1);
});
it('passes the current surface tone to slides and stories', () => {
  expect(tree.root.findByType(HeroSlidesCarousel).props.dotTone).toBe('onLight');
  expect(tree.root.findByType(SchoolStoriesStrip).props.tone).toBe('onLight');
});
