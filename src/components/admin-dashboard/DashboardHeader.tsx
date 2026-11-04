import { MotionPressable as Pressable } from "./DashboardInteractions";
import React, { useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import DashboardDialog from "./DashboardDialog";
import { useAdminAppSearch } from "../AdminAppSearch";
import { useAuth } from "../../hooks/useAuth";
import { usePermissions } from "../../hooks/usePermissions";
import {
  AcademicYearService,
  AcademicYear,
} from "../../services/academicYearService";
import { usePersistedSWR } from "../../hooks/usePersistedSWR";
import { TourTarget } from "../../features/app-tour";
import {
  DashboardButton,
  EmptyState,
  IconButton,
  useDashboardPalette,
} from "./primitives";

export default function DashboardHeader({
  onMenu,
  onQuickActions,
  pendingCount,
}: {
  onMenu: () => void;
  onQuickActions: () => void;
  pendingCount: number;
}) {
  const p = useDashboardPalette();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { openSearch } = useAdminAppSearch();
  const router = useRouter();
  const [headerWidth, setHeaderWidth] = useState(width);
  const [yearOpen, setYearOpen] = useState(false);
  const {
    data: year,
    loading,
    error,
    refetch,
  } = usePersistedSWR<AcademicYear>({
    cacheKey: "admin-active-academic-year",
    userId: user?.userId,
    ttlMs: 60_000,
    fetcher: AcademicYearService.getCurrentYear,
  });
  const compact = headerWidth < 1060;
  const mobile = headerWidth < 680;
  const modifier =
    Platform.OS === "web" &&
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform)
      ? "⌘"
      : "Ctrl";
  return (
    <TourTarget id="admin.navigation" native>
      <View
        onLayout={(event) => setHeaderWidth(event.nativeEvent.layout.width)}
        style={[
          s.header,
          {
            backgroundColor: p.dark
              ? "rgba(21,29,45,0.96)"
              : "rgba(255,255,255,0.88)",
            borderColor: p.line,
          },
          Platform.OS === "web" &&
            ({
              backdropFilter: "blur(18px) saturate(160%)",
              WebkitBackdropFilter: "blur(18px) saturate(160%)",
              boxShadow:
                "0 1px 0 rgba(255,255,255,.45),0 3px 16px rgba(16,24,40,.025)",
            } as any),
        ]}
      >
        <IconButton
          label="Toggle navigation"
          icon="menu-outline"
          onPress={onMenu}
        />
        {!mobile && (
          <View style={s.breadcrumb}>
            <Text style={[s.breadcrumbRoot, { color: p.secondary }]}>
              Workspace
            </Text>
            <Ionicons name="chevron-forward" size={11} color={p.secondary} />
            <Text style={[s.breadcrumbCurrent, { color: p.text }]}>
              Overview
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        {!compact ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search students, staff and school tools. Command or Control K"
            onPress={openSearch}
            style={({ hovered }) => [
              s.search,
              {
                backgroundColor: hovered ? p.tint : p.soft,
                borderColor: p.line,
              },
            ]}
          >
            <Ionicons name="search-outline" size={16} color={p.secondary} />
            <Text style={[s.searchText, { color: p.secondary }]}>
              Search anything…
            </Text>
            <Text style={[s.key, { color: p.secondary, borderColor: p.line }]}>
              {modifier} K
            </Text>
          </Pressable>
        ) : (
          <IconButton
            label="Search school"
            icon="search-outline"
            onPress={openSearch}
          />
        )}
        {!mobile && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Active academic year ${year?.code || "unavailable"}. View academic year details`}
            onPress={() => setYearOpen(true)}
            style={({ hovered }) => [
              s.year,
              { backgroundColor: hovered ? p.tint : "transparent" },
            ]}
          >
            <Ionicons
              name="calendar-clear-outline"
              size={15}
              color={p.secondary}
            />
            <Text style={[s.yearLabel, { color: p.text }]}>
              {year?.code || "Academic year"}
            </Text>
            <Ionicons name="chevron-down" size={11} color={p.secondary} />
          </Pressable>
        )}
        <IconButton
          label="Notifications"
          icon="notifications-outline"
          onPress={() => router.push("/admin/notifications")}
        />
        {pendingCount > 0 && !compact && (
          <IconButton
            label="Pending access requests"
            icon="key-outline"
            badge={pendingCount}
            onPress={() => router.push("/admin/access-requests")}
          />
        )}
        {!mobile && <View style={[s.divider, { backgroundColor: p.line }]} />}
        {mobile ? (
          <IconButton
            label="Quick actions"
            icon="add-outline"
            onPress={onQuickActions}
          />
        ) : (
          <DashboardButton
            primary
            label="Quick actions"
            icon="add"
            onPress={onQuickActions}
          />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Your profile and settings"
          onPress={() => router.push("/admin/settings")}
          style={[s.avatar, { backgroundColor: p.tint, borderColor: p.line }]}
        >
          <Text style={[s.initials, { color: p.indigo }]}>
            {(user?.displayName || "Admin")
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </Text>
        </Pressable>
        <DashboardDialog
          open={yearOpen}
          onClose={() => setYearOpen(false)}
          label="Academic year details"
          dismissLabel="Close academic year details"
          maxWidth={440}
          style={{ padding: 24 }}
        >
          <View style={s.dialogHead}>
            <Text
              accessibilityRole="header"
              style={{ fontSize: 17, fontWeight: "600", color: p.text }}
            >
              Academic year
            </Text>
            <IconButton
              label="Close"
              icon="close-outline"
              onPress={() => setYearOpen(false)}
            />
          </View>
          {loading && !year ? (
            <EmptyState loading title="Loading academic year…" />
          ) : error && !year ? (
            <EmptyState
              title="Academic year unavailable"
              onRetry={() => {
                void refetch();
              }}
            />
          ) : year ? (
            <>
              <Text style={[s.yearValue, { color: p.indigo }]}>
                {year.code}
              </Text>
              <Text
                style={{ color: p.secondary, fontSize: 13, lineHeight: 21 }}
              >
                Active school year ·{" "}
                {new Date(
                  `${year.start_date.slice(0, 10)}T12:00:00`,
                ).toLocaleDateString("en-IN")}{" "}
                –{" "}
                {new Date(
                  `${year.end_date.slice(0, 10)}T12:00:00`,
                ).toLocaleDateString("en-IN")}
              </Text>
            </>
          ) : null}
          {hasPermission("admin.manage") && (
            <View style={{ marginTop: 24 }}>
              <DashboardButton
                label="Manage academic years"
                icon="open-outline"
                onPress={() => {
                  setYearOpen(false);
                  router.push("/admin/academic-year-upgrade");
                }}
              />
            </View>
          )}
        </DashboardDialog>
      </View>
    </TourTarget>
  );
}
const s = StyleSheet.create({
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 9,
    borderBottomWidth: 1,
    zIndex: 30,
  },
  breadcrumb: { flexDirection: "row", alignItems: "center", gap: 12 },
  breadcrumbRoot: { fontSize: 12 },
  breadcrumbCurrent: { fontSize: 12, fontWeight: "600" },
  search: {
    minHeight: 38,
    width: 238,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  searchText: { fontSize: 11, flex: 1 },
  key: {
    fontSize: 9,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  year: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 9,
    borderRadius: 8,
  },
  yearLabel: { fontSize: 11, fontWeight: "500" },
  divider: { width: 1, height: 23, marginHorizontal: 5 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 5,
  },
  initials: { fontSize: 11, fontWeight: "600" },

  dialogHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  yearValue: {
    fontSize: 30,
    letterSpacing: -1,
    fontWeight: "600",
    marginBottom: 10,
  },
});
