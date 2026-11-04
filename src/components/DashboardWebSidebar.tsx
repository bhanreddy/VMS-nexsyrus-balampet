import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import { SCHOOL_NAME } from "../constants/school";
import { SCHOOL_CONFIG } from "../constants/schoolConfig";
import {
  buildSidebarSections,
  COMPACT_SIDEBAR_GROUPS,
  sidebarRouteActive,
} from "../constants/adminSidebarPresentation";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { useAdminWebChrome } from "../contexts/AdminWebChromeContext";
import { useAdminAppSearch } from "./AdminAppSearch";
import AppTextInput from "./AppTextInput";
import {
  MotionPressable as Pressable,
  dashboardData,
} from "./admin-dashboard/DashboardInteractions";
import SidebarTooltip from "./admin-dashboard/SidebarTooltip";
import SidebarModuleFlyout, {
  SidebarFlyoutModule,
} from "./admin-dashboard/SidebarModuleFlyout";
import {
  useSidebarPalette,
  sidebarAccent,
  SidebarPalette,
} from "./admin-dashboard/sidebarPalette";
export { ADMIN_SIDEBAR_GROUPS } from "../constants/adminSidebarPresentation";

export const DASHBOARD_SIDEBAR_EXPANDED = 256;
export const DASHBOARD_SIDEBAR_COLLAPSED = 76;
type IconName = React.ComponentProps<typeof Ionicons>["name"];
export interface WebSidebarActionItem {
  title: string;
  icon: IconName;
  route: string;
  gradient: [string, string];
  badge?: number;
  category?: string;
}
type Anchor = { left: number; top: number; width: number; height: number };

export default function DashboardWebSidebar({
  collapsed,
  items,
  onNavigate,
  onClose,
  widthOverride,
}: {
  collapsed: boolean;
  items: WebSidebarActionItem[];
  onNavigate?: (route: string) => void;
  onClose?: () => void;
  widthOverride?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const p = useSidebarPalette();
  const s = useMemo(() => createStyles(p), [p]);
  const themeAction = isDark ? "Switch to light mode" : "Switch to dark mode";
  const { setSidebarCollapsed } = useAdminWebChrome();
  const { openSearch } = useAdminAppSearch();
  const reduced = useReducedMotion();
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [flyout, setFlyout] = useState<SidebarFlyoutModule | null>(null);
  const [tooltip, setTooltip] = useState<{
    id: string;
    label: string;
    anchor: Anchor;
  } | null>(null);
  const searchInput = useRef<React.ElementRef<typeof AppTextInput>>(null);
  const grouped = useMemo(
    () => buildSidebarSections(items, query),
    [items, query],
  );
  const unfiltered = useMemo(() => buildSidebarSections(items), [items]);
  const closeFlyout = useCallback(() => setFlyout(null), []);
  const changeTheme = () => {
    setTooltip(null);
    toggleTheme();
  };
  useEffect(() => {
    const current = unfiltered.sections.find((section) =>
      section.items.some((item) => sidebarRouteActive(pathname, item.route)),
    );
    if (current)
      setOpenGroups((previous) =>
        previous.includes(current.category)
          ? previous
          : [...previous, current.category],
      );
  }, [pathname, unfiltered]);
  useEffect(() => {
    setFlyout(null);
    setTooltip(null);
    setQuery("");
  }, [collapsed, pathname]);
  const navigate = (route: string) => {
    setFlyout(null);
    setTooltip(null);
    if (onNavigate) onNavigate(route);
    else router.push(route as any);
  };
  const anchorFor = (target: unknown): Anchor => {
    if (Platform.OS === "web" && target instanceof HTMLElement) {
      const rect = target.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    }
    return { left: 12, top: 110, width: 52, height: 44 };
  };
  const revealTooltip = (id: string, label: string, target: unknown) => {
    if (collapsed && !flyout)
      setTooltip({ id, label, anchor: anchorFor(target) });
  };
  const tooltipProps = (id: string, label: string) => ({
    onHoverIn: (event: { currentTarget: unknown }) =>
      revealTooltip(id, label, event.currentTarget),
    onFocus: (event: { currentTarget: unknown }) =>
      revealTooltip(id, label, event.currentTarget),
    onHoverOut: () => setTooltip(null),
    onBlur: () => setTooltip(null),
    "aria-describedby": tooltip?.id === id ? id : undefined,
  });
  const renderItem = (item: WebSidebarActionItem, nested = false) => {
    const active = sidebarRouteActive(pathname, item.route);
    const id = `sidebar-tool-${item.route.replace(/[^a-z0-9]/gi, "-")}`;
    return (
      <Pressable
        key={item.route}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        accessibilityState={{ selected: active }}
        aria-current={active ? "page" : undefined}
        {...tooltipProps(id, item.title)}
        onPress={() => navigate(item.route)}
        style={({ hovered, pressed }) => [
          s.item,
          nested && s.nestedItem,
          collapsed && s.railItem,
          active && s.activeItem,
          hovered && !active && s.hoveredItem,
          pressed && { opacity: 0.88 },
        ]}
      >
        {active && (
          <>
            <LinearGradient
              pointerEvents="none"
              colors={p.activeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 10 }]}
            />
            <View style={s.activeMark} />
          </>
        )}
        <View
          style={[
            s.itemIcon,
            active && {
              backgroundColor: p.activeIconBg,
              borderColor: p.activeIconBorder,
            },
          ]}
        >
          <Ionicons
            name={item.icon}
            size={18}
            color={active ? p.activeIcon : p.icon}
          />
        </View>
        {!collapsed && (
          <Text numberOfLines={1} style={[s.itemText, active && s.activeText]}>
            {item.title}
          </Text>
        )}
        {!!item.badge &&
          item.badge > 0 &&
          (collapsed ? (
            <View style={s.railBadge} />
          ) : (
            <Text style={s.badge}>{item.badge > 99 ? "99+" : item.badge}</Text>
          ))}
        {!collapsed && active && (
          <Ionicons name="chevron-forward" size={11} color={p.accent} />
        )}
      </Pressable>
    );
  };
  const renderGroup = (section: (typeof grouped.sections)[number]) => {
    const { meta, category } = section;
    const color = sidebarAccent(meta.color, isDark);
    const active = section.items.some((item) =>
      sidebarRouteActive(pathname, item.route),
    );
    const open = !!query.trim() || openGroups.includes(category);
    const badge = section.items.reduce(
      (sum, item) => sum + Math.max(0, item.badge || 0),
      0,
    );
    const id = `sidebar-group-${category}`;
    return (
      <View key={category}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={meta.label}
          accessibilityState={{
            expanded: collapsed ? flyout?.key === category : open,
          }}
          aria-expanded={collapsed ? flyout?.key === category : open}
          aria-haspopup={collapsed ? "dialog" : undefined}
          {...tooltipProps(id, meta.label)}
          onPress={(event) => {
            const anchor = anchorFor(event.currentTarget);
            setTooltip(null);
            if (collapsed)
              setFlyout((current) =>
                current?.key === category
                  ? null
                  : {
                      key: category,
                      label: meta.shortLabel,
                      icon: meta.icon,
                      color: meta.color,
                      items: section.items,
                      anchor,
                    },
              );
            else
              setOpenGroups((current) =>
                current.includes(category)
                  ? current.filter((key) => key !== category)
                  : [...current, category],
              );
          }}
          style={({ hovered }) => [
            s.item,
            collapsed && s.railItem,
            (hovered || flyout?.key === category) && s.hoveredItem,
            active && !open && { backgroundColor: p.hover },
          ]}
        >
          <View
            style={[
              s.itemIcon,
              {
                backgroundColor: `${color}${isDark ? "0D" : "0C"}`,
                borderColor: `${color}${isDark ? "12" : "1C"}`,
              },
            ]}
          >
            <Ionicons name={meta.icon} size={18} color={color} />
          </View>
          {!collapsed && (
            <>
              <Text
                numberOfLines={1}
                style={[s.itemText, active && { color: p.accent }]}
              >
                {meta.shortLabel}
              </Text>
              {badge > 0 ? (
                <Text style={s.badge}>{badge}</Text>
              ) : (
                <Ionicons
                  name={open ? "chevron-down" : "chevron-forward"}
                  size={11}
                  color={p.muted}
                />
              )}
            </>
          )}
          {collapsed && (badge > 0 || active) && (
            <View style={[s.railBadge, { backgroundColor: color }]} />
          )}
        </Pressable>
        {!collapsed && open && (
          <View
            {...dashboardData({ sidebarSubmenu: "true" })}
            style={s.submenu}
          >
            {section.items.map((item) => renderItem(item, true))}
          </View>
        )}
      </View>
    );
  };
  const compactSections = unfiltered.sections.filter((section) =>
    COMPACT_SIDEBAR_GROUPS.includes(section.category),
  );
  const moreItems = unfiltered.sections
    .filter((section) => !COMPACT_SIDEBAR_GROUPS.includes(section.category))
    .flatMap((section) => section.items);
  const initials = (user?.displayName || "Admin")
    .split(" ")
    .filter(Boolean)
    .map((name) => name[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <View
      role="navigation"
      accessibilityLabel="School administration"
      {...dashboardData({
        premiumSidebar: collapsed ? "collapsed" : "expanded",
      })}
      style={[
        s.sidebar,
        {
          width:
            widthOverride ??
            (collapsed
              ? DASHBOARD_SIDEBAR_COLLAPSED
              : DASHBOARD_SIDEBAR_EXPANDED),
        },
        Platform.OS === "web" &&
          ({
            transition: reduced
              ? "none"
              : "width 220ms cubic-bezier(.2,.8,.2,1)",
          } as any),
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={p.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={s.edgeHighlight} />
      {Platform.OS === "web" &&
        React.createElement(
          "style",
          null,
          `
      [data-premium-sidebar] :focus-visible,[data-sidebar-flyout] :focus-visible {outline:2px solid ${p.focus}!important;outline-offset:2px}
      [data-sidebar-submenu] {animation:sidebar-reveal 160ms ease-out both}
      [data-sidebar-flyout] {animation:sidebar-flyout-in 160ms cubic-bezier(.16,1,.3,1) both}
      @keyframes sidebar-reveal {from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)}}
      @keyframes sidebar-flyout-in {from{opacity:0;transform:translateX(-5px)}to{opacity:1;transform:translateX(0)}}
      @media(prefers-reduced-motion:reduce){[data-premium-sidebar],[data-sidebar-submenu],[data-sidebar-flyout]{animation:none!important;transition:none!important}}
    `,
        )}
      <View style={[s.brand, collapsed && s.brandCollapsed]}>
        <View style={s.logoRim}>
          <View style={s.logo}>
            <Image
              source={SCHOOL_CONFIG.logo}
              style={{ width: 29, height: 29, resizeMode: "contain" }}
            />
          </View>
        </View>
        {!collapsed && (
          <>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={2} style={s.schoolName}>
                {SCHOOL_NAME}
              </Text>
              <Text style={s.brandCaption}>SCHOOL WORKSPACE</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                onClose ? "Close navigation" : "Collapse sidebar"
              }
              onPress={onClose ?? (() => setSidebarCollapsed(true))}
              style={s.smallControl}
            >
              <Ionicons
                name={onClose ? "close-outline" : "contract-outline"}
                size={16}
                color={p.icon}
              />
            </Pressable>
          </>
        )}
      </View>
      {!collapsed ? (
        <>
          <View style={s.context}>
            <View style={s.contextGlyph}>
              <Ionicons name="layers-outline" size={14} color={p.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.contextTitle}>Administration</Text>
              <Text style={s.contextSubtitle}>Your school, connected</Text>
            </View>
            <Ionicons name="lock-closed-outline" size={11} color={p.muted} />
          </View>
          <View style={s.search}>
            <Ionicons name="search-outline" size={15} color={p.muted} />
            <AppTextInput
              ref={searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Find a tool…"
              placeholderTextColor={p.muted}
              accessibilityLabel="Search sidebar tools"
              onSubmitEditing={() => {
                const result =
                  grouped.overview[0] || grouped.sections[0]?.items[0];
                if (query.trim() && result) navigate(result.route);
              }}
              style={s.searchInput}
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear sidebar search"
                onPress={() => {
                  setQuery("");
                  searchInput.current?.focus();
                }}
                style={s.clearSearch}
              >
                <Ionicons name="close-circle" size={15} color={p.icon} />
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open command search"
                onPress={openSearch}
                style={s.commandKey}
              >
                <Text style={s.keyText}>
                  {Platform.OS === "web" &&
                  typeof navigator !== "undefined" &&
                  /Mac|iPhone|iPad/.test(navigator.platform)
                    ? "⌘ K"
                    : "Ctrl K"}
                </Text>
              </Pressable>
            )}
          </View>
        </>
      ) : (
        <View style={s.railControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Expand sidebar"
            onPress={() => setSidebarCollapsed(false)}
            {...tooltipProps("sidebar-expand", "Expand sidebar")}
            style={({ hovered }) => [s.railControl, hovered && s.hoveredItem]}
          >
            <Ionicons name="expand-outline" size={17} color={p.icon} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search school tools"
            onPress={openSearch}
            {...tooltipProps("sidebar-search", "Search school tools · ⌘ K")}
            style={({ hovered }) => [s.railControl, hovered && s.hoveredItem]}
          >
            <Ionicons name="search-outline" size={19} color={p.icon} />
          </Pressable>
        </View>
      )}
      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        onScroll={() => setTooltip(null)}
        scrollEventThrottle={100}
        contentContainerStyle={{
          paddingHorizontal: collapsed ? 12 : 14,
          paddingBottom: 16,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!collapsed && grouped.overview.length > 0 && (
          <Text style={s.sectionLabel}>WORKSPACE</Text>
        )}
        {(collapsed ? unfiltered.overview : grouped.overview).map((item) =>
          renderItem(item),
        )}
        {collapsed ? (
          <>
            <View style={s.railDivider} />
            {compactSections.map(renderGroup)}
            {moreItems.length > 0 && (
              <>
                <View style={s.railDivider} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="More school tools"
                  aria-haspopup="dialog"
                  aria-expanded={flyout?.key === "more"}
                  {...tooltipProps(
                    "sidebar-more",
                    "More tools · Administration & support",
                  )}
                  onPress={(event) => {
                    setTooltip(null);
                    setFlyout({
                      key: "more",
                      label: "More school tools",
                      icon: "apps-outline",
                      color: "#BCA8F0",
                      items: moreItems,
                      anchor: anchorFor(event.currentTarget),
                    });
                  }}
                  style={({ hovered }) => [
                    s.item,
                    s.railItem,
                    hovered && s.hoveredItem,
                  ]}
                >
                  <Ionicons name="apps-outline" size={19} color={p.accent} />
                </Pressable>
              </>
            )}
          </>
        ) : (
          grouped.sections.map((section, index) => (
            <React.Fragment key={section.category}>
              {grouped.sections[index - 1]?.meta.cluster !==
                section.meta.cluster && (
                <View style={s.sectionHead}>
                  <Text style={s.sectionLabel}>
                    {section.meta.cluster.toUpperCase()}
                  </Text>
                  <Text style={s.sectionCounter}>
                    {
                      grouped.sections.filter(
                        (group) => group.meta.cluster === section.meta.cluster,
                      ).length
                    }
                  </Text>
                </View>
              )}
              {renderGroup(section)}
            </React.Fragment>
          ))
        )}
        {!collapsed && !grouped.overview.length && !grouped.sections.length && (
          <View style={s.empty}>
            <Ionicons name="search-outline" size={23} color={p.accent} />
            <Text style={s.emptyTitle}>No matching tools</Text>
            <Text style={s.emptyText}>Try a name, module or activity.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset sidebar search"
              onPress={() => setQuery("")}
              style={s.reset}
            >
              <Text style={s.resetText}>Clear search</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
      <View style={[s.footer, collapsed && { paddingHorizontal: 12 }]}>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Dark mode"
          accessibilityHint={themeAction}
          accessibilityState={{ checked: isDark }}
          aria-checked={isDark}
          onPress={changeTheme}
          {...(Platform.OS === "web"
            ? {
                onKeyDown: (event: React.KeyboardEvent) => {
                  if (event.key === " ") {
                    event.preventDefault();
                    if (!event.repeat) changeTheme();
                  }
                },
              }
            : {})}
          {...tooltipProps("sidebar-theme", themeAction)}
          style={({ hovered }) => [
            s.themeControl,
            collapsed && { justifyContent: "center", paddingHorizontal: 0 },
            hovered && s.hoveredItem,
          ]}
        >
          <Ionicons
            name={isDark ? "moon-outline" : "sunny-outline"}
            size={18}
            color={isDark ? p.accent : p.modeIcon}
          />
          {!collapsed && (
            <>
              <Text style={s.settingsText}>
                {isDark ? "Dark mode" : "Light mode"}
              </Text>
              <View
                pointerEvents="none"
                style={[
                  s.themeTrack,
                  isDark && {
                    backgroundColor: p.switchOn,
                    borderColor: p.switchOnLine,
                  },
                ]}
              >
                <View
                  style={[
                    s.themeThumb,
                    { alignSelf: isDark ? "flex-end" : "flex-start" },
                  ]}
                />
              </View>
            </>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="School settings"
          onPress={() => navigate("/admin/settings")}
          {...tooltipProps("sidebar-settings", "School settings")}
          style={({ hovered }) => [
            s.settings,
            collapsed && { justifyContent: "center", paddingHorizontal: 0 },
            hovered && s.hoveredItem,
          ]}
        >
          <Ionicons name="settings-outline" size={18} color={p.icon} />
          {!collapsed && (
            <>
              <Text style={s.settingsText}>Workspace settings</Text>
              <Ionicons name="chevron-forward" size={11} color={p.muted} />
            </>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Your profile and settings"
          onPress={() => navigate("/admin/settings")}
          {...tooltipProps(
            "sidebar-profile",
            user?.displayName || "Your profile",
          )}
          style={({ hovered }) => [
            s.profile,
            collapsed && { justifyContent: "center", paddingHorizontal: 0 },
            hovered && { backgroundColor: p.hover },
          ]}
        >
          <LinearGradient colors={p.avatarGradient} style={s.avatar}>
            <Text style={s.initials}>{initials}</Text>
          </LinearGradient>
          {!collapsed && (
            <>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={s.profileName}>
                  {user?.displayName || "Administrator"}
                </Text>
                <Text numberOfLines={1} style={s.profileRole}>
                  {user?.role?.name || "School administrator"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={12} color={p.muted} />
            </>
          )}
        </Pressable>
      </View>
      {tooltip && !flyout && (
        <SidebarTooltip
          id={tooltip.id}
          label={tooltip.label}
          anchor={tooltip.anchor}
        />
      )}
      <SidebarModuleFlyout
        module={flyout}
        pathname={pathname}
        onClose={closeFlyout}
        onNavigate={navigate}
      />
    </View>
  );
}
const createStyles = (p: SidebarPalette) =>
  StyleSheet.create({
    sidebar: {
      height: "100%",
      minHeight: 0,
      backgroundColor: p.surface,
      borderRightWidth: 1,
      borderRightColor: p.line,
      zIndex: 20,
    },
    edgeHighlight: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: p.edge,
    },
    brand: {
      minHeight: 84,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 19,
      paddingBottom: 16,
    },
    brandCollapsed: {
      paddingHorizontal: 15,
      justifyContent: "center",
      minHeight: 80,
    },
    logoRim: {
      width: 43,
      height: 43,
      borderRadius: 14,
      padding: 3,
      backgroundColor: p.rimBg,
      borderWidth: 1,
      borderColor: p.rim,
    },
    logo: {
      flex: 1,
      backgroundColor: "#FFF",
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    schoolName: {
      color: p.text,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
      letterSpacing: -0.15,
    },
    brandCaption: {
      color: p.muted,
      fontSize: 7,
      letterSpacing: 1.6,
      marginTop: 5,
      fontWeight: "500",
    },
    smallControl: {
      width: 26,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 7,
    },
    context: {
      marginHorizontal: 16,
      marginBottom: 13,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      borderWidth: 1,
      borderColor: p.contextLine,
      borderRadius: 11,
      padding: 10,
      backgroundColor: p.context,
    },
    contextGlyph: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: p.accentSoft,
      justifyContent: "center",
      alignItems: "center",
    },
    contextTitle: {
      color: p.text,
      fontSize: 11,
      fontWeight: "600",
      lineHeight: 16,
    },
    contextSubtitle: { color: p.muted, fontSize: 9, lineHeight: 14 },
    search: {
      minHeight: 39,
      marginHorizontal: 16,
      marginBottom: 8,
      paddingHorizontal: 9,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: p.searchLine,
      backgroundColor: p.search,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      minHeight: 37,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderWidth: 0,
      backgroundColor: "transparent",
      color: p.input,
      fontSize: 11,
      borderRadius: 0,
    },
    clearSearch: {
      width: 24,
      height: 28,
      justifyContent: "center",
      alignItems: "center",
    },
    commandKey: {
      paddingHorizontal: 5,
      minHeight: 22,
      justifyContent: "center",
      borderRadius: 4,
      borderWidth: 1,
      borderColor: p.commandLine,
      backgroundColor: p.command,
    },
    keyText: { color: p.muted, fontSize: 8, fontWeight: "500" },
    sectionHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 10,
    },
    sectionLabel: {
      color: p.muted,
      fontSize: 8,
      fontWeight: "600",
      letterSpacing: 1.3,
      marginLeft: 10,
      marginTop: 13,
      marginBottom: 9,
    },
    sectionCounter: {
      color: p.muted,
      fontSize: 8,
      paddingRight: 11,
      paddingTop: 3,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 43,
      paddingHorizontal: 9,
      borderRadius: 10,
      marginBottom: 4,
      gap: 9,
      borderWidth: 1,
      borderColor: "transparent",
    },
    itemIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    itemText: { color: p.secondary, fontSize: 11, lineHeight: 17, flex: 1 },
    activeText: { color: p.activeText, fontWeight: "600" },
    activeItem: { borderColor: p.activeBorder },
    activeMark: {
      position: "absolute",
      left: -1,
      height: 18,
      width: 3,
      borderRadius: 2,
      backgroundColor: p.activeMark,
    },
    hoveredItem: { backgroundColor: p.hover, borderColor: p.hoverBorder },
    nestedItem: { minHeight: 38, paddingLeft: 10, gap: 7 },
    submenu: {
      marginLeft: 21,
      marginTop: 3,
      marginBottom: 7,
      paddingLeft: 7,
      borderLeftWidth: 1,
      borderLeftColor: p.submenuLine,
    },
    badge: {
      minWidth: 19,
      overflow: "hidden",
      textAlign: "center",
      paddingHorizontal: 5,
      paddingVertical: 2,
      color: p.badgeText,
      backgroundColor: p.badge,
      borderRadius: 5,
      fontSize: 9,
      fontWeight: "600",
    },
    railItem: {
      height: 44,
      paddingHorizontal: 0,
      justifyContent: "center",
      marginBottom: 5,
    },
    railControls: { alignItems: "center", gap: 2, marginBottom: 12 },
    railControl: {
      width: 44,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 9,
    },
    railDivider: {
      height: 1,
      backgroundColor: p.divider,
      marginHorizontal: 9,
      marginVertical: 10,
    },
    railBadge: {
      position: "absolute",
      right: 8,
      top: 8,
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: p.accent,
    },
    footer: {
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: p.divider,
      backgroundColor: p.footer,
    },
    settings: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 35,
      paddingHorizontal: 11,
      borderRadius: 9,
      marginBottom: 7,
    },
    themeControl: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 38,
      paddingHorizontal: 11,
      borderRadius: 9,
      marginBottom: 4,
    },
    themeTrack: {
      width: 30,
      height: 18,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: p.switchLine,
      backgroundColor: p.switchOff,
      padding: 2,
      justifyContent: "center",
    },
    themeThumb: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: p.switchThumb,
    },
    settingsText: { color: p.secondary, fontSize: 11, flex: 1 },
    profile: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 7,
      paddingVertical: 7,
      borderRadius: 10,
    },
    avatar: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 11,
      borderWidth: 1,
      borderColor: p.avatarLine,
    },
    initials: {
      color: p.avatarText,
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.2,
    },
    profileName: {
      color: p.text,
      fontSize: 11,
      lineHeight: 17,
      fontWeight: "600",
    },
    profileRole: { color: p.muted, fontSize: 9, lineHeight: 15 },
    empty: { alignItems: "center", padding: 20, gap: 9 },
    emptyTitle: { color: p.text, fontSize: 12, fontWeight: "600" },
    emptyText: {
      color: p.muted,
      fontSize: 11,
      lineHeight: 17,
      textAlign: "center",
    },
    reset: {
      marginTop: 4,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 8,
      backgroundColor: p.reset,
    },
    resetText: { color: p.resetText, fontSize: 11, fontWeight: "600" },
  });
