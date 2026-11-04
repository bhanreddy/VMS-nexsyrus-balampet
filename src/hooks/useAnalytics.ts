/**
 * useAnalytics.ts
 * Feature-complete hook that drives the AdminReports screen.
 * Manages loading, error, caching, range switching, and refresh.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useIsFocused } from "@react-navigation/native";
import { useAuth } from "./useAuth";
import { SCHOOL_ID } from "../constants/school";
import {
  AnalyticsService,
  AnalyticsSnapshot,
  AnalyticsModule,
  FeeCollectionSummary,
  AttendanceSummary,
  AcademicSummary,
  StaffSummary,
  Insight,
  TimeRange,
} from "../services/analyticsService";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type { TimeRange };

export interface UseAnalyticsReturn {
  // Data
  financials: FeeCollectionSummary | null;
  attendance: AttendanceSummary | null;
  academics: AcademicSummary | null;
  staff: StaffSummary | null;
  insights: Insight[];
  generatedAt: string | null;
  unavailableSections: AnalyticsModule[];

  // UI state
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  range: TimeRange;
  activeSection: Section;

  // Actions
  setRange: (r: TimeRange) => void;
  setActiveSection: (s: Section) => void;
  refreshData: () => Promise<void>;
  dismissInsight: (id: string) => Promise<void>;
  exportReport: () => Promise<string | null>;
}

export type Section =
  "overview" | "finance" | "attendance" | "academic" | "staff";

// ─── Simple in-memory cache ─────────────────────────────────────────────────
interface CacheEntry {
  data: AnalyticsSnapshot;
  fetchedAt: number; // ms timestamp
}
const CACHE_TTL_MS = 15 * 1000; // 15 seconds
const cache: Record<string, CacheEntry | undefined> = {};

function isAnalyticsPayload(value: unknown): value is AnalyticsSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const payload = value as Record<string, unknown>;
  return (
    "financials" in payload ||
    "attendance" in payload ||
    "academics" in payload ||
    "staff" in payload ||
    "insights" in payload
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useAnalytics(): UseAnalyticsReturn {
  const { user } = useAuth();
  const cacheScope = `${SCHOOL_ID}:${user?.userId ?? "anonymous"}`;
  const [range, setRangeState] = useState<TimeRange>("month");
  const [activeSection, setActiveSection] = useState<Section>("overview");

  const [financials, setFinancials] = useState<FeeCollectionSummary | null>(
    null,
  );
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [academics, setAcademics] = useState<AcademicSummary | null>(null);
  const [staff, setStaff] = useState<StaffSummary | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [unavailableSections, setUnavailableSections] = useState<
    AnalyticsModule[]
  >([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ignore superseded responses after unmount, account changes or period changes.
  const abortRef = useRef<AbortController | null>(null);

  const isFocused = useIsFocused();

  // ── Core fetch ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(
    async (selectedRange: TimeRange, isRefresh = false) => {
      // Invalidate the previous request, including services without signal support.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const cacheKey = `${cacheScope}:${selectedRange}`;

      // Cache entries belong to the signed-in school and user.
      const cached = cache[cacheKey];
      const now = Date.now();
      if (!isRefresh && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
        if (isAnalyticsPayload(cached.data)) {
          applyData(cached.data);
          setLoading(false);
          setRefreshing(false);
          setError(
            cached.data.unavailable_sections?.length
              ? "Some school summaries are temporarily unavailable."
              : null,
          );
          return;
        }
        delete cache[cacheKey];
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const data = await AnalyticsService.getAnalytics(
          selectedRange,
          isRefresh,
        );
        // The service may complete after a period switch; ignore that response.
        if (controller.signal.aborted) return;

        if (!isAnalyticsPayload(data)) {
          throw new Error("Analytics data is unavailable. Please try again.");
        }

        // Store in cache
        cache[cacheKey] = { data, fetchedAt: now };

        applyData(data);
        if (data.unavailable_sections?.length)
          setError("Some school summaries are temporarily unavailable.");
      } catch (err: any) {
        if (controller.signal.aborted) return;
        if (err?.name === "CanceledError" || err?.name === "AbortError") return;
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load analytics";
        setError(msg);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [cacheScope],
  );

  function applyData(data: AnalyticsSnapshot) {
    setUnavailableSections(data.unavailable_sections ?? []);
    setFinancials((previous) =>
      data.unavailable_sections?.includes("financials")
        ? previous
        : (data.financials ?? null),
    );
    setAttendance((previous) =>
      data.unavailable_sections?.includes("attendance")
        ? previous
        : (data.attendance ?? null),
    );
    setAcademics((previous) =>
      data.unavailable_sections?.includes("academics")
        ? previous
        : (data.academics ?? null),
    );
    setStaff((previous) =>
      data.unavailable_sections?.includes("staff")
        ? previous
        : (data.staff ?? null),
    );
    setInsights(Array.isArray(data.insights) ? data.insights : []);
    setGeneratedAt(
      typeof data.generated_at === "string" ? data.generated_at : null,
    );
  }

  // Clear the old period immediately so new labels never describe old values.
  const setRange = useCallback(
    (r: TimeRange) => {
      if (r === range) return;
      abortRef.current?.abort();
      applyData({});
      setError(null);
      setLoading(true);
      setRangeState(r);
    },
    [range],
  );

  useEffect(() => {
    applyData({});
    setError(null);
  }, [cacheScope]);

  // Revalidate once per focus/range change; clean up requests on unmount.
  useEffect(() => {
    if (!isFocused || !user?.userId) return;
    void fetchData(range);
    return () => {
      abortRef.current?.abort();
    };
  }, [isFocused, range, fetchData, user?.userId]);

  // ── Pull-to-refresh ────────────────────────────────────────────────────────
  const refreshData = useCallback(async () => {
    await fetchData(range, true);
  }, [range, fetchData]);

  // ── Dismiss an insight optimistically ─────────────────────────────────────
  const dismissInsight = useCallback(
    async (id: string) => {
      // Optimistic update
      setInsights((prev) => prev.filter((i) => i.id !== id));
      try {
        await AnalyticsService.dismissInsight(id);
        // Invalidate cache for current range
        delete cache[`${cacheScope}:${range}`];
      } catch {
        // Revert by re-fetching silently
        fetchData(range, true);
      }
    },
    [range, cacheScope, fetchData],
  );

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportReport = useCallback(async (): Promise<string | null> => {
    try {
      const { download_url } = await AnalyticsService.exportReport(range);
      return download_url;
    } catch {
      return null;
    }
  }, [range]);

  return {
    financials,
    attendance,
    academics,
    staff,
    insights,
    generatedAt,
    unavailableSections,
    loading,
    refreshing,
    error,
    range,
    activeSection,
    setRange,
    setActiveSection,
    refreshData,
    dismissInsight,
    exportReport,
  };
}
