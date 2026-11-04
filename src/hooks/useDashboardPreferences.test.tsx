/* eslint-disable @typescript-eslint/no-require-imports */
import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  defaultDashboardPreferences,
  parseDashboardPreferences,
  useDashboardPreferences,
} from "./useDashboardPreferences";
const { create, act } = require("react-test-renderer");
jest.mock("../constants/school", () => ({ SCHOOL_ID: 12 }));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));
it("recovers a usable layout from malformed or obsolete settings", () => {
  expect(parseDashboardPreferences("broken")).toEqual(
    defaultDashboardPreferences,
  );
  const saved = parseDashboardPreferences(
    JSON.stringify({
      density: "unknown",
      sections: { calendar: false, attention: "false" },
    }),
  );
  expect(saved.density).toBe("compact");
  expect(saved.sections.calendar).toBe(false);
  expect(saved.sections.attention).toBe(true);
  expect(saved.sections.quickActions).toBe(true);
});
it("isolates saved layouts by school and account and ignores delayed hydration from the previous account", async () => {
  let finishPrevious!: (value: string | null) => void;
  jest.mocked(AsyncStorage.getItem).mockImplementation((key) =>
    key.endsWith(":first")
      ? new Promise((resolve) => {
          finishPrevious = resolve;
        })
      : Promise.resolve(
          JSON.stringify({ density: "compact", sections: { calendar: false } }),
        ),
  );
  let state!: ReturnType<typeof useDashboardPreferences>;
  const Probe = ({ id }: { id: string }) => {
    state = useDashboardPreferences(id);
    return null;
  };
  let tree: any;
  await act(async () => {
    tree = create(<Probe id="first" />);
  });
  expect(state.ready).toBe(false);
  await act(async () => {
    tree.update(<Probe id="second" />);
  });
  expect(state.preferences.sections.calendar).toBe(false);
  await act(async () => {
    finishPrevious(JSON.stringify({ density: "comfortable" }));
  });
  expect(state.preferences.density).toBe("compact");
  await act(async () => {
    state.update({ ...state.preferences, density: "comfortable" });
  });
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    "dashboard-layout:v1:12:second",
    expect.any(String),
  );
  act(() => tree.unmount());
});
