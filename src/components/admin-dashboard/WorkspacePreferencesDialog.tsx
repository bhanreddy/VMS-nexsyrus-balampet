import React from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import DashboardDialog from "./DashboardDialog";
import { MotionPressable as Pressable } from "./DashboardInteractions";
import {
  DashboardPreferences,
  DashboardSection,
  dashboardSectionLabels,
} from "../../hooks/useDashboardPreferences";
import { DashboardButton, IconButton, useDashboardPalette } from "./primitives";
export default function WorkspacePreferencesDialog({
  open,
  onClose,
  preferences,
  onChange,
  onReset,
  availableSections,
}: {
  open: boolean;
  onClose: () => void;
  preferences: DashboardPreferences;
  onChange: (next: DashboardPreferences) => void;
  onReset: () => void;
  availableSections: DashboardSection[];
}) {
  const p = useDashboardPalette();
  return (
    <DashboardDialog
      open={open}
      onClose={onClose}
      label="Customize dashboard"
      dismissLabel="Dismiss dashboard preferences"
      maxWidth={500}
      style={{ padding: 22 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            fontSize: 19,
            fontWeight: "700",
            color: p.text,
          }}
        >
          Make this workspace yours
        </Text>
        <IconButton
          label="Close dashboard preferences"
          icon="close-outline"
          onPress={onClose}
        />
      </View>
      <Text
        style={{
          color: p.secondary,
          fontSize: 12,
          lineHeight: 19,
          marginBottom: 18,
        }}
      >
        Saved for your account on this device.
      </Text>
      <ScrollView>
        <Text
          style={{
            color: p.text,
            fontSize: 12,
            fontWeight: "600",
            marginBottom: 10,
          }}
        >
          Information density
        </Text>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 22 }}>
          {(["compact", "comfortable"] as const).map((density) => (
            <Pressable
              key={density}
              accessibilityRole="button"
              aria-pressed={preferences.density === density}
              accessibilityState={{
                selected: preferences.density === density,
              }}
              accessibilityLabel={`${density} layout`}
              onPress={() => onChange({ ...preferences, density })}
              style={{
                flex: 1,
                padding: 14,
                backgroundColor:
                  preferences.density === density ? p.tint : p.soft,
                borderRadius: 10,
                borderWidth: 1,
                borderColor:
                  preferences.density === density ? p.indigo : p.line,
              }}
            >
              <Text
                style={{
                  color: preferences.density === density ? p.indigo : p.text,
                  fontSize: 13,
                  fontWeight: "600",
                  textTransform: "capitalize",
                }}
              >
                {density}
              </Text>
              <Text
                style={{
                  color: p.secondary,
                  fontSize: 11,
                  lineHeight: 17,
                  marginTop: 5,
                }}
              >
                {density === "compact"
                  ? "More information, less scrolling"
                  : "Larger cards and more breathing room"}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text
          style={{
            color: p.text,
            fontSize: 12,
            fontWeight: "600",
            marginBottom: 5,
          }}
        >
          Visible sections
        </Text>
        {availableSections.map((section) => (
          <View
            key={section}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
              paddingVertical: 11,
              borderBottomWidth: 1,
              borderColor: p.line,
            }}
          >
            <Text style={{ color: p.text, flex: 1, fontSize: 12 }}>
              {dashboardSectionLabels[section]}
            </Text>
            <Switch
              accessibilityLabel={`Show ${dashboardSectionLabels[section]}`}
              value={preferences.sections[section]}
              onValueChange={(enabled) =>
                onChange({
                  ...preferences,
                  sections: { ...preferences.sections, [section]: enabled },
                })
              }
              trackColor={{ false: p.line, true: "#6755D5" }}
              thumbColor="#FFFFFF"
            />
          </View>
        ))}
      </ScrollView>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 20,
          gap: 12,
        }}
      >
        <DashboardButton label="Reset layout" compact onPress={onReset} />
        <DashboardButton label="Done" compact primary onPress={onClose} />
      </View>
    </DashboardDialog>
  );
}
