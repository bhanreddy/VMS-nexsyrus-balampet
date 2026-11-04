/* eslint-disable @typescript-eslint/no-require-imports */
import React from "react";
import DashboardProfileAvatar from "./DashboardProfileAvatar";
import StudentPhoto from "../StudentPhoto";
import QuickAccountPickerSheet from "../QuickAccountPickerSheet";
const { act, create } = require("react-test-renderer");
const mockNext = jest.fn();
const mockOpen = jest.fn();
const mockSelect = jest.fn();
const mockClose = jest.fn();
jest.mock("react-native-reanimated", () => ({
  ...require("react-native-reanimated/mock"),
  useReducedMotion: () => true,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Icon" }));
jest.mock("../StudentPhoto", () => ({ __esModule: true, default: () => null }));
jest.mock("../QuickAccountPickerSheet", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../../hooks/useQuickAccountSwitch", () => ({
  useQuickAccountSwitch: () => ({
    accounts: [{ userId: "a" }, { userId: "b" }],
    activeId: "a",
    sheetOpen: true,
    switching: false,
    switchToNext: mockNext,
    switchTo: mockSelect,
    openSheet: mockOpen,
    closeSheet: mockClose,
  }),
}));
const label =
  "Hold to switch accounts; double-tap the photo for the next account";
let tree: any;
const button = (name: string) =>
  tree.root.findAll(
    (node: any) =>
      node.props.accessibilityLabel === name &&
      typeof node.props.onPress === "function",
  )[0];
const tap = () => {
  const avatar = button(label);
  avatar.props.onPressIn();
  avatar.props.onPress();
};
beforeEach(async () => {
  jest.clearAllMocks();
  mockNext.mockResolvedValue(true);
  mockSelect.mockResolvedValue(true);
  await act(async () => {
    tree = create(
      <DashboardProfileAvatar
        displayName="Nexsyrus Admin"
        photoUrl="https://example.test/avatar.jpg"
        compact
      />,
    );
  });
});
afterEach(() => {
  act(() => tree.unmount());
  jest.restoreAllMocks();
});
it("uses the signed-in user's photo and name", () => {
  expect(tree.root.findByType(StudentPhoto).props).toMatchObject({
    photoUrl: "https://example.test/avatar.jpg",
    displayName: "Nexsyrus Admin",
  });
});
it("cycles once on a double tap, without switching on the first tap", async () => {
  await act(async () => {
    tap();
  });
  expect(mockNext).not.toHaveBeenCalled();
  await act(async () => {
    tap();
  });
  expect(mockNext).toHaveBeenCalledTimes(1);
});
it("does not treat two separate taps as a double tap", async () => {
  const clock = jest.spyOn(Date, "now").mockReturnValue(1000);
  await act(async () => {
    tap();
  });
  clock.mockReturnValue(1400);
  await act(async () => {
    tap();
  });
  expect(mockNext).not.toHaveBeenCalled();
});
it("holds to open the legacy picker and suppresses the release tap", async () => {
  await act(async () => {
    const avatar = button(label);
    avatar.props.onPressIn();
    avatar.props.onLongPress();
    avatar.props.onPress();
  });
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(mockNext).not.toHaveBeenCalled();
  await act(async () => {
    tap();
  });
  expect(mockNext).not.toHaveBeenCalled();
});
it("offers direct picker access and delegates selection to the existing switcher", async () => {
  await act(async () => {
    button("Choose an account").props.onPress();
  });
  expect(mockOpen).toHaveBeenCalledTimes(1);
  await act(async () => {
    await tree.root.findByType(QuickAccountPickerSheet).props.onSelect("b");
  });
  expect(mockSelect).toHaveBeenCalledWith("b");
  tree.root.findByType(QuickAccountPickerSheet).props.onClose();
  expect(mockClose).toHaveBeenCalledTimes(1);
});
it("blocks repeated switching while a cycle is pending and clears the busy state", async () => {
  let finish!: (value: boolean) => void;
  mockNext.mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => {
    tap();
    tap();
    tap();
    tap();
  });
  expect(mockNext).toHaveBeenCalledTimes(1);
  expect(button(label).props.disabled).toBe(true);
  await act(async () => {
    finish(true);
  });
  expect(button(label).props.disabled).toBe(false);
});
it("opens the picker through assistive activation without requiring a double tap", async () => {
  await act(async () => {
    button(label).props.onAccessibilityTap();
  });
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(mockNext).not.toHaveBeenCalled();
});
