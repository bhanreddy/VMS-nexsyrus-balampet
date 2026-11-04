import { MotionPressable as Pressable } from "./DashboardInteractions";
import React, { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AppTextInput from "../AppTextInput";
import {
  dashboardAccents,
  DashboardIcon,
  DashboardTone,
  IconButton,
  Panel,
  useDashboardPalette,
} from "./primitives";
const tones: DashboardTone[] = [
  "blue",
  "emerald",
  "indigo",
  "amber",
  "rose",
  "blue",
];
const filters = [
  { key: "All", categories: [] },
  { key: "Academic", categories: ["Academic", "Analytics"] },
  { key: "People", categories: ["Students", "HR"] },
  { key: "Finance", categories: ["Finance"] },
  { key: "Comms", categories: ["Comms", "Support"] },
];
export default function QuickActionsPanel({
  actions,
  onAction,
  onBrowse,
  compact = true,
}: {
  actions: {
    title: string;
    route: string;
    icon: DashboardIcon;
    category: string;
  }[];
  onAction: (route: string) => void;
  onBrowse: () => void;
  compact?: boolean;
}) {
  const p = useDashboardPalette();
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const matching = useMemo(
    () =>
      actions.filter(
        (action) =>
          (filter === "All" ||
            filters
              .find((item) => item.key === filter)
              ?.categories.includes(action.category)) &&
          `${action.title} ${action.category}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      ),
    [actions, filter, search],
  );
  const limit = compact ? 8 : 6;
  const visible = expanded ? matching : matching.slice(0, limit);
  return (
    <Panel
      title="Quick actions"
      subtitle="Most opened screens first"
      tintedHeader
      tone="blue"
      icon="flash-outline"
      action={
        <View style={{ flexDirection: "row" }}>
          <IconButton
            label="Search quick actions"
            icon="search-outline"
            onPress={() => {
              setSearchOpen((current) => !current);
              setSearch("");
            }}
          />
          <IconButton
            label="Browse all quick actions"
            icon="apps-outline"
            onPress={onBrowse}
          />
        </View>
      }
    >
      <View style={{ padding: compact ? 10 : 16, gap: 10 }}>
        {searchOpen && (
          <AppTextInput
            autoFocus
            accessibilityLabel="Filter quick actions"
            placeholder="Find a tool…"
            value={search}
            onChangeText={setSearch}
            style={{
              backgroundColor: p.soft,
              borderColor: p.line,
              borderWidth: 1,
              borderRadius: 8,
              minHeight: 38,
              paddingHorizontal: 10,
              color: p.text,
              fontSize: 12,
            }}
          />
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
          {filters.map((item) => (
            <Pressable
              accessibilityRole="button"
              aria-pressed={filter === item.key}
              accessibilityState={{ selected: filter === item.key }}
              accessibilityLabel={`Quick actions: ${item.key}`}
              key={item.key}
              onPress={() => {
                setFilter(item.key);
                setExpanded(false);
              }}
              style={{
                paddingHorizontal: 8,
                minHeight: 28,
                justifyContent: "center",
                borderRadius: 7,
                backgroundColor: filter === item.key ? p.tint : p.soft,
                borderWidth: 1,
                borderColor: filter === item.key ? p.indigo : p.line,
              }}
            >
              <Text
                style={{
                  color: filter === item.key ? p.indigo : p.secondary,
                  fontSize: 10,
                  fontWeight: "600",
                }}
              >
                {item.key}
              </Text>
            </Pressable>
          ))}
        </View>
        <ScrollView
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={expanded}
          style={{
            maxHeight: expanded ? (compact ? 350 : 460) : undefined,
            flexGrow: 0,
          }}
          contentContainerStyle={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            padding: 2,
          }}
        >
          {visible.map((action, index) => {
            const accent = dashboardAccents[tones[index % tones.length]];
            return (
              <Pressable
                key={action.route}
                accessibilityRole="button"
                accessibilityLabel={action.title}
                onPress={() => onAction(action.route)}
                style={({ hovered, pressed }) => [
                  {
                    flexBasis: "45%",
                    flexGrow: 1,
                    minWidth: 0,
                    flexDirection: compact ? "row" : "column",
                    alignItems: compact ? "center" : "flex-start",
                    gap: compact ? 8 : 10,
                    padding: compact ? 9 : 14,
                    minHeight: compact ? 58 : 105,
                    borderRadius: 10,
                    backgroundColor: p.dark ? accent.darkWash : accent.wash,
                    borderWidth: 1,
                    borderColor: hovered
                      ? accent.ink
                      : p.dark
                        ? p.line
                        : accent.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <LinearGradient
                  colors={accent.gradient}
                  style={{
                    width: compact ? 29 : 36,
                    height: compact ? 29 : 36,
                    borderRadius: 9,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={action.icon}
                    size={compact ? 16 : 19}
                    color="#FFF"
                  />
                </LinearGradient>
                <View style={{ flex: compact ? 1 : undefined, minWidth: 0 }}>
                  <Text
                    numberOfLines={2}
                    style={{
                      fontSize: 11,
                      lineHeight: 16,
                      fontWeight: "600",
                      color: p.text,
                    }}
                  >
                    {action.title}
                  </Text>
                  {!compact && (
                    <Text
                      style={{
                        fontSize: 10,
                        lineHeight: 16,
                        color: p.secondary,
                        marginTop: 3,
                      }}
                    >
                      {action.category}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        {!matching.length && (
          <Text
            style={{
              padding: 14,
              textAlign: "center",
              color: p.secondary,
              fontSize: 12,
            }}
          >
            No matching tools in this group.
          </Text>
        )}
        {matching.length > limit && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              expanded
                ? "Show fewer quick actions"
                : `Show all ${matching.length} quick actions`
            }
            onPress={() => setExpanded((value) => !value)}
            style={{
              minHeight: 30,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: p.indigo, fontSize: 11, fontWeight: "600" }}>
              {expanded ? "Show fewer" : `Show all ${matching.length} tools`} ↓
            </Text>
          </Pressable>
        )}
      </View>
    </Panel>
  );
}
