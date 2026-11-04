import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

type IconName = ComponentProps<typeof Ionicons>["name"];
export interface SidebarPresentationItem {
  title: string;
  icon: IconName;
  route: string;
  badge?: number;
  category?: string;
}
export interface SidebarGroupMeta {
  label: string;
  shortLabel: string;
  icon: IconName;
  color: string;
  cluster: string;
}
export const ADMIN_SIDEBAR_GROUPS: Record<string, SidebarGroupMeta> = {
  Academic: {
    label: "Academic management",
    shortLabel: "Academics",
    icon: "school-outline",
    color: "#B8A2F5",
    cluster: "School workspace",
  },
  Students: {
    label: "Student management",
    shortLabel: "Students & admissions",
    icon: "people-outline",
    color: "#8BBEEC",
    cluster: "School workspace",
  },
  Finance: {
    label: "Fee management",
    shortLabel: "Fees & finance",
    icon: "wallet-outline",
    color: "#88D2BD",
    cluster: "School workspace",
  },
  HR: {
    label: "Staff management",
    shortLabel: "People & HR",
    icon: "briefcase-outline",
    color: "#D4A6CB",
    cluster: "School workspace",
  },
  Ops: {
    label: "Campus operations",
    shortLabel: "Campus operations",
    icon: "business-outline",
    color: "#E3BE88",
    cluster: "Operations & insights",
  },
  Comms: {
    label: "Communication",
    shortLabel: "Communication",
    icon: "chatbubbles-outline",
    color: "#9AB6ED",
    cluster: "Operations & insights",
  },
  Analytics: {
    label: "Reports & analytics",
    shortLabel: "Reports & intelligence",
    icon: "bar-chart-outline",
    color: "#BCA8F0",
    cluster: "Operations & insights",
  },
  Support: {
    label: "Support",
    shortLabel: "Support & feedback",
    icon: "help-buoy-outline",
    color: "#A0C3E2",
    cluster: "Administration",
  },
  Governance: {
    label: "Governance",
    shortLabel: "Governance",
    icon: "checkbox-outline",
    color: "#DDC28E",
    cluster: "Administration",
  },
  Compliance: {
    label: "Compliance",
    shortLabel: "Compliance",
    icon: "ribbon-outline",
    color: "#94CFC9",
    cluster: "Administration",
  },
  Security: {
    label: "Access & security",
    shortLabel: "Access & security",
    icon: "shield-checkmark-outline",
    color: "#A7BBE9",
    cluster: "Administration",
  },
  Website: {
    label: "School website",
    shortLabel: "School website",
    icon: "globe-outline",
    color: "#9AC4D9",
    cluster: "Administration",
  },
};
export const COMPACT_SIDEBAR_GROUPS = [
  "Academic",
  "Students",
  "Finance",
  "HR",
  "Ops",
  "Comms",
  "Analytics",
];
export function sidebarRouteActive(path: string, route: string): boolean {
  return (
    path === route ||
    (route !== "/admin" &&
      route !== "/admin/dashboard" &&
      path.startsWith(`${route}/`))
  );
}
export function buildSidebarSections<T extends SidebarPresentationItem>(
  items: readonly T[],
  query = "",
) {
  const normalized = query.trim().toLocaleLowerCase();
  const categoryFor = (item: T) =>
    item.category === "AI" ? "Analytics" : item.category || "Other";
  const matches = (item: T) =>
    !normalized ||
    `${item.title} ${categoryFor(item)} ${ADMIN_SIDEBAR_GROUPS[categoryFor(item)]?.label || ""} ${ADMIN_SIDEBAR_GROUPS[categoryFor(item)]?.shortLabel || ""}`
      .toLocaleLowerCase()
      .includes(normalized);
  const categoryNames = [
    ...new Set([
      ...Object.keys(ADMIN_SIDEBAR_GROUPS),
      ...items.map(categoryFor),
    ]),
  ];
  return {
    overview: items.filter(
      (item) => categoryFor(item) === "Overview" && matches(item),
    ),
    sections: categoryNames
      .filter((category) => category !== "Overview")
      .map((category) => ({
        category,
        meta: ADMIN_SIDEBAR_GROUPS[category] || {
          label: category,
          shortLabel: category,
          icon: "grid-outline" as IconName,
          color: "#B2BBD0",
          cluster: "Administration",
        },
        items: items.filter(
          (item) => categoryFor(item) === category && matches(item),
        ),
      }))
      .filter((section) => section.items.length),
  };
}
