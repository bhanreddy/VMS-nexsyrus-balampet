import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SCHOOL_ID } from "../constants/school";

export const dashboardSectionLabels = {
  finance: "Fee collection",
  pulse: "Attendance, academics & staff",
  attention: "Attention queue",
  quickActions: "Quick actions",
  calendar: "Calendar & upcoming events",
  notices: "Notice board",
  insights: "School insights",
  stories: "School stories",
} as const;
export type DashboardSection = keyof typeof dashboardSectionLabels;
export type DashboardDensity = "compact" | "comfortable";
export interface DashboardPreferences {
  density: DashboardDensity;
  sections: Record<DashboardSection, boolean>;
}
export const defaultDashboardPreferences: DashboardPreferences = {
  density: "compact",
  sections: {
    finance: true,
    pulse: true,
    attention: true,
    quickActions: true,
    calendar: true,
    notices: true,
    insights: true,
    stories: true,
  },
};
export function parseDashboardPreferences(
  raw: string | null,
): DashboardPreferences {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object")
      return defaultDashboardPreferences;
    const value = parsed as Partial<DashboardPreferences>;
    return {
      density: value.density === "comfortable" ? "comfortable" : "compact",
      sections: Object.fromEntries(
        Object.keys(dashboardSectionLabels).map((key) => [
          key,
          typeof value.sections?.[key as DashboardSection] === "boolean"
            ? value.sections[key as DashboardSection]
            : true,
        ]),
      ) as Record<DashboardSection, boolean>,
    };
  } catch {
    return defaultDashboardPreferences;
  }
}
export function useDashboardPreferences(userId: string | null | undefined) {
  const key = userId ? `dashboard-layout:v1:${SCHOOL_ID}:${userId}` : null;
  const [preferences, setPreferences] = useState(defaultDashboardPreferences);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const currentKey = useRef(key);
  currentKey.current = key;
  useEffect(() => {
    let active = true;
    setLoadedKey(null);
    setPreferences(defaultDashboardPreferences);
    if (key)
      void AsyncStorage.getItem(key)
        .then((raw) => {
          if (active) {
            setPreferences(parseDashboardPreferences(raw));
            setLoadedKey(key);
          }
        })
        .catch(() => {
          if (active) setLoadedKey(key);
        });
    return () => {
      active = false;
    };
  }, [key]);
  const update = useCallback(
    (next: DashboardPreferences) => {
      if (!key || loadedKey !== key || currentKey.current !== key) return;
      setPreferences(next);
      void AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {
        /* The chosen layout remains usable if local storage is unavailable. */
      });
    },
    [key, loadedKey],
  );
  const ready = !!key && loadedKey === key;
  return {
    preferences: ready ? preferences : defaultDashboardPreferences,
    ready,
    update,
    reset: () => update(defaultDashboardPreferences),
  };
}
