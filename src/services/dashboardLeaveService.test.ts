import { LeaveService } from "./commonServices";
import type { LeaveApplication } from "./commonServices";
import type { ActionCenterItem } from "./governanceService";
import {
  getPendingStaffLeaves,
  withStaffLeaveAttention,
} from "./dashboardLeaveService";
jest.mock("./commonServices", () => ({ LeaveService: { getAll: jest.fn() } }));
const leave = (
  id: string,
  overrides: Partial<LeaveApplication> = {},
): LeaveApplication => ({
  id,
  leave_type: "casual",
  start_date: "2026-11-04",
  end_date: "2026-11-05",
  reason: "Personal",
  status: "pending",
  created_at: "2026-11-03",
  applicant_role: "staff",
  ...overrides,
});
const alert = (
  id: string,
  severity: ActionCenterItem["severity"] = "NEEDS_ATTENTION",
): ActionCenterItem => ({
  id,
  title: id,
  description: id,
  category: "staff",
  severity,
});
const oldLeave = {
  ...alert("staff_leaves_pending"),
  action_url: "/admin/leaves",
  count: 99,
};
beforeEach(() => jest.resetAllMocks());
it("loads every pending page and excludes non-staff or processed applications without counting duplicates", async () => {
  const first = Array.from({ length: 100 }, (_, i) => leave(String(i)));
  jest
    .mocked(LeaveService.getAll)
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce([
      first[0],
      leave("next"),
      leave("student", { applicant_role: "student" }),
      leave("approved", { status: "approved" }),
    ]);
  const pending = await getPendingStaffLeaves();
  expect(pending).toHaveLength(101);
  expect(LeaveService.getAll).toHaveBeenNthCalledWith(
    1,
    { status: "pending", page: 1, limit: 100 },
    { silent: true },
  );
  expect(LeaveService.getAll).toHaveBeenNthCalledWith(
    2,
    { status: "pending", page: 2, limit: 100 },
    { silent: true },
  );
});
it("recognizes employees by staff record and legacy staff roles", async () => {
  jest
    .mocked(LeaveService.getAll)
    .mockResolvedValue([
      leave("teacher", { applicant_role: "teacher" }),
      leave("driver", { applicant_role: "driver" }),
      leave("custom", {
        applicant_role: "custom-employee",
        staff_id: "staff-1",
      }),
      leave("parent", { applicant_role: "parent" }),
      leave("unknown", { applicant_role: undefined }),
    ]);
  expect((await getPendingStaffLeaves()).map((l) => l.id)).toEqual([
    "teacher",
    "driver",
    "custom",
  ]);
});
it("returns a confirmed empty list and stops fetching when there are no pending applications", async () => {
  jest.mocked(LeaveService.getAll).mockResolvedValue([]);
  await expect(getPendingStaffLeaves()).resolves.toEqual([]);
  expect(LeaveService.getAll).toHaveBeenCalledTimes(1);
});
it("does not publish a partial count when a later page fails", async () => {
  jest
    .mocked(LeaveService.getAll)
    .mockResolvedValueOnce(
      Array.from({ length: 100 }, (_, i) => leave(String(i))),
    )
    .mockRejectedValueOnce(new Error("offline"));
  await expect(getPendingStaffLeaves()).rejects.toThrow("offline");
});
it("adds staff applications without the combined briefing, linking to the existing review screen", () => {
  expect(
    withStaffLeaveAttention([], [leave("one"), leave("two")], true),
  ).toEqual([
    expect.objectContaining({
      id: "staff_leaves_pending",
      title: "Staff leave applications",
      count: 2,
      action_url: "/admin/leaves",
      description: "2 staff leave applications are awaiting approval.",
    }),
  ]);
});
it("keeps one current leave row visible after critical alerts, clearing it after the last request is processed", () => {
  const critical = alert("urgent", "CRITICAL"),
    other = alert("fees");
  const rows = withStaffLeaveAttention(
    [oldLeave, other, critical, { ...oldLeave, id: "duplicate" }],
    [leave("one")],
    true,
  );
  expect(rows.map((i) => i.id)).toEqual([
    "urgent",
    "staff_leaves_pending",
    "fees",
  ]);
  expect(rows[1]).toMatchObject({
    count: 1,
    description: "1 staff leave application is awaiting approval.",
  });
  expect(withStaffLeaveAttention(rows, [], true).map((i) => i.id)).toEqual([
    "urgent",
    "fees",
  ]);
});
it("preserves the combined count while the direct request is unavailable, and respects review permissions", () => {
  expect(withStaffLeaveAttention([oldLeave], null, true)).toEqual([oldLeave]);
  expect(
    withStaffLeaveAttention(
      [oldLeave, alert("other")],
      [leave("one")],
      false,
    ).map((i) => i.id),
  ).toEqual(["other"]);
});
