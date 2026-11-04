import {
  rankQuickActionsByUsage,
  resolveQuickActionRoute,
} from "./quickActionRanking";
it("puts highest open counts first with stable legacy ordering for ties and unused tools", () => {
  const actions = [
    { route: "/admin/staff" },
    { route: "/admin/exams" },
    { route: "/admin/leaves" },
    { route: "/admin/diary/viewer" },
  ];
  expect(
    rankQuickActionsByUsage(actions, {
      "/admin/leaves": 20,
      "/admin/exams": 8,
      "/admin/staff": 8,
    }).map((a) => a.route),
  ).toEqual([
    "/admin/leaves",
    "/admin/staff",
    "/admin/exams",
    "/admin/diary/viewer",
  ]);
  expect(actions[0].route).toBe("/admin/staff");
});
it("maps nested pages to the closest existing card and ignores query-only changes or unrelated paths", () => {
  const routes = [
    "/admin/leaves",
    "/admin/fees",
    "/admin/fees/adjustments",
    "/accounts/fees/collect",
  ];
  expect(
    resolveQuickActionRoute("/admin/fees/adjustments/123?tab=history", routes),
  ).toBe("/admin/fees/adjustments");
  expect(
    resolveQuickActionRoute("/accounts/fees/collect?student=1", routes),
  ).toBe("/accounts/fees/collect");
  expect(resolveQuickActionRoute("/admin/leaves-extra", routes)).toBeNull();
  expect(resolveQuickActionRoute("/admin/dashboard", routes)).toBeNull();
});
