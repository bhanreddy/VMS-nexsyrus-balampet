import { dashboardData } from "./DashboardInteractions";
import React, { useCallback, useEffect, useRef } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useDashboardPalette } from "./primitives";

/** Restores the original launcher after dismissal, including portals and Escape. */
function useDialogFocus(open: boolean, panel: React.RefObject<View | null>) {
  const previous = useRef<HTMLElement | null>(null);
  const restoreTarget = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined" || open)
      return;
    const record = () => {
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        !active.closest('[role="dialog"],[aria-modal="true"]')
      )
        previous.current = active;
    };
    record();
    document.addEventListener("focusin", record);
    return () => document.removeEventListener("focusin", record);
  }, [open]);
  useEffect(() => {
    if (Platform.OS !== "web" || !open) return;
    restoreTarget.current = previous.current;
    const frame = requestAnimationFrame(() => {
      const host = panel.current as unknown as HTMLElement | null;
      if (host && !host.contains(document.activeElement))
        host
          .querySelector<HTMLElement>(
            'input:not([disabled]),button:not([disabled]),[role="button"]',
          )
          ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, panel]);
  return useCallback(() => {
    if (Platform.OS !== "web") return;
    // RN Web keeps its focus trap active until the modal has actually unmounted.
    requestAnimationFrame(() => {
      if (restoreTarget.current?.isConnected)
        restoreTarget.current.focus({ preventScroll: true });
    });
  }, []);
}
export default function DashboardDialog({
  open,
  onClose,
  label,
  dismissLabel,
  children,
  style,
  maxWidth = 520,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  dismissLabel: string;
  children: React.ReactNode;
  style?: ViewStyle;
  maxWidth?: number;
}) {
  const p = useDashboardPalette();
  const reduced = useReducedMotion();
  const panel = useRef<View>(null);
  const restoreFocus = useDialogFocus(open, panel);
  useEffect(() => {
    if (!open || Platform.OS !== "web") return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [open, onClose]);
  return (
    <Modal
      transparent
      visible={open}
      animationType={reduced || Platform.OS === "web" ? "none" : "fade"}
      onRequestClose={onClose}
      onDismiss={restoreFocus}
      statusBarTranslucent
    >
      <View
        style={styles.backdrop}
        {...dashboardData({ dashboardSurface: "overlay" })}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          onPress={onClose}
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: p.dark
                ? "rgba(3,7,18,.7)"
                : "rgba(16,24,40,.36)",
            },
            Platform.OS === "web" &&
              ({
                backdropFilter: "blur(5px)",
                WebkitBackdropFilter: "blur(5px)",
              } as ViewStyle),
          ]}
        />
        <View
          ref={panel}
          role="dialog"
          aria-modal
          accessibilityViewIsModal
          accessibilityLabel={label}
          {...dashboardData({
            dashboardDialog: "true",
            dashboardSurface: "dialog",
          })}
          style={[
            styles.panel,
            {
              maxWidth,
              backgroundColor: p.card,
              borderColor: p.dark ? "#FFFFFF1F" : "#FFFFFFC9",
            },
            Platform.OS === "web" && {
              boxShadow:
                "0 30px 90px rgba(16,24,40,.24),0 2px 8px rgba(16,24,40,.08)",
            },
            style,
          ]}
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    width: "100%",
    maxHeight: "88%",
    borderWidth: 1,
    borderRadius: 22,
    overflow: "hidden",
  },
});
