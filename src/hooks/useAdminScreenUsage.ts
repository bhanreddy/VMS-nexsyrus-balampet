import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "./useAuth";
import { usePermissions } from "./usePermissions";
import {
  ADMIN_CORE_QUICK_ACTIONS,
  buildAdminQuickActions,
} from "../constants/adminQuickActions";
import { recordAdminScreenOpen } from "../services/adminQuickActionUsage";
import { resolveQuickActionRoute } from "../utils/quickActionRanking";

/** One counter at navigation level covers cards, sidebar, search and deep links. */
export function useAdminScreenUsage() {
  const { user, role } = useAuth();
  const { hasPermission } = usePermissions();
  const { t } = useTranslation();
  const pathname = usePathname();
  const previous = useRef("");
  const enabled =
    role === "admin" ||
    role === "principal" ||
    user?.roles?.some((value) => value === "admin" || value === "principal");
  const routes = useMemo(
    () =>
      [...ADMIN_CORE_QUICK_ACTIONS, ...buildAdminQuickActions(t)]
        .filter(
          (action) => !action.permission || hasPermission(action.permission),
        )
        .map((action) => action.route),
    [t, hasPermission],
  );
  const route = resolveQuickActionRoute(pathname, routes);
  useEffect(() => {
    const identity =
      enabled && user?.userId ? `${user.userId}:${route || pathname}` : "";
    if (identity === previous.current) return;
    previous.current = identity;
    if (enabled && user?.userId && route)
      void recordAdminScreenOpen(user.userId, route);
  }, [enabled, pathname, route, user?.userId]);
}
