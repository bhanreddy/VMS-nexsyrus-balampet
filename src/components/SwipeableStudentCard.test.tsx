/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import SwipeableStudentCard from './SwipeableStudentCard';

const { create, act } = require('react-test-renderer');
let mockPanUpdate: (event: { translationX: number }) => void;
let mockPanEnd: () => void;
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useAnimatedStyle: (callback: () => unknown) => callback(),
}));
jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual('react-native-gesture-handler'),
  GestureDetector: ({ children }: any) => children,
  Gesture: {
    Pan: () => {
      const gesture = {
        enabled: () => gesture,
        activeOffsetX: () => gesture,
        failOffsetY: () => gesture,
        onUpdate: (callback: typeof mockPanUpdate) => { mockPanUpdate = callback; return gesture; },
        onEnd: (callback: typeof mockPanEnd) => { mockPanEnd = callback; return gesture; },
      };
      return gesture;
    },
  },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('../hooks/useTheme', () => ({ useTheme: () => ({ theme: require('../theme/types').defaultLightTheme }) }));
jest.mock('../utils/animations', () => ({ HapticFeedback: { light: jest.fn(), success: jest.fn(), error: jest.fn() } }));

const student = { id: 's-1', name: 'Student With A Long Name', rollNo: '1', status: 'unmarked' as const };
const onStatusChange = jest.fn();
let tree: any;
function button(label: string) {
  return tree.root.findAllByType(TouchableOpacity).find((node: any) => node.props.accessibilityLabel === label);
}
async function measureCard(width: number) {
  await act(async () => {
    tree.root.findAllByType(View).find((node: any) => typeof node.props.onLayout === 'function').props.onLayout({
      nativeEvent: { layout: { width, height: 120, x: 0, y: 0 } },
    });
  });
}
beforeEach(async () => {
  jest.clearAllMocks();
  Dimensions.set({ window: { width: 1200, height: 800, scale: 1, fontScale: 1 } });
  await act(async () => { tree = create(<SwipeableStudentCard student={student} onStatusChange={onStatusChange} />); });
});
afterEach(() => { act(() => tree?.unmount()); });

it('stacks actions in a narrow tablet pane and keeps the student tap area at its natural height', async () => {
  await measureCard(460);
  const main = button(`${student.name}, currently marked unmarked. Tap to cycle status between present, absent, and unmarked.`);
  expect(StyleSheet.flatten(main.parent.props.style).flexDirection).toBe('column');
  expect(StyleSheet.flatten(main.props.style).flex).toBe(0);
  act(() => { button(`Mark ${student.name} present`).props.onPress(); });
  expect(onStatusChange).toHaveBeenLastCalledWith('s-1', 'present');
  act(() => { button(`Mark ${student.name} absent`).props.onPress(); });
  expect(onStatusChange).toHaveBeenLastCalledWith('s-1', 'absent');

  await measureCard(800);
  expect(StyleSheet.flatten(main.parent.props.style).flexDirection).toBe('row');
});

it('uses the card width for attendance swipes inside a tablet pane', async () => {
  await measureCard(460);
  act(() => { mockPanUpdate({ translationX: 140 }); mockPanEnd(); });
  expect(onStatusChange).toHaveBeenLastCalledWith('s-1', 'present');
  act(() => { mockPanUpdate({ translationX: -140 }); mockPanEnd(); });
  expect(onStatusChange).toHaveBeenLastCalledWith('s-1', 'absent');
  onStatusChange.mockClear();
  act(() => { mockPanUpdate({ translationX: 100 }); mockPanEnd(); });
  expect(onStatusChange).not.toHaveBeenCalled();
});

it('adapts the actions when tablet text is enlarged', async () => {
  await measureCard(700);
  act(() => { Dimensions.set({ window: { width: 1200, height: 800, scale: 1, fontScale: 1.5 } }); });
  const main = button(`${student.name}, currently marked unmarked. Tap to cycle status between present, absent, and unmarked.`);
  expect(StyleSheet.flatten(main.parent.props.style).flexDirection).toBe('column');
  expect(StyleSheet.flatten(button(`Mark ${student.name} present`).props.style).minHeight).toBeGreaterThanOrEqual(48);
});
