import {
  buildSidebarSections,
  sidebarRouteActive,
  COMPACT_SIDEBAR_GROUPS,
} from "./adminSidebarPresentation";
const items = [
  {
    title: "Dashboard",
    route: "/admin/dashboard",
    icon: "grid-outline" as const,
    category: "Overview",
  },
  {
    title: "Timetable",
    route: "/admin/timetable",
    icon: "calendar-outline" as const,
    category: "Academic",
  },
  {
    title: "Smart insights",
    route: "/admin/smart-insights",
    icon: "bulb-outline" as const,
    category: "AI",
  },
  {
    title: "Reports",
    route: "/admin/reports",
    icon: "bar-chart-outline" as const,
    category: "Analytics",
  },
  {
    title: "Document alerts",
    route: "/admin/document-alerts",
    icon: "alert-circle-outline" as const,
    category: "Governance",
  },
  {
    title: "Custom module",
    route: "/admin/custom-module",
    icon: "apps-outline" as const,
    category: "Custom",
  },
];
it("preserves every permitted route once, including intelligent and custom modules", () => {
  const result = buildSidebarSections(items);
  const routes = [
    ...result.overview,
    ...result.sections.flatMap((section) => section.items),
  ].map((item) => item.route);
  expect(routes).toHaveLength(items.length);
  expect(new Set(routes).size).toBe(items.length);
  expect(routes.sort()).toEqual(items.map((item) => item.route).sort());
  expect(
    result.sections
      .find((section) => section.category === "Analytics")
      ?.items.map((item) => item.title),
  ).toEqual(["Smart insights", "Reports"]);
});
it("finds routes by tool or module name without introducing excluded actions", () => {
  expect(
    buildSidebarSections(items, "  TIMETABLE ").sections[0].items.map(
      (item) => item.route,
    ),
  ).toEqual(["/admin/timetable"]);
  expect(
    buildSidebarSections(items, "intelligence").sections[0].items.map(
      (item) => item.route,
    ),
  ).toEqual(["/admin/smart-insights", "/admin/reports"]);
  expect(
    buildSidebarSections(
      items.filter((item) => item.category !== "Governance"),
      "Document alerts",
    ).sections,
  ).toEqual([]);
  expect(buildSidebarSections(items, "no such tool").overview).toEqual([]);
});
it("makes non-primary categories reachable from the compact rail’s more-tools menu", () => {
  const result = buildSidebarSections(items);
  const more = result.sections
    .filter((section) => !COMPACT_SIDEBAR_GROUPS.includes(section.category))
    .flatMap((section) => section.items);
  expect(more.map((item) => item.route)).toEqual([
    "/admin/document-alerts",
    "/admin/custom-module",
  ]);
});
it("selects a module on nested routes without selecting routes with similar prefixes", () => {
  expect(sidebarRouteActive("/admin/admissions/123", "/admin/admissions")).toBe(
    true,
  );
  expect(
    sidebarRouteActive("/admin/admissions-extra", "/admin/admissions"),
  ).toBe(false);
  expect(sidebarRouteActive("/admin/dashboard-extra", "/admin/dashboard")).toBe(
    false,
  );
});
