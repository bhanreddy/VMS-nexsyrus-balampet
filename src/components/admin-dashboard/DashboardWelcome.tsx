import { MotionPressable as Pressable } from "./DashboardInteractions";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { DashboardIcon, formatMoney } from "./primitives";
import DashboardProfileAvatar from "./DashboardProfileAvatar";
export default function DashboardWelcome({
  greeting,
  name,
  displayName,
  photoUrl,
  userId,
  school,
  date,
  diary,
  collected,
  complaints,
  compact,
  narrow,
  refreshing,
  onRefresh,
  onCustomize,
  customizeReady,
  onNavigate,
}: {
  greeting: string;
  name: string;
  displayName: string;
  photoUrl?: string | null;
  userId?: string;
  school: string;
  date: Date;
  diary?: number;
  collected?: number;
  complaints?: number;
  compact: boolean;
  narrow: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onCustomize: () => void;
  customizeReady: boolean;
  onNavigate: (route: string) => void;
}) {
  const items: {
    label: string;
    value: string | number;
    route: string;
    icon: DashboardIcon;
  }[] = [
    {
      label: "Diary today",
      value: diary ?? "—",
      route: "/admin/diary/viewer",
      icon: "book-outline",
    },
    {
      label: "Collected today",
      value: formatMoney(collected),
      route: "/admin/finance",
      icon: "wallet-outline",
    },
    {
      label: "Open complaints",
      value: complaints ?? "—",
      route: "/admin/complaints",
      icon: "chatbubble-outline",
    },
  ];
  return (
    <LinearGradient
      colors={["#292354", "#493781", "#315E87"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: 18,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#FFFFFF26",
        ...(Platform.OS === "web"
          ? {
              boxShadow:
                "0 3px 10px rgba(49,36,98,.12), inset 0 1px 0 #FFFFFF16",
            }
          : {}),
        paddingHorizontal: compact ? 18 : 24,
        paddingVertical: compact ? 15 : 23,
        flexDirection: narrow ? "column" : "row",
        alignItems: narrow ? "stretch" : "center",
        gap: narrow ? 12 : 20,
      }}
    >
      <LinearGradient
        pointerEvents="none"
        colors={["#FFFFFF0C", "#FFFFFF00"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.35, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          flex: 1,
          minWidth: 0,
          flexDirection: "row",
          alignItems: "center",
          gap: narrow ? 12 : 16,
        }}
      >
        <DashboardProfileAvatar
          key={userId}
          displayName={displayName}
          photoUrl={photoUrl}
          compact={compact || narrow}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontSize: narrow ? 23 : 26,
              lineHeight: 32,
              letterSpacing: -0.7,
              color: "#FFF",
              fontWeight: "600",
            }}
          >
            {greeting}, {name}
            <Text style={{ color: "#F5D38E" }}>.</Text>
          </Text>
          <Text
            style={{
              color: "#ECE4FA",
              fontSize: 11,
              lineHeight: 17,
              marginTop: 2,
            }}
          >
            {school} ·{" "}
            {date.toLocaleDateString("en-IN", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </Text>
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          flex: narrow ? undefined : 1.1,
        }}
      >
        {items.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}: ${item.value}`}
            onPress={() => onNavigate(item.route)}
            style={({ hovered }) => [
              {
                flexBasis: narrow ? "30%" : undefined,
                flexGrow: 1,
                minWidth: 0,
                paddingHorizontal: 10,
                paddingVertical: 8,
                backgroundColor: hovered ? "#FFFFFF25" : "#FFFFFF14",
                borderWidth: 1,
                borderColor: "#FFFFFF25",
                borderRadius: 9,
              },
            ]}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons name={item.icon} size={12} color="#EBE2FF" />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                style={{
                  color: "#FFF",
                  fontSize: narrow
                    ? String(item.value).length > 8
                      ? 11
                      : 13
                    : 16,
                  fontWeight: "600",
                  fontVariant: ["tabular-nums"],
                  flexShrink: 1,
                }}
              >
                {item.value}
              </Text>
            </View>
            <Text
              style={{
                color: "#F0EAF9",
                fontSize: 10,
                lineHeight: 16,
                marginTop: 3,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          justifyContent: narrow ? "flex-end" : undefined,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Customize dashboard"
          disabled={!customizeReady}
          onPress={onCustomize}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            minHeight: 36,
            paddingHorizontal: 11,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#FFFFFF40",
            backgroundColor: "#FFFFFF12",
            opacity: customizeReady ? 1 : 0.5,
          }}
        >
          <Ionicons name="options-outline" size={15} color="#FFF" />
          <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "600" }}>
            Customize
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            refreshing ? "Refreshing dashboard" : "Refresh dashboard data"
          }
          disabled={refreshing}
          onPress={onRefresh}
          style={{
            width: 36,
            height: 36,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 8,
            backgroundColor: "#FFFFFF12",
          }}
        >
          <Ionicons
            name={refreshing ? "hourglass-outline" : "refresh-outline"}
            size={17}
            color="#FFF"
          />
        </Pressable>
      </View>
    </LinearGradient>
  );
}
