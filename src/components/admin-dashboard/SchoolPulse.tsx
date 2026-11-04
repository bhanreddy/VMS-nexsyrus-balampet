import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MotionPressable as Pressable } from "./DashboardInteractions";
import type { TrendPoint } from "../../services/analyticsService";
import CollectionChart from "./CollectionChart";
import {
  dashboardAccents,
  DashboardTone,
  DashboardIcon,
  DashboardButton,
  EmptyState,
  InlineStatus,
  Panel,
  useDashboardPalette,
} from "./primitives";

export type PulseSection = "attendance" | "academics" | "staff" | "finance";
export interface PulseRow {
  label: string;
  value: string;
  metric: string;
}
export const pulseSections: {
  key: PulseSection;
  title: string;
  subtitle: string;
  tone: DashboardTone;
  icon: DashboardIcon;
}[] = [
  {
    key: "attendance",
    title: "Attendance pulse",
    subtitle: "Participation & early support",
    tone: "emerald",
    icon: "checkmark-circle-outline",
  },
  {
    key: "academics",
    title: "Academic performance",
    subtitle: "Learning outcomes at a glance",
    tone: "indigo",
    icon: "school-outline",
  },
  {
    key: "staff",
    title: "Your people",
    subtitle: "Team availability & growth",
    tone: "blue",
    icon: "people-outline",
  },
  {
    key: "finance",
    title: "Financial snapshot",
    subtitle: "Balances, concessions & refunds",
    tone: "amber",
    icon: "wallet-outline",
  },
];
export default function SchoolPulseCard({
  sectionKey,
  rows,
  trend,
  period,
  compact = true,
  loading,
  error,
  onRetry,
  onOpen,
}: {
  sectionKey: PulseSection;
  rows: PulseRow[];
  trend?: TrendPoint[];
  period?: string;
  compact?: boolean;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpen: (metric: string) => void;
}) {
  const p = useDashboardPalette();
  const section = pulseSections.find((item) => item.key === sectionKey)!;
  const accent = dashboardAccents[section.tone];
  const color = p.dark ? accent.darkInk : accent.ink;
  const unavailable = rows.every((row) => row.value === "—");
  const noExams = sectionKey === "academics" &&
    rows.find((row) => row.metric === "exams-conducted")?.value === "0";
  return (
    <Panel
      title={section.title}
      subtitle={period || section.subtitle}
      tone={section.tone}
      icon={section.icon}
    >
      {loading && unavailable ? (
        <InlineStatus
          loading
          title={`Loading ${section.title.toLowerCase()}…`}
        />
      ) : unavailable ? (
        <InlineStatus
          title={error ? "Summary unavailable" : "No summary recorded"}
          message={
            error
              ? "Refresh to check the latest figures."
              : "Records will appear here when available."
          }
          onRetry={error ? onRetry : undefined}
        />
      ) : noExams ? (
        <View style={{ paddingBottom: 20, alignItems: "center" }}>
          <EmptyState
            icon="school-outline"
            title="Learning takes shape here"
            message="No exams recorded for this period. Scores and subject insights will appear once results are available."
          />
          <DashboardButton label="View assessments" icon="arrow-forward-outline" compact onPress={() => onOpen("exams-conducted")} />
        </View>
      ) : (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            paddingHorizontal: 18,
            paddingBottom: 18,
            gap: 0,
          }}
        >
          {rows.map((row, index) => (
            <Pressable
              key={row.metric}
              feedback="lift"
              accessibilityRole="button"
              accessibilityLabel={`${row.label}: ${row.value}`}
              onPress={() => onOpen(row.metric)}
              style={({ hovered, pressed }) => [
                {
                  flexBasis: "50%",
                  flexGrow: 1,
                  minWidth: 0,
                  paddingVertical: compact ? 14 : 18,
                  paddingHorizontal: 12,
                  minHeight: compact ? 86 : 96,
                  borderRadius: 6,
                  borderTopWidth: index > 1 ? StyleSheet.hairlineWidth : 0,
                  borderLeftWidth: index % 2 === 1 ? StyleSheet.hairlineWidth : 0,
                  borderColor: p.line,
                  backgroundColor: hovered ? p.soft : "transparent",
                  opacity: pressed ? 0.8 : 1,
                },
                Platform.OS === "web" && { cursor: "pointer" },
              ]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
                style={{
                  fontSize: !/^[₹\d—]/.test(row.value)
                    ? 15
                    : compact && row.value.length > 9
                      ? 17
                      : compact
                        ? 21
                        : 24,
                  fontWeight: "700",
                  color: index === 0 ? color : p.text,
                  letterSpacing: -0.5,
                  fontVariant: ["tabular-nums"],
                  lineHeight: 28,
                }}
              >
                {row.value}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  lineHeight: 17,
                  color: p.secondary,
                  marginTop: 4,
                }}
              >
                {row.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {trend && trend.length > 0 && !loading && !unavailable && !noExams && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
          <CollectionChart
            data={trend}
            color={color}
            chartHeight={compact ? 116 : 155}
            label={
              sectionKey === "attendance"
                ? "Student attendance"
                : "Academic performance"
            }
            valueFormat={(value) => `${value}%`}
            loading={loading}
            error={error}
            onRetry={onRetry}
          />
        </View>
      )}
    </Panel>
  );
}
export function SchoolPulseUnavailable({
  onRetry,
  onOpen,
}: {
  onRetry: () => void;
  onOpen: (metric: string) => void;
}) {
  const p = useDashboardPalette();
  return (
    <Panel
      title="School pulse"
      subtitle="Attendance, academics, people & finance"
      tone="indigo"
      icon="pulse-outline"
    >
      <InlineStatus
        title="School summaries unavailable"
        message="Refresh to load the latest school figures."
        onRetry={onRetry}
      />
      <View
        style={{
          paddingHorizontal: 14,
          paddingBottom: 12,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 7,
        }}
      >
        {[
          { label: "Attendance", metric: "average-attendance" },
          { label: "Academics", metric: "average-score" },
          { label: "Staff", metric: "total-staff" },
          { label: "Finance", metric: "total-collected" },
        ].map((item) => (
          <Pressable
            key={item.metric}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.label.toLowerCase()} details`}
            onPress={() => onOpen(item.metric)}
            style={({ hovered }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 9,
                minHeight: 31,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: p.line,
                backgroundColor: hovered ? p.tint : p.soft,
              },
            ]}
          >
            <Text style={{ fontSize: 10, color: p.secondary }}>
              {item.label}
            </Text>
            <Ionicons name="arrow-forward" size={11} color={p.indigo} />
          </Pressable>
        ))}
      </View>
    </Panel>
  );
}
