/* eslint-disable @typescript-eslint/no-require-imports */
import React from "react";
import { useAdminScreenUsage } from "./useAdminScreenUsage";
import { recordAdminScreenOpen } from "../services/adminQuickActionUsage";
const { act, create } = require("react-test-renderer");
let mockPath = "/admin/dashboard";
let mockRole = "admin";
let mockUserId = "admin-1";
const mockPermission = jest.fn(() => true);
jest.mock("expo-router", () => ({ usePathname: () => mockPath }));
jest.mock("./useAuth", () => ({
  useAuth: () => ({ role: mockRole, user: { userId: mockUserId } }),
}));
jest.mock("./usePermissions", () => ({
  usePermissions: () => ({ hasPermission: mockPermission }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_: string, fallback: string) => fallback }),
}));
jest.mock("../services/adminQuickActionUsage", () => ({
  recordAdminScreenOpen: jest.fn(async () => {}),
}));
function Probe() {
  useAdminScreenUsage();
  return null;
}
let tree: any;
const visit = async (path: string) => {
  mockPath = path;
  await act(async () => tree.update(<Probe />));
};
beforeEach(async () => {
  jest.clearAllMocks();
  mockPath = "/admin/dashboard";
  mockRole = "admin";
  mockUserId = "admin-1";
  mockPermission.mockReturnValue(true);
  await act(async () => {
    tree = create(<Probe />);
  });
});
afterEach(() => act(() => tree.unmount()));
it("counts each actual screen open once regardless of its navigation entry point", async () => {
  await visit("/admin/exams");
  await visit("/admin/exams");
  await visit("/admin/exams/record-1");
  await visit("/admin/dashboard");
  await visit("/admin/exams");
  expect(recordAdminScreenOpen).toHaveBeenCalledTimes(2);
  expect(recordAdminScreenOpen).toHaveBeenCalledWith("admin-1", "/admin/exams");
});
it("includes shared account routes and switches tracking to the newly signed-in account", async () => {
  await visit("/accounts/fees/collect");
  mockUserId = "admin-2";
  await visit("/accounts/fees/collect");
  expect(jest.mocked(recordAdminScreenOpen).mock.calls).toEqual([
    ["admin-1", "/accounts/fees/collect"],
    ["admin-2", "/accounts/fees/collect"],
  ]);
});
it("does not track staff portal users or tools excluded by permissions", async () => {
  mockRole = "staff";
  await visit("/admin/exams");
  expect(recordAdminScreenOpen).not.toHaveBeenCalled();
  mockRole = "admin";
  mockPermission.mockReturnValue(false);
  await visit("/admin/substitutions");
  expect(recordAdminScreenOpen).not.toHaveBeenCalled();
});
