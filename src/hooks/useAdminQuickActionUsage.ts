import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "./useAuth";
import {
  adminUsageDay,
  getAdminUsageCounts,
  refreshAdminUsage,
  subscribeAdminUsage,
} from "../services/adminQuickActionUsage";

export function useAdminQuickActionUsage() {
  const { user } = useAuth();
  const userId = user?.userId;
  const [day, setDay] = useState(adminUsageDay);
  const counts = useSyncExternalStore(
    useCallback(
      (listener) => subscribeAdminUsage(userId, listener, day),
      [userId, day],
    ),
    useCallback(() => getAdminUsageCounts(userId, day), [userId, day]),
    useCallback(() => getAdminUsageCounts(), []),
  );
  const refresh = useCallback(() => refreshAdminUsage(userId), [userId]);
  useFocusEffect(
    useCallback(() => {
      const update = () => {
        setDay(adminUsageDay());
        void refresh();
      };
      update();
      const timer = setInterval(update, 30_000);
      return () => clearInterval(timer);
    }, [refresh]),
  );
  useEffect(() => {
    setDay(adminUsageDay());
  }, [userId]);
  return { counts, refresh };
}
