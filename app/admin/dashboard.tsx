import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import {
  AppTourQuickAction,
  TourTarget,
  TourScrollView,
} from "@/src/features/app-tour";
import { useAuth } from "../../src/hooks/useAuth";
import { usePermissions } from "../../src/hooks/usePermissions";
import { usePersistedSWR } from "../../src/hooks/usePersistedSWR";
import { useAnalytics } from "../../src/hooks/useAnalytics";
import { useAdminSidebarItems } from "../../src/hooks/useAdminSidebarItems";
import { useAdminWebChrome } from "../../src/contexts/AdminWebChromeContext";
import { AdminService } from "../../src/services/adminService";
import { AccessControlService } from "../../src/services/accessControlService";
import {
  GovernanceService,
  ActionCenterItem,
  ActionCenterResponse,
} from "../../src/services/governanceService";
import { NoticeService, Notice } from "../../src/services/commonServices";
import type { LeaveApplication } from "../../src/services/commonServices";
import {
  getPendingStaffLeaves,
  withStaffLeaveAttention,
} from "../../src/services/dashboardLeaveService";
import { admissionService } from "../../src/services/admissionService";
import { AdmissionAnalyticsData } from "../../src/types/admission";
import { AdminDashboardStats } from "../../src/types/models";
import {
  schoolStoriesService,
  SchoolStoryAuthor,
} from "../../src/services/schoolStoriesService";
import { supabase } from "../../src/services/supabaseConfig";
import {
  buildAdminQuickActions,
  ADMIN_CORE_QUICK_ACTIONS as coreActions,
} from "../../src/constants/adminQuickActions";
import { rankQuickActionsByUsage } from "../../src/utils/quickActionRanking";
import { useAdminQuickActionUsage } from "../../src/hooks/useAdminQuickActionUsage";
import { SCHOOL_NAME } from "../../src/constants/school";
import DashboardWebSidebar, {
  DASHBOARD_SIDEBAR_COLLAPSED,
  DASHBOARD_SIDEBAR_EXPANDED,
} from "../../src/components/DashboardWebSidebar";
import DashboardNavigationDrawer from "../../src/components/admin-dashboard/DashboardNavigationDrawer";
import PaymentDueBanner from "../../src/components/PaymentDueBanner";
import SchoolStoriesStrip from "../../src/components/school-stories/SchoolStoriesStrip";
import AppTextInput from "../../src/components/AppTextInput";
import {
  useDashboardPreferences,
  DashboardSection,
} from "../../src/hooks/useDashboardPreferences";
import WorkspacePreferencesDialog from "../../src/components/admin-dashboard/WorkspacePreferencesDialog";
import DashboardWelcome from "../../src/components/admin-dashboard/DashboardWelcome";
import DashboardDialog from "../../src/components/admin-dashboard/DashboardDialog";
import SegmentedControl from "../../src/components/admin-dashboard/SegmentedControl";
import {
  MotionPressable as Pressable,
  DashboardInteractionStyles,
} from "../../src/components/admin-dashboard/DashboardInteractions";
import DashboardHeader from "../../src/components/admin-dashboard/DashboardHeader";
import CollectionChart from "../../src/components/admin-dashboard/CollectionChart";
import AdaptiveDashboardGrid, {
  DashboardGridCard,
} from "../../src/components/admin-dashboard/AdaptiveDashboardGrid";
import SchoolPulseCard, {
  SchoolPulseUnavailable,
  pulseSections,
} from "../../src/components/admin-dashboard/SchoolPulse";
import QuickActionsPanel from "../../src/components/admin-dashboard/QuickActionsPanel";
import PlanningCalendar from "../../src/components/admin-dashboard/PlanningCalendar";
import {
  DashboardButton,
  DashboardDensityProvider,
  DashboardIcon,
  DataRow,
  EmptyState,
  IconButton,
  InlineStatus,
  MetricCard,
  Panel,
  formatMoney,
  formatValue,
  useDashboardPalette,
} from "../../src/components/admin-dashboard/primitives";

const periods = [
  { key: "month", label: "Month", title: "Month to date" },
  { key: "quarter", label: "3 months", title: "Recent months" },
  { key: "year", label: "YTD", title: "Year to date" },
] as const;
const categoryIcons: Record<string, DashboardIcon> = {
  finance: "wallet-outline",
  attendance: "checkmark-circle-outline",
  governance: "checkbox-outline",
  transport: "bus-outline",
  academics: "book-outline",
  staff: "briefcase-outline",
  support: "chatbubble-outline",
  compliance: "ribbon-outline",
};

export default function AdminDashboard() {
  const p = useDashboardPalette();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const chrome = useAdminWebChrome();
  const wideWeb = Platform.OS === "web" && width >= 768;
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const collapsed = chrome.shellActive
    ? chrome.sidebarCollapsed
    : localCollapsed;
  const workspace = useDashboardPreferences(user?.userId);
  const compact = workspace.preferences.density === "compact";
  const visible = workspace.preferences.sections;
  const contentPadding = width < 600 ? 16 : compact ? 24 : 32;
  const contentWidth =
    width -
    (wideWeb
      ? collapsed
        ? DASHBOARD_SIDEBAR_COLLAPSED
        : DASHBOARD_SIDEBAR_EXPANDED
      : 0) -
    contentPadding * 2;
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");
  const { counts: usage, refresh: refreshUsage } = useAdminQuickActionUsage();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [allAttention, setAllAttention] = useState(false);
  const availableSections: DashboardSection[] = [
    "finance",
    "pulse",
    "attention",
    "quickActions",
    "calendar",
    ...(hasPermission("notices.view") ? ["notices" as const] : []),
    "insights",
    "stories",
  ];
  const [openNotice, setOpenNotice] = useState<string | null>(null);
  const navigate = useCallback(
    (route: string) => router.push(route as any),
    [router],
  );
  const stats = usePersistedSWR<AdminDashboardStats>({
    cacheKey: "admin-dashboard-stats",
    userId: user?.userId,
    ttlMs: 60_000,
    persist: true,
    enabled: !!user,
    fetcher: () => AdminService.getDashboardStats({ silent: true }),
  });
  const stories = usePersistedSWR<SchoolStoryAuthor[]>({
    cacheKey: "admin-school-stories",
    userId: user?.userId,
    ttlMs: 60_000,
    persist: true,
    enabled: !!user,
    revalidateOnMount: true,
    fetcher: () => schoolStoriesService.list(),
  });
  const actionCenter = usePersistedSWR<ActionCenterResponse>({
    cacheKey: "admin-dashboard-actions",
    userId: user?.userId,
    ttlMs: 60_000,
    enabled: !!user,
    fetcher: GovernanceService.getActionCenterData,
  });
  const canReviewLeaves =
    hasPermission("leaves.view") && hasPermission("leaves.approve");
  const staffLeaves = usePersistedSWR<LeaveApplication[]>({
    cacheKey: "admin-dashboard-staff-leaves",
    userId: user?.userId,
    ttlMs: 60_000,
    enabled: !!user && canReviewLeaves,
    revalidateOnMount: true,
    fetcher: getPendingStaffLeaves,
  });
  const approvalChecksUnavailable =
    !!actionCenter.error || (canReviewLeaves && !!staffLeaves.error);
  const retryApprovalChecks = () =>
    Promise.allSettled([actionCenter.refetch(), staffLeaves.refetch()]);
  const notices = usePersistedSWR<Notice[]>({
    cacheKey: "admin-dashboard-notices",
    userId: user?.userId,
    ttlMs: 60_000,
    enabled: hasPermission("notices.view"),
    fetcher: () => NoticeService.getAll({ userId: user?.userId }),
  });
  const admissions = usePersistedSWR<AdmissionAnalyticsData>({
    cacheKey: "admin-dashboard-admissions",
    userId: user?.userId,
    ttlMs: 60_000,
    enabled: hasPermission("admissions.view"),
    fetcher: () => admissionService.getAnalytics(),
  });
  const analytics = useAnalytics();
  const {
    financials,
    attendance,
    academics,
    staff,
    insights,
    range,
    setRange,
  } = analytics;
  const sidebarItems = useAdminSidebarItems({
    diaryToday: stats.data?.diaryEntriesToday,
    pendingRequests: pendingCount ?? undefined,
  });
  const refreshAccess = useCallback(async () => {
    if (!user || !hasPermission("admin.manage")) return;
    try {
      const requests = await AccessControlService.getPendingRequests();
      setPendingCount(requests.length);
    } catch {
      /* Unknown is not a zero. */
    }
  }, [user, hasPermission]);
  const refresh = async () => {
    setRefreshRevision((current) => current + 1);
    setRefreshing(true);
    try {
      await Promise.allSettled([
        stats.refetch(),
        analytics.refreshData(),
        actionCenter.refetch(),
        staffLeaves.refetch(),
        notices.refetch(),
        admissions.refetch(),
        stories.refetch(),
        refreshUsage(),
        refreshAccess(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => {
    if (Platform.OS !== "web" || !menuOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setQuickOpen(false);
      setMenuOpen(false);
    };
    window.addEventListener("keydown", onEscape, true);
    return () => window.removeEventListener("keydown", onEscape, true);
  }, [menuOpen]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!user || !hasPermission("admin.manage")) return;
    void refreshAccess();
    const channel = supabase
      .channel(`admin-dashboard-access-${user.userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "access_requests" },
        () => {
          void refreshAccess();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, hasPermission, refreshAccess]);
  useFocusEffect(
    useCallback(() => {
      void refreshAccess();
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          BackHandler.exitApp();
          return true;
        },
      );
      return () => subscription.remove();
    }, [refreshAccess]),
  );
  const quickActions = useMemo(() => {
    const legacyActions = buildAdminQuickActions(t);
    const legacyOrder = new Map(
      legacyActions.map((action, index) => [action.route, index]),
    );
    const permitted = [...coreActions, ...legacyActions].filter(
      (item) => !item.permission || hasPermission(item.permission),
    );
    return rankQuickActionsByUsage(
      permitted
        .filter(
          (item, index) =>
            permitted.findIndex((other) => other.route === item.route) ===
            index,
        )
        .sort(
          (a, b) =>
            (legacyOrder.get(a.route) ?? legacyActions.length) -
            (legacyOrder.get(b.route) ?? legacyActions.length),
        ),
      usage,
    );
  }, [t, hasPermission, usage]);
  const runAction = (route: string) => {
    setQuickOpen(false);
    navigate(route);
  };
  const attentionItems = useMemo(() => {
    const sections = actionCenter.data?.sections;
    const items: ActionCenterItem[] = [
      ...(sections?.critical ?? []),
      ...(sections?.needs_attention ?? []),
    ];
    if ((admissions.data?.funnel.newEnquiries ?? 0) > 0)
      items.push({
        id: "admissions",
        category: "governance",
        title: "New admission enquiries",
        description: "Welcome your next school families.",
        count: admissions.data!.funnel.newEnquiries,
        action_url: "/admin/admissions",
        action_label: "Review",
      });
    if ((stats.data?.complaints ?? 0) > 0)
      items.push({
        id: "complaints",
        category: "support",
        title: "Open complaints",
        description: "Review conversations awaiting a response.",
        count: stats.data!.complaints,
        action_url: "/admin/complaints",
      });
    if (pendingCount != null && pendingCount > 0)
      items.push({
        id: "access",
        category: "governance",
        title: "Access requests",
        description: "Review requests to join your school.",
        count: pendingCount,
        action_url: "/admin/access-requests",
      });
    return withStaffLeaveAttention(items, staffLeaves.data, canReviewLeaves);
  }, [
    actionCenter.data,
    admissions.data,
    pendingCount,
    stats.data,
    staffLeaves.data,
    canReviewLeaves,
  ]);
  const visibleNotices = useMemo(
    () =>
      [...(notices.data ?? [])]
        .filter(
          (notice) =>
            notice.is_published &&
            (!notice.expires_at ||
              new Date(notice.expires_at).getTime() > now.getTime()) &&
            (!notice.publish_at ||
              new Date(notice.publish_at).getTime() <= now.getTime()),
        )
        .sort(
          (a, b) =>
            Number(b.is_pinned) - Number(a.is_pinned) ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 3),
    [notices.data, now],
  );
  const activePeriod = periods.find((period) => period.key === range)!;
  const greeting =
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 17
        ? "Good afternoon"
        : "Good evening";
  const loading = stats.loading && !stats.data;
  const metricItems: {
    label: string;
    value: string | number;
    detail: string;
    icon: DashboardIcon;
    route: string;
    featured?: boolean;
    loading?: boolean;
  }[] = [
    {
      label: t("admin_dashboard_v2.total_students", "Total students"),
      value: stats.data?.totalStudents ?? "—",
      detail: financials?.new_enrollments
        ? `${financials.new_enrollments} new enrolments this period`
        : "Your school community",
      icon: "people-outline",
      route: "/admin/students",
      featured: true,
      loading,
    },
    {
      label: "Total staff",
      value: stats.data?.totalStaff ?? staff?.total_staff ?? "—",
      detail: "Teaching & non-teaching team",
      icon: "briefcase-outline",
      route: "/admin/manage-staff",
      loading,
    },
    {
      label: "Staff present",
      value: stats.data?.staffPresent ?? "—",
      detail: "Recorded attendance today",
      icon: "checkmark-circle-outline",
      route: "/admin/attendance",
      loading,
    },
    ...(hasPermission("admissions.view")
      ? [
          {
            label: "Admission enquiries",
            value: admissions.data?.funnel.totalEnquiries ?? "—",
            detail: admissions.data
              ? `${admissions.data.funnel.newEnquiries} new enquiries to review`
              : "Explore your admissions pipeline",
            icon: "person-add-outline" as DashboardIcon,
            route: "/admin/admissions",
            loading: admissions.loading && !admissions.data,
          },
        ]
      : [
          {
            label: "Diary entries",
            value: stats.data?.diaryEntriesToday ?? "—",
            detail: "Classroom updates today",
            icon: "book-outline" as DashboardIcon,
            route: "/admin/diary/viewer",
            loading,
          },
        ]),
    {
      label: "Total collection",
      value: formatMoney(
        financials?.lifetime_collected ?? stats.data?.collection,
      ),
      detail: "All-time recorded collections",
      icon: "wallet-outline",
      route: "/admin/finance",
      loading,
    },
    {
      label: "Outstanding fees",
      value: formatMoney(financials?.outstanding_dues),
      detail: "Open financial records",
      icon: "receipt-outline",
      route: "/admin/finance",
      loading: analytics.loading && !financials,
    },
  ];
  const operationRows: Record<
    "attendance" | "academics" | "staff" | "finance",
    { label: string; value: string; metric: string }[]
  > = {
    attendance: [
      {
        label: "Average student attendance",
        value: formatValue(attendance?.avg_attendance, "%"),
        metric: "average-attendance",
      },
      {
        label: "Students below 75% attendance",
        value: formatValue(attendance?.chronic_absentees),
        metric: "at-risk",
      },
      {
        label: "School working days",
        value: formatValue(attendance?.total_working_days),
        metric: "working-days",
      },
      {
        label: "Staff attendance",
        value: formatValue(attendance?.staff_attendance, "%"),
        metric: "staff-attendance",
      },
    ],
    academics: [
      {
        label: "Average exam score",
        value: formatValue(academics?.avg_score, "%"),
        metric: "average-score",
      },
      {
        label: "Pass rate",
        value: formatValue(academics?.pass_rate, "%"),
        metric: "pass-rate",
      },
      {
        label: "Exams conducted",
        value: formatValue(academics?.exams_conducted),
        metric: "exams-conducted",
      },
      {
        label: "Top subject",
        value: academics?.top_subject || "—",
        metric: "top-subject",
      },
      {
        label: "Subject needing support",
        value: academics?.weakest_subject || "—",
        metric: "needs-focus",
      },
    ],
    staff: [
      {
        label: "Active staff",
        value: formatValue(staff?.active_staff),
        metric: "total-staff",
      },
      {
        label: "On leave today",
        value: formatValue(staff?.on_leave_today),
        metric: "on-leave",
      },
      {
        label: "New joinings",
        value: formatValue(staff?.new_joinings),
        metric: "new-joinings",
      },
      {
        label: "Average staff attendance",
        value: formatValue(staff?.avg_staff_attendance, "%"),
        metric: "staff-attendance-rate",
      },
    ],
    finance: [
      {
        label: "All-time collections",
        value: formatMoney(financials?.lifetime_collected),
        metric: "total-collected",
      },
      {
        label: "Total invoiced",
        value: formatMoney(financials?.total_invoiced),
        metric: "collection-efficiency",
      },
      {
        label: "Discounts given",
        value: formatMoney(financials?.discount_given),
        metric: "discounts",
      },
      {
        label: "Refunds issued",
        value: formatMoney(financials?.refunds_issued),
        metric: "refunds",
      },
    ],
  };
  const openAnalytics = (metric: string) =>
    navigate(`/admin/analytics/${metric}`);
  const metricColumns = contentWidth >= 1080 ? 6 : contentWidth >= 720 ? 3 : 2;
  const metrics = (
    <View style={[s.metrics, { flexWrap: "wrap", gap: compact ? 10 : 14 }]}>
      {metricItems.map((item, index) => (
        <View
          key={item.label}
          style={{
            flexBasis: `${100 / metricColumns - 2}%`,
            flexGrow: 1,
            minWidth: 0,
          }}
        >
          <MetricCard
            {...item}
            tone={
              (
                [
                  "blue",
                  "indigo",
                  "emerald",
                  "amber",
                  "emerald",
                  "rose",
                ] as const
              )[index]
            }
            compact={compact || width < 600}
            onPress={() => navigate(item.route)}
          />
        </View>
      ))}
    </View>
  );
  const finance = (
    <Panel
      title="Fee collection"
      tone="emerald"
      icon="wallet-outline"
      subtitle="A clear view of your school’s collections"
      action={
        <IconButton
          label="Open financial overview"
          icon="open-outline"
          onPress={() => navigate("/admin/finance")}
        />
      }
    >
      {!financials ? (
        <>
          <InlineStatus
            loading={analytics.loading}
            title={
              analytics.loading
                ? "Loading fee overview…"
                : analytics.error
                  ? "Fee overview unavailable"
                  : "No fee summary recorded"
            }
            message={
              analytics.error
                ? "Recorded totals remain available below."
                : undefined
            }
            onRetry={
              analytics.error
                ? () => {
                    void analytics.refreshData();
                  }
                : undefined
            }
          />
          {stats.data?.todayCollection != null && (
            <DataRow
              title="Today's recorded collection"
              value={formatMoney(stats.data.todayCollection)}
              icon="wallet-outline"
              onPress={() => navigate("/admin/finance")}
            />
          )}
          {stats.data?.collection != null && (
            <DataRow
              title="All-time recorded collection"
              value={formatMoney(stats.data.collection)}
              icon="receipt-outline"
              onPress={() => navigate("/admin/finance")}
            />
          )}
        </>
      ) : (
        <>
          <View
            style={[
              s.financeTop,
              contentWidth < 600 && {
                flexDirection: "column",
                alignItems: "stretch",
              },
            ]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.eyebrow, { color: p.secondary }]}>
                {activePeriod.title.toUpperCase()}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Collected ${formatMoney(financials?.total_collected)}. Open revenue trend`}
                onPress={() => openAnalytics("revenue-trend")}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                  style={[s.collection, { color: p.text }]}
                >
                  {formatMoney(financials?.total_collected)}
                </Text>
              </Pressable>
            </View>
            <SegmentedControl
              label="Fee collection period"
              options={periods}
              value={range}
              onChange={setRange}
            />
          </View>
          <View style={s.chart}>
            <CollectionChart
              data={financials?.trend ?? []}
              label="Monthly collections · last 6 months"
              chartHeight={compact ? 158 : 212}
              color={p.green}
              loading={analytics.loading}
              error={!!analytics.error}
              onRetry={() => {
                void analytics.refreshData();
              }}
            />
          </View>
          <View
            style={[
              s.financeBottom,
              { borderColor: p.line, backgroundColor: p.soft },
            ]}
          >
            {[
              {
                title: "Today's collection",
                value: formatMoney(financials?.today_collection),
                metric: "today-collection",
                color: p.green,
              },
              {
                title: "Outstanding fees",
                value: formatMoney(financials?.outstanding_dues),
                metric: "outstanding-dues",
                color: p.text,
              },
              {
                title: "Collection efficiency",
                value: formatValue(financials?.collection_efficiency, "%"),
                metric: "collection-efficiency",
                color: p.indigo,
              },
            ].map((item) => (
              <Pressable
                key={item.metric}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}: ${item.value}. View details`}
                onPress={() => openAnalytics(item.metric)}
                style={s.financeMini}
              >
                <Text style={[s.financeMiniLabel, { color: p.secondary }]}>
                  {item.title}
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                  style={[s.financeMiniValue, { color: item.color }]}
                >
                  {item.value}
                </Text>
              </Pressable>
            ))}
          </View>
          {analytics.error &&
            financials &&
            (!analytics.unavailableSections?.length ||
              analytics.unavailableSections.includes("financials")) && (
              <Text
                accessibilityRole="alert"
                style={[s.dataWarning, { color: p.amber }]}
              >
                Showing the last available snapshot. Refresh to try again.
              </Text>
            )}
        </>
      )}
    </Panel>
  );
  const attention = (
    <Panel
      title="Needs your attention"
      tone="amber"
      icon="notifications-outline"
      subtitle="Your priorities, all in one place"
      action={
        <View
          style={[
            s.countPill,
            { backgroundColor: p.dark ? p.soft : "#FFF4E5" },
          ]}
        >
          <Text style={{ color: p.amber, fontSize: 11, fontWeight: "600" }}>
            {approvalChecksUnavailable && attentionItems.length === 0
              ? "—"
              : attentionItems.length}
          </Text>
        </View>
      }
    >
      {attentionItems.length === 0 &&
      ((actionCenter.loading && !actionCenter.data) ||
        (canReviewLeaves && staffLeaves.loading && !staffLeaves.data)) ? (
        <EmptyState loading title="Preparing your daily briefing…" />
      ) : attentionItems.length ? (
        (allAttention ? attentionItems : attentionItems.slice(0, 4)).map(
          (item) => (
            <DataRow
              key={item.id}
              title={item.title}
              detail={
                item.severity === "CRITICAL"
                  ? `Critical · ${item.description}`
                  : item.description
              }
              value={item.count}
              icon={categoryIcons[item.category]}
              tone={
                item.severity === "CRITICAL"
                  ? "rose"
                  : item.severity === "NEEDS_ATTENTION"
                    ? "amber"
                    : "neutral"
              }
              onPress={
                item.action_url ? () => navigate(item.action_url!) : undefined
              }
            />
          ),
        )
      ) : approvalChecksUnavailable ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Briefing unavailable"
          message="Refresh to check your school's priorities."
          onRetry={() => {
            void retryApprovalChecks();
          }}
        />
      ) : (
        <EmptyState
          icon="checkmark-done-outline"
          title={
            actionCenter.data?.summary.all_clear
              ? "A little breathing room"
              : "No pending items in this view"
          }
          message={
            actionCenter.data?.summary.empty_state_message ||
            "New items will appear here when they need your attention."
          }
        />
      )}
      {approvalChecksUnavailable && attentionItems.length > 0 && (
        <View
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: p.soft,
          }}
        >
          <Text
            style={{ flex: 1, color: p.amber, fontSize: 10, lineHeight: 16 }}
          >
            {canReviewLeaves && staffLeaves.error
              ? "Staff leave applications could not be refreshed."
              : "Some approval checks are unavailable."}
          </Text>
          <IconButton
            label="Retry approval checks"
            icon="refresh-outline"
            onPress={() => {
              void retryApprovalChecks();
            }}
          />
        </View>
      )}
      {attentionItems.length > 4 && (
        <View style={{ padding: 16 }}>
          <DashboardButton
            label={
              allAttention
                ? "Show fewer items"
                : `View all ${attentionItems.length} items`
            }
            compact
            onPress={() => setAllAttention((current) => !current)}
          />
        </View>
      )}
      {(actionCenter.data?.sections.informational ?? [])
        .slice(0, 2)
        .map((item) => (
          <DataRow
            key={item.id}
            title={item.title}
            detail={item.description}
            icon="information-circle-outline"
            onPress={
              item.action_url ? () => navigate(item.action_url!) : undefined
            }
          />
        ))}
      {actionCenter.data?.system_health && (
        <View style={[s.healthFooter, { borderColor: p.line }]}>
          {Object.entries(actionCenter.data.system_health).map(
            ([name, status]) => (
              <View key={name} style={s.healthItem}>
                <View
                  style={[
                    s.healthDot,
                    {
                      backgroundColor:
                        status === "HEALTHY"
                          ? p.green
                          : status === "CRITICAL"
                            ? p.rose
                            : status === "ATTENTION"
                              ? p.amber
                              : p.secondary,
                    },
                  ]}
                />
                <Text
                  accessibilityLabel={`${name}: ${status.toLowerCase()}`}
                  style={{
                    fontSize: 10,
                    color: p.secondary,
                    textTransform: "capitalize",
                  }}
                >
                  {name} · {status.toLowerCase()}
                </Text>
              </View>
            ),
          )}
        </View>
      )}
    </Panel>
  );
  const noticeBoard = hasPermission("notices.view") && (
    <Panel
      title="Notice board"
      tone="blue"
      icon="megaphone-outline"
      subtitle="Keep your school community in the loop"
      action={
        <IconButton
          label="View all notices"
          icon="open-outline"
          onPress={() => navigate("/admin/notices")}
        />
      }
    >
      {notices.loading && !notices.data ? (
        <EmptyState loading title="Loading school notices…" />
      ) : notices.error && !notices.data ? (
        <EmptyState
          title="Notices unavailable"
          onRetry={() => {
            void notices.refetch();
          }}
        />
      ) : !visibleNotices.length ? (
        <EmptyState
          icon="megaphone-outline"
          title="A fresh page for your school"
          message="Published notices will appear here for a quick read."
        />
      ) : (
        visibleNotices.map((notice) => (
          <View
            key={notice.id}
            style={[s.notice, { borderBottomColor: p.line }]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: openNotice === notice.id }}
              aria-expanded={openNotice === notice.id}
              accessibilityLabel={`${notice.title}. ${openNotice === notice.id ? "Collapse" : "Read"} notice`}
              onPress={() =>
                setOpenNotice((current) =>
                  current === notice.id ? null : notice.id,
                )
              }
              style={s.noticePress}
            >
              <View style={[s.noticeIcon, { backgroundColor: p.soft }]}>
                <Ionicons
                  name={notice.is_pinned ? "pin-outline" : "megaphone-outline"}
                  size={17}
                  color={p.indigo}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.noticeTitleRow}>
                  <Text style={[s.noticeTitle, { color: p.text }]}>
                    {notice.title}
                  </Text>
                  {(notice.priority === "high" ||
                    notice.priority === "urgent") && (
                    <Text style={[s.priority, { color: p.rose }]}>
                      {notice.priority}
                    </Text>
                  )}
                </View>
                <Text style={[s.noticeMeta, { color: p.secondary }]}>
                  {new Date(
                    notice.published_at ||
                      notice.publish_at ||
                      notice.created_at,
                  ).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                  {notice.author_name ? ` · ${notice.author_name}` : ""} ·{" "}
                  {notice.audiences?.join(", ") || notice.audience}
                </Text>
              </View>
              <Ionicons
                name={openNotice === notice.id ? "chevron-up" : "chevron-down"}
                size={14}
                color={p.secondary}
              />
            </Pressable>
            {(openNotice === notice.id ||
              notice.content.trim().toLowerCase() !==
                notice.title.trim().toLowerCase()) && (
              <Text
                style={[s.noticeContent, { color: p.secondary }]}
                numberOfLines={openNotice === notice.id ? undefined : 1}
              >
                {notice.content}
              </Text>
            )}
          </View>
        ))
      )}
      <View style={[s.noticeFooter, { borderColor: p.line }]}>
        <DashboardButton
          label="View all notices"
          compact
          onPress={() => navigate("/admin/notices")}
        />
        {hasPermission("notices.create") && (
          <DashboardButton
            label="Create notice"
            icon="add-outline"
            compact
            onPress={() => navigate("/admin/notices")}
          />
        )}
      </View>
    </Panel>
  );
  const pulseUnavailable =
    !!analytics.error &&
    Object.values(operationRows).every((rows) =>
      rows.every((row) => row.value === "—"),
    );
  const pulseCards: DashboardGridCard[] = pulseUnavailable
    ? [
        {
          id: "pulse-unavailable",
          node: (
            <SchoolPulseUnavailable
              onRetry={() => {
                void analytics.refreshData();
              }}
              onOpen={openAnalytics}
            />
          ),
          estimatedHeight: 180,
        },
      ]
    : pulseSections.map((section) => ({
        id: `pulse-${section.key}`,
        estimatedHeight:
          section.key === "attendance" || section.key === "academics"
            ? 330
            : 250,
        node: (
          <SchoolPulseCard
            sectionKey={section.key}
            rows={operationRows[section.key]}
            trend={
              section.key === "attendance"
                ? attendance?.trend
                : section.key === "academics"
                  ? academics?.trend
                  : undefined
            }
            period={
              section.key === "attendance"
                ? attendance?.period?.label
                : section.key === "academics"
                  ? activePeriod.title
                  : undefined
            }
            compact={compact}
            loading={
              analytics.loading &&
              !attendance &&
              !academics &&
              !staff &&
              !financials
            }
            error={!!analytics.error}
            onRetry={() => {
              void analytics.refreshData();
            }}
            onOpen={openAnalytics}
          />
        ),
      }));
  const quickStart = (
    <QuickActionsPanel
      compact={compact}
      actions={quickActions}
      onAction={runAction}
      onBrowse={() => {
        setQuickSearch("");
        setQuickOpen(true);
      }}
    />
  );
  const visibleInsights = insights.filter(
    (insight) =>
      !(insight.category === "academic" && academics?.exams_conducted === 0),
  );
  const schoolInsights = visibleInsights.length > 0 && (
    <Panel
      title="School insights"
      subtitle="Signals from your school's real data"
      tone="rose"
      icon="sparkles-outline"
    >
      {visibleInsights.map((insight) => (
        <DataRow
          key={insight.id}
          title={insight.message}
          detail={insight.action_label}
          icon="sparkles-outline"
          tone={
            insight.severity === "high"
              ? "rose"
              : insight.severity === "medium"
                ? "amber"
                : "neutral"
          }
          onPress={() =>
            navigate(
              `/admin/analytics/active-alerts?insightId=${encodeURIComponent(insight.id)}`,
            )
          }
        />
      ))}
    </Panel>
  );
  const schoolLife = (
    <Panel
      title="School life"
      tone="rose"
      icon="images-outline"
      subtitle="Small moments. A connected community."
      action={
        <IconButton
          label="Open school stories"
          icon="open-outline"
          onPress={() => navigate("/admin/school-stories")}
        />
      }
    >
      <SchoolStoriesStrip
        stories={stories.data ?? []}
        canAdd
        addPhotoUrl={user?.photoUrl}
        tone={p.dark ? "onDark" : "onLight"}
        accentColor={p.indigo}
        onPublished={async () => {
          await stories.refetch();
        }}
        style={{ paddingHorizontal: 18, paddingBottom: 18 }}
      />
    </Panel>
  );
  const ordinaryCards: Partial<Record<DashboardSection, DashboardGridCard>> = {
    finance: {
      id: "finance",
      node: finance,
      estimatedHeight: financials ? 420 : 160,
    },
    attention: {
      id: "attention",
      node: attention,
      estimatedHeight: 150 + Math.min(attentionItems.length, 4) * 60,
    },
    quickActions: {
      id: "quickActions",
      node: quickStart,
      estimatedHeight: compact ? 410 : 560,
    },
    calendar: {
      id: "calendar",
      node: <PlanningCalendar refreshKey={refreshRevision} compact={compact} />,
      estimatedHeight: 460,
    },
    notices: {
      id: "notices",
      node: noticeBoard,
      estimatedHeight: 150 + visibleNotices.length * 80,
    },
    insights: { id: "insights", node: schoolInsights, estimatedHeight: 160 },
    stories: { id: "stories", node: schoolLife, estimatedHeight: 175 },
  };
  const cardOrder: DashboardSection[] =
    contentWidth < 720
      ? [
          "attention",
          "finance",
          "quickActions",
          "pulse",
          "calendar",
          "notices",
          "insights",
          "stories",
        ]
      : [
          "attention",
          "finance",
          "quickActions",
          "calendar",
          "pulse",
          "notices",
          "insights",
          "stories",
        ];
  const dashboardCards = cardOrder.flatMap((id) =>
    !visible[id] || !availableSections.includes(id)
      ? []
      : id === "pulse"
        ? pulseCards
        : ordinaryCards[id]?.node
          ? [ordinaryCards[id]!]
          : [],
  );
  return (
    <DashboardDensityProvider compact={compact}>
      <TourTarget id="screen.admin-dashboard.workspace" native>
        <View
          testID="premium-admin-dashboard"
          style={[s.root, { backgroundColor: p.bg }]}
        >
          <StatusBar barStyle={p.dark ? "light-content" : "dark-content"} />
          <DashboardInteractionStyles />
          <TourTarget id="screen.admin-dashboard.overview">
            <DashboardHeader
              pendingCount={pendingCount ?? 0}
              onMenu={() =>
                wideWeb
                  ? chrome.shellActive
                    ? chrome.setSidebarCollapsed((current) => !current)
                    : setLocalCollapsed((current) => !current)
                  : setMenuOpen(true)
              }
              onQuickActions={() => {
                setQuickSearch("");
                setQuickOpen(true);
              }}
            />
          </TourTarget>
          <View style={{ flex: 1, flexDirection: "row", minHeight: 0 }}>
            {wideWeb && !chrome.shellActive && (
              <DashboardWebSidebar collapsed={collapsed} items={sidebarItems} />
            )}
            <TourScrollView
              style={{ flex: 1, minWidth: 0 }}
              contentContainerStyle={[
                s.scroll,
                {
                  paddingHorizontal: contentPadding,
                  paddingBottom: Math.max(36, insets.bottom + 20),
                },
              ]}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={refresh}
                  tintColor={p.indigo}
                />
              }
            >
              <Animated.View
                entering={reducedMotion ? undefined : FadeIn.duration(260)}
                style={[s.content, { gap: compact ? 20 : 28 }]}
              >
                <PaymentDueBanner />
                <DashboardWelcome
                  greeting={greeting}
                  name={user?.displayName?.split(" ")[0] || "Admin"}
                  displayName={user?.displayName || "Administrator"}
                  photoUrl={user?.photoUrl}
                  userId={user?.userId}
                  school={SCHOOL_NAME}
                  date={now}
                  diary={stats.data?.diaryEntriesToday}
                  collected={
                    financials?.today_collection ?? stats.data?.todayCollection
                  }
                  complaints={stats.data?.complaints}
                  compact={compact}
                  narrow={contentWidth < 850}
                  refreshing={refreshing}
                  onRefresh={() => {
                    void refresh();
                  }}
                  onCustomize={() => setPreferencesOpen(true)}
                  customizeReady={workspace.ready}
                  onNavigate={navigate}
                />
                {(stats.error ||
                  analytics.error ||
                  actionCenter.error ||
                  loading) && (
                  <View
                    accessibilityLiveRegion="polite"
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    {[
                      {
                        label: stats.error
                          ? stats.data
                            ? "Saved school totals"
                            : "School totals unavailable"
                          : stats.loading && !stats.data
                            ? "Loading school totals"
                            : "School totals ready",
                        warning: !!stats.error,
                      },
                      {
                        label: analytics.error
                          ? financials || attendance || staff || academics
                            ? "Partial analytics"
                            : "Analytics unavailable"
                          : analytics.loading
                            ? "Loading analytics"
                            : "Analytics ready",
                        warning: !!analytics.error,
                      },
                      {
                        label: actionCenter.error
                          ? "Approvals unavailable"
                          : actionCenter.loading
                            ? "Checking approvals"
                            : "Approvals checked",
                        warning: !!actionCenter.error,
                      },
                    ].map((source) => (
                      <View
                        key={source.label}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Ionicons
                          name={
                            source.warning ? "cloud-offline-outline" : "ellipse"
                          }
                          size={source.warning ? 12 : 5}
                          color={source.warning ? p.amber : p.secondary}
                        />
                        <Text
                          style={{
                            fontSize: 10,
                            color: source.warning ? p.amber : p.secondary,
                          }}
                        >
                          {source.label}
                        </Text>
                      </View>
                    ))}
                    <View style={{ flex: 1 }} />
                    {analytics.generatedAt && (
                      <Text style={{ color: p.secondary, fontSize: 10 }}>
                        Analytics updated{" "}
                        {new Date(analytics.generatedAt).toLocaleTimeString(
                          "en-IN",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </Text>
                    )}
                    {(stats.error || analytics.error || actionCenter.error) && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Retry unavailable dashboard data"
                        onPress={() => {
                          void refresh();
                        }}
                        style={{
                          minHeight: 28,
                          justifyContent: "center",
                          paddingHorizontal: 8,
                        }}
                      >
                        <Text
                          style={{
                            color: p.indigo,
                            fontSize: 11,
                            fontWeight: "600",
                          }}
                        >
                          Retry unavailable data ↻
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
                {metrics}
                {dashboardCards.length > 0 && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 8,
                      paddingTop: 8,
                    }}
                  >
                    <Text
                      accessibilityRole="header"
                      style={{
                        fontSize: 18,
                        fontWeight: "600",
                        letterSpacing: -0.4,
                        color: p.text,
                      }}
                    >
                      Your daily overview
                    </Text>
                    <Text style={{ fontSize: 12, color: p.secondary }}>
                      Priorities, progress & what’s next
                    </Text>
                  </View>
                )}
                <AdaptiveDashboardGrid
                  cards={dashboardCards}
                  initialWidth={contentWidth}
                  gap={compact ? 20 : 24}
                />
                {dashboardCards.length === 0 && (
                  <EmptyState
                    icon="options-outline"
                    title="Choose what matters to you"
                    message="Use Customize to add sections to your workspace."
                  />
                )}
                <AppTourQuickAction portal="admin" />
                <View style={[s.footer, { borderTopColor: p.line }]}>
                  <Text style={{ color: p.secondary, fontSize: 10 }}>
                    {SCHOOL_NAME} · Administration workspace
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={12}
                      color={p.secondary}
                    />
                    <Text style={{ color: p.secondary, fontSize: 10 }}>
                      Your school. Thoughtfully connected.
                    </Text>
                  </View>
                </View>
              </Animated.View>
            </TourScrollView>
          </View>
          <WorkspacePreferencesDialog
            open={preferencesOpen}
            onClose={() => setPreferencesOpen(false)}
            preferences={workspace.preferences}
            onChange={workspace.update}
            onReset={workspace.reset}
            availableSections={availableSections}
          />
          <DashboardNavigationDrawer
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            items={sidebarItems}
            onNavigate={navigate}
          />
          <DashboardDialog
            open={quickOpen}
            onClose={() => setQuickOpen(false)}
            label="Quick actions"
            dismissLabel="Dismiss quick actions"
            maxWidth={560}
          >
            <View style={s.dialogHead}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  accessibilityRole="header"
                  style={[s.dialogTitle, { color: p.text }]}
                >
                  What would you like to do?
                </Text>
                <Text
                  style={{ fontSize: 12, color: p.secondary, marginTop: 6 }}
                >
                  Your school tools, one step away.
                </Text>
              </View>
              <IconButton
                label="Close quick actions"
                icon="close-outline"
                onPress={() => setQuickOpen(false)}
              />
            </View>
            <AppTextInput
              autoFocus
              placeholder="Find an action…"
              accessibilityLabel="Find a quick action"
              value={quickSearch}
              onChangeText={setQuickSearch}
              style={[
                s.actionSearch,
                {
                  color: p.text,
                  borderColor: p.line,
                  backgroundColor: p.soft,
                },
              ]}
            />
            <ScrollView
              style={{ maxHeight: 420 }}
              keyboardShouldPersistTaps="handled"
            >
              {quickActions
                .filter((action) =>
                  `${action.title} ${action.category}`
                    .toLowerCase()
                    .includes(quickSearch.trim().toLowerCase()),
                )
                .map((action) => (
                  <DataRow
                    key={action.route}
                    title={action.title}
                    detail={action.category}
                    icon={action.icon}
                    onPress={() => runAction(action.route)}
                  />
                ))}
              {!quickActions.some((action) =>
                `${action.title} ${action.category}`
                  .toLowerCase()
                  .includes(quickSearch.trim().toLowerCase()),
              ) && (
                <EmptyState
                  icon="search-outline"
                  title="No matching actions"
                  message="Try a different name or school activity."
                />
              )}
            </ScrollView>
          </DashboardDialog>
        </View>
      </TourTarget>
    </DashboardDensityProvider>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  scroll: { paddingTop: 24, alignItems: "center" },
  content: { width: "100%", maxWidth: 1640, gap: 24 },

  eyebrow: { fontSize: 9, letterSpacing: 1.3, fontWeight: "600" },

  metrics: { flexDirection: "row", gap: 14 },

  financeTop: {
    paddingTop: 8,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 18,
  },
  collection: {
    fontSize: 33,
    fontWeight: "600",
    letterSpacing: -1.2,
    marginTop: 9,
    fontVariant: ["tabular-nums"],
  },

  chart: { paddingHorizontal: 22, paddingBottom: 18, paddingTop: 6 },
  financeBottom: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 16,
    gap: 12,
  },
  financeMini: { flex: 1, minWidth: 100, paddingHorizontal: 10, gap: 9 },
  financeMiniLabel: { fontSize: 11, lineHeight: 17 },
  financeMiniValue: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  dataWarning: { fontSize: 11, padding: 14, lineHeight: 18 },
  countPill: {
    minWidth: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  healthFooter: {
    padding: 16,
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  healthItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  healthDot: { width: 5, height: 5, borderRadius: 3 },
  notice: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noticePress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
  },
  noticeIcon: {
    width: 35,
    height: 35,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  noticeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  noticeTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    flexShrink: 1,
  },
  priority: { fontSize: 9, fontWeight: "600", textTransform: "capitalize" },
  noticeMeta: { fontSize: 10, lineHeight: 17, marginTop: 4 },
  noticeContent: { fontSize: 12, lineHeight: 19, marginLeft: 47, marginTop: 7 },
  noticeFooter: {
    padding: 17,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  footer: {
    borderTopWidth: 1,
    paddingTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },

  dialogHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 24,
    paddingBottom: 18,
    gap: 10,
  },
  dialogTitle: { fontSize: 18, fontWeight: "600", letterSpacing: -0.5 },
  actionSearch: {
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 13,
    fontSize: 13,
  },
});
