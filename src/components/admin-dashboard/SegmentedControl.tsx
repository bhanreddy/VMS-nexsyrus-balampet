import { dashboardData } from "./DashboardInteractions";
import React, { useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useDashboardPalette } from "./primitives";
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const p = useDashboardPalette();
  const [width, setWidth] = useState(180);
  const controls = useRef<(View | null)[]>([]);
  const index = Math.max(
    0,
    options.findIndex((option) => option.key === value),
  );
  const cellWidth = (width - 6) / options.length;
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{
        minWidth: 218,
        alignSelf: "flex-start",
        flexDirection: "row",
        padding: 3,
        borderRadius: 10,
        backgroundColor: p.soft,
        borderWidth: 1,
        borderColor: p.line,
      }}
    >
      <View
        pointerEvents="none"
        {...dashboardData({ dashboardSlider: "true" })}
        style={[
          {
            position: "absolute",
            left: 2,
            top: 2,
            bottom: 2,
            width: cellWidth,
            borderRadius: 7,
            backgroundColor: p.card,
            borderWidth: 1,
            borderColor: p.dark ? "#FFFFFF16" : "#E4E7F0",
            transform: [{ translateX: index * cellWidth }],
          },
          Platform.OS === "web" &&
            ({
              transition: "transform 220ms cubic-bezier(.2,.8,.2,1)",
              boxShadow: "0 1px 4px rgba(16,24,40,.06)",
            } as any),
        ]}
      />
      {options.map((option, i) => (
        <Pressable
          key={option.key}
          ref={(ref) => {
            controls.current[i] = ref;
          }}
          accessibilityRole="tab"
          accessibilityLabel={option.label}
          accessibilityState={{ selected: value === option.key }}
          aria-selected={value === option.key}
          tabIndex={i === index ? 0 : -1}
          onPress={() => onChange(option.key)}
          {...(Platform.OS === "web"
            ? {
                onKeyDown: (event: React.KeyboardEvent) => {
                  let next = i;
                  if (event.key === "ArrowRight")
                    next = (i + 1) % options.length;
                  else if (event.key === "ArrowLeft")
                    next = (i - 1 + options.length) % options.length;
                  else if (event.key === "Home") next = 0;
                  else if (event.key === "End") next = options.length - 1;
                  else return;
                  event.preventDefault();
                  onChange(options[next].key);
                  (
                    controls.current[next] as unknown as HTMLElement | null
                  )?.focus();
                },
              }
            : {})}
          style={{
            flex: 1,
            minWidth: 56,
            minHeight: 32,
            paddingHorizontal: 8,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 7,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: value === option.key ? p.text : p.secondary,
              fontSize: 11,
              fontWeight: value === option.key ? "600" : "400",
            }}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
