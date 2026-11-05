import type { AdminNavAction } from "../constants/adminNav.types";

/** Shared runtime actions. Keep outside the school-overridden constants directory. */
export const ADMIN_CORE_QUICK_ACTIONS: {
  title: string;
  icon: AdminNavAction["icon"];
  route: string;
  permission: string;
  category: string;
}[] = [
  {
    title: "Add student",
    icon: "person-add-outline",
    route: "/admin/addStudent",
    permission: "students.create",
    category: "Students",
  },
  {
    title: "Record payment",
    icon: "wallet-outline",
    route: "/accounts/fees/collect",
    permission: "fees.collect",
    category: "Finance",
  },
  {
    title: "New admission",
    icon: "school-outline",
    route: "/admin/admissions",
    permission: "admissions.create",
    category: "Students",
  },
  {
    title: "Mark attendance",
    icon: "checkmark-circle-outline",
    route: "/admin/attendance",
    permission: "staff_attendance.manage",
    category: "HR",
  },
  {
    title: "Publish notice",
    icon: "megaphone-outline",
    route: "/admin/notices",
    permission: "notices.create",
    category: "Comms",
  },
  {
    title: "Generate report",
    icon: "bar-chart-outline",
    route: "/admin/reports",
    permission: "reports.financial",
    category: "Analytics",
  },
];
