import AsyncStorage from "@react-native-async-storage/async-storage";
import { AdminService } from "./adminService";
import {
  adminUsageDay,
  getAdminUsageCounts,
  recordAdminScreenOpen,
  refreshAdminUsage,
  subscribeAdminUsage,
} from "./adminQuickActionUsage";
jest.mock("./adminService", () => ({
  AdminService: {
    getQuickActionUsage: jest.fn(),
    recordQuickActionClick: jest.fn(),
  },
}));
jest.mock("../constants/school", () => ({ SCHOOL_ID: 12 }));
let id: string;
let storage: Map<string, string>;
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-11-03T10:00:00Z"));
  id = `admin-${expect.getState().currentTestName}`;
  storage = new Map();
  jest
    .mocked(AsyncStorage.getItem)
    .mockImplementation(async (key) => storage.get(key) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
    storage.set(key, value);
  });
  jest
    .mocked(AdminService.getQuickActionUsage)
    .mockResolvedValue({ usageDate: adminUsageDay(), counts: {} });
  jest
    .mocked(AdminService.recordQuickActionClick)
    .mockImplementation(async (route) => ({
      actionKey: route,
      clickCount: 1,
      usageDate: adminUsageDay(),
    }));
});
afterEach(() => jest.useRealTimers());
it("hydrates saved daily usage when the server is unavailable and keeps offline opens", async () => {
  const key = `admin-quick-action-usage:12:${id}:${adminUsageDay()}`;
  storage.set(key, JSON.stringify({ "/admin/exams": 9, "/admin/leaves": 3 }));
  jest
    .mocked(AdminService.getQuickActionUsage)
    .mockRejectedValue(new Error("offline"));
  jest
    .mocked(AdminService.recordQuickActionClick)
    .mockRejectedValue(new Error("offline"));
  await refreshAdminUsage(id);
  await recordAdminScreenOpen(id, "/admin/leaves");
  expect(getAdminUsageCounts(id)).toEqual({
    "/admin/exams": 9,
    "/admin/leaves": 4,
  });
  await Promise.resolve();
  expect(JSON.parse(storage.get(key)!)["/admin/leaves"]).toBe(4);
});
it("loads shared school totals and does not roll back a local open when a stale refresh returns", async () => {
  jest
    .mocked(AdminService.getQuickActionUsage)
    .mockResolvedValue({
      usageDate: adminUsageDay(),
      counts: { "/admin/exams": 20 },
    });
  await refreshAdminUsage(id);
  await recordAdminScreenOpen(id, "/admin/exams");
  await refreshAdminUsage(id);
  expect(getAdminUsageCounts(id)["/admin/exams"]).toBe(21);
});
it("coalesces simultaneous refreshes and ignores invalid counts", async () => {
  jest
    .mocked(AdminService.getQuickActionUsage)
    .mockResolvedValue({
      usageDate: adminUsageDay(),
      counts: {
        "/admin/leaves": 5,
        "/admin/exams": -1,
        "/admin/messages": Infinity,
      },
    });
  await Promise.all([refreshAdminUsage(id), refreshAdminUsage(id)]);
  expect(AdminService.getQuickActionUsage).toHaveBeenCalledTimes(1);
  expect(getAdminUsageCounts(id)).toEqual({ "/admin/leaves": 5 });
});
it("does not lose rapid opens when atomic server responses arrive in reverse order", async () => {
  let first!: (v: any) => void, second!: (v: any) => void;
  jest
    .mocked(AdminService.recordQuickActionClick)
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          first = r;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          second = r;
        }),
    );
  const a = recordAdminScreenOpen(id, "/admin/exams"),
    b = recordAdminScreenOpen(id, "/admin/exams");
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  second({
    actionKey: "/admin/exams",
    clickCount: 12,
    usageDate: adminUsageDay(),
  });
  await b;
  first({
    actionKey: "/admin/exams",
    clickCount: 11,
    usageDate: adminUsageDay(),
  });
  await a;
  expect(getAdminUsageCounts(id)["/admin/exams"]).toBe(12);
});
it("isolates account changes and daily resets, including late network responses", async () => {
  let finish!: (v: any) => void;
  const day = adminUsageDay();
  jest.mocked(AdminService.recordQuickActionClick).mockImplementationOnce(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  const pending = recordAdminScreenOpen(id, "/admin/leaves");
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(getAdminUsageCounts(`${id}-other`)).toEqual({});
  jest.setSystemTime(new Date("2026-11-04T10:00:00Z"));
  finish({ actionKey: "/admin/leaves", clickCount: 50, usageDate: day });
  await pending;
  expect(getAdminUsageCounts(id)).toEqual({});
  expect(getAdminUsageCounts(`${id}-other`)).toEqual({});
});
it("notifies visible cards after recording shared account-screen opens", async () => {
  const listener = jest.fn();
  const off = subscribeAdminUsage(id, listener);
  await recordAdminScreenOpen(id, "/accounts/fees/collect");
  expect(listener).toHaveBeenCalled();
  expect(AdminService.recordQuickActionClick).toHaveBeenCalledWith(
    "/accounts/fees/collect",
  );
  expect(getAdminUsageCounts(id)["/accounts/fees/collect"]).toBe(1);
  off();
  listener.mockClear();
  await recordAdminScreenOpen(id, "/updates");
  expect(listener).not.toHaveBeenCalled();
});
