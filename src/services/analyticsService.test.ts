import { AnalyticsService } from "./analyticsService";
import { api as apiClient } from "./apiClient";
jest.mock("./apiClient", () => ({ api: { get: jest.fn() } }));
const failure = Object.assign(new Error("Combined summary failed"), {
  statusCode: 500,
});
beforeEach(() => jest.clearAllMocks());
it("recovers healthy modules when one module breaks the combined snapshot", async () => {
  jest.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path === "/admin/analytics") return Promise.reject(failure);
    if (path.endsWith("/financials")) return Promise.reject(failure);
    return Promise.resolve({ source: path } as any);
  });
  const result = await AnalyticsService.getAnalytics("quarter", true);
  expect(result?.attendance).toEqual({ source: "/admin/analytics/attendance" });
  expect(result?.staff).toEqual({ source: "/admin/analytics/staff" });
  expect(result?.financials).toBeUndefined();
  expect(result?.unavailable_sections).toEqual(["insights", "financials"]);
  expect(apiClient.get).toHaveBeenCalledWith(
    "/admin/analytics/staff",
    { range: "quarter", force: "true" },
    { silent: true },
  );
});
it.each([401, 403, 429, 502, 503, 504, undefined])(
  "does not fan out requests for auth, throttling or offline failures (%s)",
  async (statusCode) => {
    jest
      .mocked(apiClient.get)
      .mockRejectedValue(
        Object.assign(new Error("Unavailable"), { statusCode }),
      );
    await expect(AnalyticsService.getAnalytics("month")).rejects.toThrow(
      "Unavailable",
    );
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  },
);
it("keeps the original error when no module can be recovered", async () => {
  jest.mocked(apiClient.get).mockRejectedValue(failure);
  await expect(AnalyticsService.getAnalytics("year")).rejects.toBe(failure);
});
