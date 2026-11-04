import React, { useCallback, useEffect, useRef } from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import DashboardWebSidebar, {
  WebSidebarActionItem,
} from "../DashboardWebSidebar";
import { MotionPressable as Pressable } from "./DashboardInteractions";

import { useSidebarPalette } from "./sidebarPalette";

/** Mobile and desktop share the same permission-filtered tools and visual language. */
export default function DashboardNavigationDrawer({
  open,
  onClose,
  items,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  items: WebSidebarActionItem[];
  onNavigate: (route: string) => void;
}) {
  const p = useSidebarPalette();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const launcher = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (Platform.OS !== "web" || open) return;
    const record = () => {
      const node = document.activeElement;
      if (
        node instanceof HTMLElement &&
        !node.closest('[role="dialog"],[aria-modal="true"]')
      )
        launcher.current = node;
    };
    record();
    document.addEventListener("focusin", record);
    return () => document.removeEventListener("focusin", record);
  }, [open]);
  useEffect(() => {
    if (!open || Platform.OS !== "web") return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, onClose]);
  const restore = useCallback(() => {
    if (Platform.OS === "web")
      requestAnimationFrame(() => {
        if (launcher.current?.isConnected)
          launcher.current.focus({ preventScroll: true });
      });
  }, []);
  return (
    <Modal
      transparent
      visible={open}
      animationType={reduced || Platform.OS === "web" ? "none" : "fade"}
      onRequestClose={onClose}
      onDismiss={restore}
      statusBarTranslucent
    >
      <View
        style={[
          s.backdrop,
          {
            backgroundColor: p.dark
              ? "rgba(9,14,28,.56)"
              : "rgba(31,38,59,.28)",
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss navigation"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        {open && (
          <View
            style={{
              flex: 1,
              alignSelf: "flex-start",
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              backgroundColor: p.surface,
              ...(Platform.OS === "web"
                ? { boxShadow: "12px 0 64px rgba(10,14,28,.28)" }
                : {}),
            }}
          >
            <DashboardWebSidebar
              collapsed={false}
              items={items}
              widthOverride={Math.min(340, width - 28)}
              onClose={onClose}
              onNavigate={(route) => {
                onClose();
                onNavigate(route);
              }}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(9,14,28,.48)" },
});
