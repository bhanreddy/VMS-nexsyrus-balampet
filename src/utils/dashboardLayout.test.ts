import { calculateDashboardLayout } from "./dashboardLayout";
it("fills the shortest column after a short error card instead of leaving a permanent empty lane", () => {
  const result = calculateDashboardLayout(
    [
      { id: "fees", height: 400 },
      { id: "error", height: 70 },
      { id: "tools", height: 350 },
      { id: "notices", height: 280 },
      { id: "calendar", height: 440 },
    ],
    1220,
  );
  expect(result.columns).toBe(3);
  expect(result.placements.find((item) => item.id === "notices")).toMatchObject(
    { column: 1, y: 86 },
  );
  expect(
    result.placements.find((item) => item.id === "calendar"),
  ).toMatchObject({ column: 2, y: 366 });
});
it.each([320, 390, 768, 1024, 1440, 1920, 2560])(
  "keeps all cards in bounds without overlaps at width %i",
  (width) => {
    const result = calculateDashboardLayout(
      Array.from({ length: 12 }, (_, i) => ({
        id: String(i),
        height: 65 + i * 37,
      })),
      width,
    );
    for (const card of result.placements) {
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(width + 0.01);
      for (const other of result.placements.filter(
        (item) => item.column === card.column && item.y > card.y,
      ))
        expect(other.y).toBeGreaterThanOrEqual(card.y + card.height + 16);
    }
  },
);
it("retains logical card order and moves later cards up when a section is hidden", () => {
  const cards = [
    { id: "first", height: 100 },
    { id: "second", height: 100 },
    { id: "third", height: 100 },
    { id: "fourth", height: 200 },
  ];
  const before = calculateDashboardLayout(cards, 800);
  const after = calculateDashboardLayout(
    cards.filter((item) => item.id !== "second"),
    800,
  );
  expect(after.placements.map((item) => item.id)).toEqual([
    "first",
    "third",
    "fourth",
  ]);
  expect(after.placements.find((item) => item.id === "third")!.y).toBeLessThan(
    before.placements.find((item) => item.id === "third")!.y,
  );
});
it("does not reserve any space for an empty workspace", () =>
  expect(calculateDashboardLayout([], 1200).height).toBe(0));
