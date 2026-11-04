import { LeaveService } from "./commonServices";
import type { LeaveApplication } from "./commonServices";
import type { ActionCenterItem } from "./governanceService";
import { STAFF_ADD_LOGIN_ROLE_OPTIONS } from "../utils/roleHelpers";

const staffRoles = new Set<string>([
  ...STAFF_ADD_LOGIN_ROLE_OPTIONS.map((role) => role.code),
  "teacher",
  "accountant",
  "accounts",
  "management",
  "superadmin",
]);

/** Use the existing school-scoped leaves API, including every pending page. */
export async function getPendingStaffLeaves(): Promise<LeaveApplication[]> {
  const pending = new Map<string, LeaveApplication>();
  const limit = 100;
  for (let page = 1; ; page += 1) {
    const batch = await LeaveService.getAll(
      { status: "pending", page, limit },
      { silent: true },
    );
    for (const leave of batch) {
      if (
        leave.status === "pending" &&
        (leave.staff_id || staffRoles.has(leave.applicant_role || ""))
      )
        pending.set(leave.id, leave);
    }
    if (batch.length < limit) return [...pending.values()];
  }
}

/** Keep one actionable leave row, with critical alerts above it. */
export function withStaffLeaveAttention(
  items: ActionCenterItem[],
  leaves: LeaveApplication[] | null,
  canReview: boolean,
): ActionCenterItem[] {
  const isLeaveItem = (item: ActionCenterItem) =>
    item.id === "staff_leaves_pending" ||
    item.action_url?.split("?")[0] === "/admin/leaves";
  const others = items.filter((item) => !isLeaveItem(item));
  if (!canReview) return others;
  const leaveItem: ActionCenterItem | undefined =
    leaves === null
      ? items.find(isLeaveItem)
      : leaves.length > 0
        ? {
            id: "staff_leaves_pending",
            category: "staff",
            severity: "NEEDS_ATTENTION",
            title: "Staff leave applications",
            description: `${leaves.length} staff leave application${leaves.length === 1 ? " is" : "s are"} awaiting approval.`,
            count: leaves.length,
            action_url: "/admin/leaves",
            action_label: "Review leaves",
          }
        : undefined;
  if (!leaveItem) return others;
  return [
    ...others.filter((item) => item.severity === "CRITICAL"),
    leaveItem,
    ...others.filter((item) => item.severity !== "CRITICAL"),
  ];
}
