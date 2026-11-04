import React, { createContext, useContext } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  MotionPressable as Pressable,
  dashboardData,
} from "./DashboardInteractions";
import { useTheme } from "../../hooks/useTheme";

const DensityContext = createContext(true);
export function DashboardDensityProvider({
  compact,
  children,
}: {
  compact: boolean;
  children: React.ReactNode;
}) {
  return (
    <DensityContext.Provider value={compact}>
      {children}
    </DensityContext.Provider>
  );
}
export type DashboardIcon = React.ComponentProps<typeof Ionicons>["name"];
export const dashboardTokens = {
  indigo: "#4F46E5",
  emerald: "#047857",
  amber: "#B45309",
  rose: "#BE123C",
  radius: 16,
  gap: 20,
  motion: 160,
};
export const dashboardAccents = {
  indigo: {
    gradient: ["#42308F", "#6D4DBB"] as [string, string],
    ink: "#6336AA",
    darkInk: "#D2BBFF",
    wash: "#F4EEFF",
    darkWash: "#302140",
    border: "#E8DDF9",
  },
  blue: {
    gradient: ["#20458F", "#356AC4"] as [string, string],
    ink: "#2557A7",
    darkInk: "#A9D1FF",
    wash: "#EDF4FF",
    darkWash: "#192D46",
    border: "#D9E7FC",
  },
  emerald: {
    gradient: ["#075B53", "#087D6C"] as [string, string],
    ink: "#076C59",
    darkInk: "#7DE3C4",
    wash: "#EAF8F2",
    darkWash: "#17372E",
    border: "#D4EDE1",
  },
  amber: {
    gradient: ["#824017", "#A75919"] as [string, string],
    ink: "#934D0D",
    darkInk: "#F8CC82",
    wash: "#FFF5E8",
    darkWash: "#3C2B1E",
    border: "#F6E3C7",
  },
  rose: {
    gradient: ["#85305F", "#AD3D77"] as [string, string],
    ink: "#A22E69",
    darkInk: "#FFB8DB",
    wash: "#FFF0F7",
    darkWash: "#3C2436",
    border: "#F5DCE9",
  },
};
export type DashboardTone = keyof typeof dashboardAccents;
export function useDashboardPalette() {
  const { isDark } = useTheme();
  return {
    dark: isDark,
    bg: isDark ? "#0D1220" : "#F6F7FB",
    card: isDark ? "#151D2D" : "#FFFFFF",
    text: isDark ? "#F1F5F9" : "#101828",
    secondary: isDark ? "#B0BCD0" : "#596479",
    line: isDark ? "#293449" : "#EAECF2",
    soft: isDark ? "#1D273A" : "#F8F9FC",
    indigo: isDark ? "#B0AAFF" : "#4F46E5",
    tint: isDark ? "#282746" : "#F0EFFF",
    green: isDark ? "#6EE7B7" : "#047857",
    amber: isDark ? "#FCD34D" : "#92400E",
    rose: isDark ? "#FDA4AF" : "#BE123C",
  };
}
export function DashboardButton({
  label,
  icon,
  onPress,
  primary = false,
  compact = false,
  disabled = false,
}: {
  label: string;
  icon?: DashboardIcon;
  onPress: () => void;
  primary?: boolean;
  compact?: boolean;
  disabled?: boolean;
}) {
  const p = useDashboardPalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        s.button,
        {
          backgroundColor: primary ? "#4F46E5" : p.card,
          borderColor: primary ? "#4F46E5" : p.line,
        },
        compact && { minHeight: 36, paddingHorizontal: 11 },
        hovered && {
          borderColor: p.indigo,
          backgroundColor: primary ? "#4338CA" : p.tint,
        },
        pressed && { opacity: 0.92 },
        primary &&
          Platform.OS === "web" && {
            boxShadow: hovered
              ? "0 5px 14px rgba(79,70,229,.22), inset 0 1px 0 rgba(255,255,255,.16)"
              : "0 2px 5px rgba(79,70,229,.14), inset 0 1px 0 rgba(255,255,255,.16)",
          },
        disabled && { opacity: 0.5 },
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={16}
          color={primary ? "#FFFFFF" : p.secondary}
        />
      )}
      <Text style={[s.buttonText, { color: primary ? "#FFFFFF" : p.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}
export function IconButton({
  label,
  icon,
  onPress,
  badge,
  disabled = false,
}: {
  label: string;
  icon: DashboardIcon;
  onPress: () => void;
  badge?: number;
  disabled?: boolean;
}) {
  const p = useDashboardPalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} pending` : label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...(Platform.OS === "web" ? { title: label } : {})}
      style={({ hovered, pressed }) => [
        s.iconButton,
        { backgroundColor: hovered ? p.tint : "transparent" },
        disabled && { opacity: 0.5 },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Ionicons name={icon} size={20} color={p.secondary} />
      {!!badge && badge > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  style,
  tone,
  icon,
  tintedHeader = false,
}: {
  tone?: DashboardTone;
  icon?: DashboardIcon;
  tintedHeader?: boolean;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const p = useDashboardPalette();
  const compact = useContext(DensityContext);
  const accent = tone ? dashboardAccents[tone] : null;
  return (
    <View
      {...dashboardData({ dashboardSurface: tone || "neutral" })}
      style={[
        s.panel,
        {
          backgroundColor: p.card,
          borderColor: p.line,
        },
        Platform.OS === "web" && {
          boxShadow: p.dark
            ? "0 3px 10px rgba(0,0,0,.12),0 12px 30px rgba(0,0,0,.06)"
            : "0 2px 6px rgba(16,24,40,.025)",
        },
        tintedHeader && { borderRadius: 18 },
        tintedHeader && Platform.OS === "web" && {
          boxShadow: p.dark
            ? "0 3px 10px rgba(0,0,0,.12),0 12px 30px rgba(0,0,0,.06)"
            : "0 2px 4px rgba(16,24,40,.02),0 8px 24px rgba(35,40,70,.035)",
        },
        style,
      ]}
    >
      {title && (
        <View
          style={[
            s.panelHead,
            compact && { paddingHorizontal: 18, paddingVertical: 17 },
            tintedHeader && compact && { paddingHorizontal: 14, paddingVertical: 13 },
            tintedHeader && accent && {
              backgroundColor: p.dark ? `${accent.darkWash}99` : `${accent.wash}99`,
              borderBottomWidth: 1,
              borderBottomColor: p.line,
            },
          ]}
        >
          {icon && accent && (
            <View
              style={{
                height: 34,
                width: 34,
                borderRadius: 11,
                backgroundColor: p.dark ? accent.darkWash : accent.wash,
                ...(tintedHeader ? {
                  backgroundColor: p.dark ? accent.darkWash : "#FFFFFF",
                  borderWidth: 1,
                  borderColor: p.dark ? "#FFFFFF0D" : accent.border,
                } : {}),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={icon}
                size={19}
                color={p.dark ? accent.darkInk : accent.ink}
              />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              accessibilityRole="header"
              style={[s.panelTitle, { color: p.text }, tintedHeader && { fontSize: 14 }]}
            >
              {title}
            </Text>
            {subtitle && (
              <Text
                style={[
                  s.caption,
                  {
                    color: p.secondary,
                    marginTop: 3,
                    fontSize: 12,
                    lineHeight: 18,
                  },
                  tintedHeader && { fontSize: 11, lineHeight: 17 },
                ]}
              >
                {subtitle}
              </Text>
            )}
          </View>
          {action}
        </View>
      )}
      {children}
    </View>
  );
}
export function EmptyState({
  icon = "file-tray-outline",
  title,
  message,
  loading = false,
  onRetry,
}: {
  icon?: DashboardIcon;
  title: string;
  message?: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  const p = useDashboardPalette();
  return (
    <View style={s.empty} accessibilityLiveRegion="polite">
      {loading ? (
        <ActivityIndicator color={p.indigo} />
      ) : (
        <View style={[s.emptyIcon, { backgroundColor: p.soft }]}>
          <Ionicons name={icon} size={22} color={p.secondary} />
        </View>
      )}
      <Text style={[s.emptyTitle, { color: p.text }]}>{title}</Text>
      {message && (
        <Text
          style={[
            s.caption,
            { color: p.secondary, textAlign: "center", maxWidth: 320 },
          ]}
        >
          {message}
        </Text>
      )}
      {onRetry && (
        <DashboardButton
          label="Try again"
          icon="refresh-outline"
          compact
          onPress={onRetry}
        />
      )}
    </View>
  );
}
export function InlineStatus({
  title,
  message,
  loading = false,
  onRetry,
}: {
  title: string;
  message?: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  const p = useDashboardPalette();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 14,
      }}
    >
      <View
        style={{
          width: 31,
          height: 31,
          borderRadius: 10,
          backgroundColor: p.soft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={p.indigo} />
        ) : (
          <Ionicons
            name="cloud-offline-outline"
            size={17}
            color={p.secondary}
          />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            color: p.text,
            fontSize: 12,
            lineHeight: 18,
            fontWeight: "600",
          }}
        >
          {title}
        </Text>
        {message && (
          <Text
            style={{
              color: p.secondary,
              fontSize: 11,
              lineHeight: 17,
              marginTop: 2,
            }}
          >
            {message}
          </Text>
        )}
      </View>
      {onRetry && (
        <IconButton
          label={`Retry ${title.toLowerCase()}`}
          icon="refresh-outline"
          onPress={onRetry}
        />
      )}
    </View>
  );
}
export function MetricCard({
  label,
  value,
  detail,
  icon,
  onPress,
  loading = false,
  compact = false,
  tone = "indigo",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: DashboardIcon;
  onPress: () => void;
  featured?: boolean;
  loading?: boolean;
  compact?: boolean;
  tone?: DashboardTone;
}) {
  const accent = dashboardAccents[tone];
  const foreground = "#FFFFFF";
  return (
    <Pressable
      feedback="lift"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${loading ? "Loading" : value}. ${detail}. Open records`}
      style={({ hovered, pressed }) => [
        s.metric,
        compact && { minHeight: 114, padding: 14 },
        {
          backgroundColor: accent.gradient[0],
          overflow: "hidden",
          borderColor: "#FFFFFF22",
          ...(Platform.OS === "web"
            ? {
                boxShadow: hovered
                  ? `0 10px 26px ${accent.gradient[0]}36, inset 0 1px 0 #FFFFFF20`
                  : `0 4px 10px ${accent.gradient[0]}18, inset 0 1px 0 #FFFFFF20`,
              }
            : {}),
        },
        hovered && { borderColor: "#FFFFFFA0" },
        pressed && { opacity: 0.94 },
      ]}
    >
      <LinearGradient
        colors={accent.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 170,
          height: 170,
          right: -90,
          top: -110,
          backgroundColor: "#FFFFFF09",
          borderWidth: 1,
          borderColor: "#FFFFFF0D",
          borderRadius: 100,
        }}
      />
      <View style={s.metricTop}>
        <Text style={[s.metricLabel, { color: "#F1EDFF" }]}>{label}</Text>
        <View
          style={[
            s.metricIcon,
            {
              backgroundColor: "#FFFFFF15",
              borderWidth: 1,
              borderColor: "#FFFFFF1C",
            },
          ]}
        >
          <Ionicons name={icon} size={18} color={"#FFFFFF"} />
        </View>
      </View>
      {loading ? (
        <View
          {...dashboardData({ dashboardSkeleton: "true" })}
          style={[s.skeleton, { backgroundColor: "#FFFFFF20" }]}
        />
      ) : (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
          style={[
            s.metricValue,
            { color: foreground },
            compact && { fontSize: 29, marginTop: 7 },
          ]}
        >
          {typeof value === "number" ? value.toLocaleString("en-IN") : value}
        </Text>
      )}
      <View style={[s.metricFoot, compact && { marginTop: 10 }]}>
        <Text style={[s.caption, { flex: 1, color: "#F4F0FF" }]}>{detail}</Text>
        <Ionicons name="arrow-forward" size={15} color={"#FFFFFF"} />
      </View>
    </Pressable>
  );
}

export function DataRow({
  title,
  detail,
  value,
  icon,
  onPress,
  tone = "neutral",
}: {
  title: string;
  detail?: string;
  value?: string | number;
  icon?: DashboardIcon;
  onPress?: () => void;
  tone?: "neutral" | "amber" | "rose";
}) {
  const p = useDashboardPalette();
  const compact = useContext(DensityContext);
  const content = (
    <>
      <View style={[s.rowIcon, { backgroundColor: tone === "neutral" ? p.soft : p.dark ? p.soft : tone === "rose" ? "#FFF1F3" : "#FFF7ED" }]}>
        <Ionicons
          name={icon ?? "ellipse-outline"}
          size={18}
          color={tone === "neutral" ? p.indigo : p[tone]}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.rowTitle, { color: p.text }]}>{title}</Text>
        {detail && (
          <Text
            style={[s.caption, { color: p.secondary, marginTop: 4 }]}
            numberOfLines={2}
          >
            {detail}
          </Text>
        )}
      </View>
      {value != null && (
        <Text
          numberOfLines={2}
          style={[
            s.rowValue,
            { color: tone === "neutral" ? p.text : p[tone], maxWidth: "45%", textAlign: "right", backgroundColor: p.soft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
          ]}
        >
          {value}
        </Text>
      )}
      {onPress && (
        <Ionicons name="chevron-forward" size={15} color={p.secondary} />
      )}
    </>
  );
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}${value != null ? `: ${value}` : ""}${detail ? `. ${detail}` : ""}`}
      style={({ hovered }) => [
        s.dataRow,
        compact && { minHeight: 76, paddingHorizontal: 18, paddingVertical: 13 },
        {
          borderBottomColor: p.line,
          backgroundColor: hovered ? p.soft : "transparent",
        },
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View
      style={[
        s.dataRow,
        compact && { minHeight: 76, paddingHorizontal: 18, paddingVertical: 13 },
        { borderBottomColor: p.line },
      ]}
    >
      {content}
    </View>
  );
}
export const formatMoney = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "—"
    : `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
export const formatValue = (value: number | null | undefined, suffix = "") =>
  value == null || !Number.isFinite(value)
    ? "—"
    : `${value.toLocaleString("en-IN")}${suffix}`;
export const dashboardStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "600", letterSpacing: -0.2 },
  caption: { fontSize: 12, lineHeight: 18 },
});
const s = StyleSheet.create({
  button: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: { fontSize: 12, fontWeight: "600" },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#BE123C",
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#FFF", fontSize: 9, fontWeight: "700" },
  panel: { borderWidth: 1, borderRadius: 16, overflow: "hidden", minWidth: 0 },
  panelHead: {
    padding: 22,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  panelTitle: { fontSize: 15, fontWeight: "600", letterSpacing: -0.25 },
  caption: { fontSize: 12, lineHeight: 18 },
  empty: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    minHeight: 132,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyIcon: {
    height: 42,
    width: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 13, fontWeight: "600" },
  metric: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    minHeight: 166,
  },
  metricTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  metricLabel: { fontSize: 12, fontWeight: "500", flex: 1 },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  metricValue: {
    fontSize: 34,
    fontWeight: "600",
    letterSpacing: -1.1,
    marginTop: 11,
    fontVariant: ["tabular-nums"],
  },
  metricFoot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  skeleton: {
    height: 35,
    width: 90,
    borderRadius: 6,
    marginTop: 11,
    marginBottom: 5,
  },
  dataRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  rowTitle: { fontSize: 13, fontWeight: "600", lineHeight: 20 },
  rowValue: { fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] },
});
