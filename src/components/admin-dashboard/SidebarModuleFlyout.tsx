import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import AppTextInput from "../AppTextInput";
import {
  sidebarRouteActive,
  SidebarPresentationItem,
} from "../../constants/adminSidebarPresentation";
import {
  dashboardData,
  MotionPressable as Pressable,
} from "./DashboardInteractions";

import { useSidebarPalette, sidebarAccent } from "./sidebarPalette";

export interface SidebarFlyoutModule {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  items: SidebarPresentationItem[];
  anchor: { left: number; top: number; width: number; height: number };
}
export default function SidebarModuleFlyout({
  module,
  pathname,
  onClose,
  onNavigate,
}: {
  module: SidebarFlyoutModule | null;
  pathname: string;
  onClose: () => void;
  onNavigate: (route: string) => void;
}) {
  const [query, setQuery] = useState("");
  const p = useSidebarPalette();
  const accent = sidebarAccent(module?.color || "#BCA8F0", p.dark);
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const launcher = useRef<HTMLElement | null>(null);
  const input = useRef<React.ElementRef<typeof AppTextInput>>(null);
  useEffect(() => {
    setQuery("");
  }, [module]);
  useEffect(() => {
    if (Platform.OS !== "web" || module) return;
    const record = () => {
      const node = document.activeElement;
      if (
        node instanceof HTMLElement &&
        node !== document.body &&
        !node.closest('[role="dialog"],[aria-modal="true"]')
      )
        launcher.current = node;
    };
    record();
    document.addEventListener("focusin", record);
    return () => document.removeEventListener("focusin", record);
  }, [module]);
  useEffect(() => {
    if (!module || Platform.OS !== "web") return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [module, onClose]);
  const restoreFocus = useCallback(() => {
    if (Platform.OS === "web")
      requestAnimationFrame(() => {
        if (launcher.current?.isConnected)
          launcher.current.focus({ preventScroll: true });
      });
  }, []);
  const panelWidth = Math.min(320, width - 24);
  const panelHeight = Math.min(560, height - 24);
  const left = Math.min(
    (module?.anchor.left ?? 0) + (module?.anchor.width ?? 60) + 16,
    width - panelWidth - 12,
  );
  const top = Math.min(
    Math.max(12, (module?.anchor.top ?? 80) - 12),
    height - panelHeight - 12,
  );
  const filtered = (module?.items ?? []).filter((item) =>
    `${item.title} ${item.category || ""}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const navigate = (route: string) => {
    onClose();
    onNavigate(route);
  };
  return (
    <Modal
      transparent
      visible={!!module}
      animationType={reduced || Platform.OS === "web" ? "none" : "fade"}
      onRequestClose={onClose}
      onDismiss={restoreFocus}
      onShow={() => input.current?.focus()}
    >
      <View style={{ flex: 1 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss module navigation"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          role="dialog"
          aria-modal
          accessibilityViewIsModal
          accessibilityLabel={
            module?.key === "more"
              ? "More school tools"
              : `${module?.label || "School"} tools`
          }
          {...dashboardData({ sidebarFlyout: "true" })}
          style={{
            position: "absolute",
            left: Math.max(12, left),
            top,
            width: panelWidth,
            maxHeight: panelHeight,
            borderWidth: 1,
            borderColor: p.flyoutLine,
            borderRadius: 18,
            overflow: "hidden",
            backgroundColor: p.flyout,
            ...(Platform.OS === "web"
              ? {
                  boxShadow: p.shadow,
                }
              : {}),
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 16,
              gap: 10,
            }}
          >
            <View
              style={{
                height: 33,
                width: 33,
                borderRadius: 11,
                backgroundColor: `${accent}18`,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons
                name={module?.icon || "apps-outline"}
                size={19}
                color={accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: p.text }}>
                {module?.label}
              </Text>
              <Text style={{ fontSize: 10, color: p.muted, marginTop: 3 }}>
                {module?.items.length || 0} available tools
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close module navigation"
              onPress={onClose}
              style={{
                width: 32,
                height: 36,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
              }}
            >
              <Ionicons name="close-outline" size={18} color={p.icon} />
            </Pressable>
          </View>
          <View
            style={{
              marginHorizontal: 14,
              marginBottom: 10,
              backgroundColor: p.flyoutInput,
              borderRadius: 9,
              borderWidth: 1,
              borderColor: p.searchLine,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 9,
              gap: 7,
            }}
          >
            <Ionicons name="search-outline" size={15} color={p.muted} />
            <AppTextInput
              ref={input}
              autoFocus
              accessibilityLabel="Search module tools"
              placeholder="Find a tool…"
              placeholderTextColor={p.muted}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => {
                if (query.trim() && filtered[0]) navigate(filtered[0].route);
              }}
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 38,
                color: p.input,
                fontSize: 12,
                borderWidth: 0,
                backgroundColor: "transparent",
                paddingHorizontal: 0,
              }}
            />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 8,
              paddingTop: 0,
              paddingBottom: 12,
            }}
            showsVerticalScrollIndicator={false}
          >
            {filtered.map((item) => {
              const active = sidebarRouteActive(pathname, item.route);
              return (
                <Pressable
                  key={item.route}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  aria-current={active ? "page" : undefined}
                  onPress={() => navigate(item.route)}
                  style={({ hovered }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      minHeight: 43,
                      borderRadius: 9,
                      backgroundColor: active
                        ? p.flyoutActive
                        : hovered
                          ? p.flyoutHover
                          : "transparent",
                    },
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={17}
                    color={active ? p.accent : p.icon}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: active ? p.accent : p.secondary,
                        fontSize: 12,
                        lineHeight: 18,
                      }}
                    >
                      {item.title}
                    </Text>
                    {module?.key === "more" && (
                      <Text
                        style={{
                          color: p.muted,
                          fontSize: 9,
                          lineHeight: 15,
                        }}
                      >
                        {item.category}
                      </Text>
                    )}
                  </View>
                  {!!item.badge && item.badge > 0 && (
                    <Text style={{ color: p.accent, fontSize: 10 }}>
                      {item.badge}
                    </Text>
                  )}
                  <Ionicons name="chevron-forward" size={11} color={p.muted} />
                </Pressable>
              );
            })}
            {!filtered.length && (
              <Text
                style={{
                  color: p.muted,
                  fontSize: 12,
                  lineHeight: 19,
                  padding: 18,
                }}
              >
                No matching tools. Try another name.
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
