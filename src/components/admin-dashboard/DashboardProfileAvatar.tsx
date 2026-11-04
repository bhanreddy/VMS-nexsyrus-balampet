import React, { useRef, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuickAccountSwitch } from "../../hooks/useQuickAccountSwitch";
import StudentPhoto from "../StudentPhoto";
import QuickAccountPickerSheet from "../QuickAccountPickerSheet";
import { MotionPressable as Pressable } from "./DashboardInteractions";

const DOUBLE_TAP_MS = 320;

export default function DashboardProfileAvatar({
  displayName,
  photoUrl,
  compact,
}: {
  displayName: string;
  photoUrl?: string | null;
  compact: boolean;
}) {
  const {
    accounts,
    activeId,
    sheetOpen,
    switching,
    switchToNext,
    switchTo,
    openSheet,
    closeSheet,
  } = useQuickAccountSwitch();
  const lastTap = useRef<number | null>(null);
  const held = useRef(false);
  const pending = useRef(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [cycling, setCycling] = useState(false);
  const busy = switching || cycling;
  const size = compact ? 54 : 64;

  const chooseAccount = () => {
    lastTap.current = null;
    if (!busy && !pending.current) void openSheet();
  };
  const handlePress = () => {
    if (held.current || busy || pending.current) return;
    const now = Date.now();
    if (lastTap.current === null || now - lastTap.current >= DOUBLE_TAP_MS) {
      lastTap.current = now;
      return;
    }
    lastTap.current = null;
    pending.current = true;
    setCycling(true);
    setBusyUserId(activeId);
    void (async () => {
      try {
        await switchToNext();
      } finally {
        pending.current = false;
        setCycling(false);
        setBusyUserId(null);
      }
    })();
  };
  const selectAccount = async (userId: string) => {
    setBusyUserId(userId);
    try {
      await switchTo(userId);
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <>
      <View style={{ width: size + 6, height: size + 6, flexShrink: 0 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hold to switch accounts; double-tap the photo for the next account"
          accessibilityHint="You can also use the choose account button."
          accessibilityState={{ busy, disabled: busy }}
          disabled={busy}
          onPressIn={() => {
            held.current = false;
          }}
          onPress={handlePress}
          onLongPress={() => {
            held.current = true;
            chooseAccount();
          }}
          delayLongPress={450}
          onAccessibilityTap={chooseAccount}
          {...(Platform.OS === "web"
            ? {
                onKeyDown: (event: React.KeyboardEvent) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    chooseAccount();
                  }
                },
              }
            : {})}
          style={{
            padding: 3,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: "#E4D4FF88",
            backgroundColor: "#FFFFFF18",
          }}
        >
          <StudentPhoto
            photoUrl={photoUrl}
            displayName={displayName}
            size={size - 2}
            borderRadius={17}
            style={{ backgroundColor: "#524078" }}
            fallbackTextStyle={{
              color: "#FFF",
              fontSize: 24,
              fontWeight: "600",
            }}
          />
          {busy && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                inset: 3,
                borderRadius: 17,
                backgroundColor: "#292354CC",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator color="#FFF" size="small" />
            </View>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose an account"
          disabled={busy}
          onPress={chooseAccount}
          style={{
            position: "absolute",
            right: -3,
            bottom: -3,
            width: 26,
            height: 26,
            borderRadius: 9,
            borderWidth: 2,
            borderColor: "#453573",
            backgroundColor: "#F1E8FF",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons name="swap-horizontal" size={14} color="#493573" />
        </Pressable>
      </View>
      <QuickAccountPickerSheet
        visible={sheetOpen}
        accounts={accounts}
        activeId={activeId}
        switching={busy}
        busyUserId={busyUserId}
        onClose={closeSheet}
        onSelect={selectAccount}
      />
    </>
  );
}
