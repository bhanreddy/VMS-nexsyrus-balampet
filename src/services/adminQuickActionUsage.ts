import AsyncStorage from "@react-native-async-storage/async-storage";
import { SCHOOL_ID } from "../constants/school";
import { AdminService } from "./adminService";

type Counts = Readonly<Record<string, number>>;
type UsageState = {
  day: string;
  key: string;
  counts: Counts;
  listeners: Set<() => void>;
  hydrated?: Promise<void>;
  refreshing?: Promise<void>;
  write: Promise<void>;
};
const states = new Map<string, UsageState>();
const empty: Counts = {};

/** Preserve the legacy school's daily ranking, using its default school timezone. */
export const adminUsageDay = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function stateFor(userId: string, day = adminUsageDay()): UsageState {
  const key = `admin-quick-action-usage:${SCHOOL_ID}:${userId}:${day}`;
  let state = states.get(key);
  if (!state) {
    state = {
      day,
      key,
      counts: {},
      listeners: new Set(),
      write: Promise.resolve(),
    };
    states.set(key, state);
  }
  return state;
}
function validCounts(value: unknown): Counts {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([route, count]) =>
        route.startsWith("/") &&
        typeof count === "number" &&
        Number.isFinite(count) &&
        count >= 0,
    ),
  );
}
function merge(state: UsageState, counts: Counts) {
  const next = { ...state.counts };
  for (const [route, count] of Object.entries(counts))
    next[route] = Math.max(next[route] || 0, count);
  state.counts = next;
  state.listeners.forEach((listener) => listener());
}
function persist(state: UsageState) {
  const value = JSON.stringify(state.counts);
  state.write = state.write
    .then(() => AsyncStorage.setItem(state.key, value))
    .catch(() => {});
  return state.write;
}
function hydrate(state: UsageState) {
  if (!state.hydrated)
    state.hydrated = (async () => {
      try {
        const cached = await AsyncStorage.getItem(state.key);
        if (cached) merge(state, validCounts(JSON.parse(cached)));
      } catch {
        /* Usage never blocks navigation. */
      }
    })();
  return state.hydrated;
}
export function getAdminUsageCounts(userId?: string, day?: string): Counts {
  return userId ? stateFor(userId, day).counts : empty;
}
export function subscribeAdminUsage(
  userId: string | undefined,
  listener: () => void,
  day?: string,
) {
  if (!userId) return () => {};
  const state = stateFor(userId, day);
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}
export async function refreshAdminUsage(userId?: string): Promise<void> {
  if (!userId) return;
  const state = stateFor(userId);
  if (!state.refreshing) {
    state.refreshing = (async () => {
      await hydrate(state);
      try {
        const usage = await AdminService.getQuickActionUsage();
        if (usage.usageDate && usage.usageDate !== state.day) return;
        merge(state, validCounts(usage.counts));
        await persist(state);
      } catch {
        /* Retain cached and locally recorded opens while unavailable. */
      }
    })().finally(() => {
      state.refreshing = undefined;
    });
  }
  return state.refreshing;
}
export async function recordAdminScreenOpen(
  userId: string,
  route: string,
): Promise<void> {
  const state = stateFor(userId);
  await hydrate(state);
  merge(state, { [route]: (state.counts[route] || 0) + 1 });
  void persist(state);
  try {
    const usage = await AdminService.recordQuickActionClick(route);
    if (usage.usageDate && usage.usageDate !== state.day) return;
    // Late responses cannot undo newer opens or leak into another account/day.
    if (usage.actionKey === route)
      merge(state, validCounts({ [route]: usage.clickCount }));
    await persist(state);
  } catch {
    /* The local count remains useful when tracking is offline. */
  }
}
