/* eslint-disable @typescript-eslint/no-require-imports */
import React from "react";
import { useAnalytics, UseAnalyticsReturn } from "./useAnalytics";
import { AnalyticsService } from "../services/analyticsService";
const { create, act } = require("react-test-renderer");

let mockUserId = "analytics-user";
jest.mock("./useAuth", () => ({
  useAuth: () => ({ user: { userId: mockUserId } }),
}));
jest.mock("../constants/school", () => ({ SCHOOL_ID: 1 }));
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
jest.mock("../services/analyticsService", () => ({
  AnalyticsService: {
    getAnalytics: jest.fn(),
    dismissInsight: jest.fn(),
    exportReport: jest.fn(),
  },
}));
let latest: UseAnalyticsReturn;
let tree: any;
function Probe() {
  latest = useAnalytics();
  return null;
}
function deferred() {
  let resolve!: (value: any) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<any>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const payload = (amount: number) =>
  ({ financials: { total_collected: amount }, insights: [] }) as any;
let sequence = 0;
beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = `analytics-user-${++sequence}`;
});
afterEach(() => {
  act(() => tree?.unmount());
});

it("ignores a slow response from the previously selected period", async () => {
  const month = deferred(),
    quarter = deferred();
  jest
    .mocked(AnalyticsService.getAnalytics)
    .mockImplementation((range) =>
      range === "month" ? month.promise : quarter.promise,
    );
  await act(async () => {
    tree = create(<Probe />);
  });
  await act(async () => {
    latest.setRange("quarter");
  });
  await act(async () => {
    quarter.resolve(payload(900));
  });
  expect(latest.range).toBe("quarter");
  expect(latest.financials?.total_collected).toBe(900);
  await act(async () => {
    month.resolve(payload(100));
  });
  expect(latest.financials?.total_collected).toBe(900);
  expect(latest.loading).toBe(false);
});

it("clears previous amounts during a period switch and keeps them unavailable if the new request fails", async () => {
  const quarter = deferred();
  jest
    .mocked(AnalyticsService.getAnalytics)
    .mockImplementation((range) =>
      range === "month" ? Promise.resolve(payload(100)) : quarter.promise,
    );
  await act(async () => {
    tree = create(<Probe />);
  });
  expect(latest.financials?.total_collected).toBe(100);
  await act(async () => {
    latest.setRange("quarter");
  });
  expect(latest.financials).toBeNull();
  expect(latest.loading).toBe(true);
  await act(async () => {
    quarter.reject(new Error("Temporarily offline"));
  });
  expect(latest.financials).toBeNull();
  expect(latest.error).toBe("Temporarily offline");
});

it("retains the last snapshot when a manual refresh fails", async () => {
  jest
    .mocked(AnalyticsService.getAnalytics)
    .mockResolvedValueOnce(payload(0))
    .mockRejectedValueOnce(new Error("Offline"));
  await act(async () => {
    tree = create(<Probe />);
  });
  expect(latest.financials?.total_collected).toBe(0);
  await act(async () => {
    await latest.refreshData();
  });
  expect(latest.financials?.total_collected).toBe(0);
  expect(latest.error).toBe("Offline");
  expect(latest.refreshing).toBe(false);
});

it("does not reuse another signed-in user’s cached totals", async () => {
  jest
    .mocked(AnalyticsService.getAnalytics)
    .mockResolvedValueOnce(payload(100));
  await act(async () => {
    tree = create(<Probe />);
  });
  const next = deferred();
  jest.mocked(AnalyticsService.getAnalytics).mockReturnValue(next.promise);
  mockUserId = "different-account";
  await act(async () => {
    tree.update(<Probe />);
  });
  expect(latest.financials).toBeNull();
  await act(async () => {
    next.resolve(payload(500));
  });
  expect(latest.financials?.total_collected).toBe(500);
});

it("ignores errors from cancelled requests after another period has loaded", async () => {
  const month = deferred();
  jest
    .mocked(AnalyticsService.getAnalytics)
    .mockImplementation((range) =>
      range === "month" ? month.promise : Promise.resolve(payload(700)),
    );
  await act(async () => {
    tree = create(<Probe />);
  });
  await act(async () => {
    latest.setRange("year");
  });
  await act(async () => {
    month.reject(new Error("Old request failed"));
  });
  expect(latest.error).toBeNull();
  expect(latest.financials?.total_collected).toBe(700);
});

it("keeps healthy summaries visible when only one analytics module fails", async () => {
  jest
    .mocked(AnalyticsService.getAnalytics)
    .mockResolvedValueOnce({
      attendance: { avg_attendance: 94 },
      staff: { total_staff: 47 },
      insights: [],
      unavailable_sections: ["financials", "academics", "insights"],
    } as any);
  await act(async () => {
    tree = create(<Probe />);
  });
  expect(latest.attendance?.avg_attendance).toBe(94);
  expect(latest.staff?.total_staff).toBe(47);
  expect(latest.financials).toBeNull();
  expect(latest.unavailableSections).toContain("financials");
  expect(latest.error).toBe(
    "Some school summaries are temporarily unavailable.",
  );
});

it("preserves a previous balance during a partial refresh without overwriting it with zero", async () => {
  jest
    .mocked(AnalyticsService.getAnalytics)
    .mockResolvedValueOnce(payload(450))
    .mockResolvedValueOnce({
      staff: { total_staff: 48 },
      insights: [],
      unavailable_sections: [
        "financials",
        "attendance",
        "academics",
        "insights",
      ],
    } as any);
  await act(async () => {
    tree = create(<Probe />);
  });
  await act(async () => {
    await latest.refreshData();
  });
  expect(latest.financials?.total_collected).toBe(450);
  expect(latest.staff?.total_staff).toBe(48);
  expect(latest.unavailableSections).toContain("financials");
});
