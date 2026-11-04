import { dashboardData } from "./DashboardInteractions";
import React, { useId, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import type { TrendPoint } from "../../services/analyticsService";
import { EmptyState, formatMoney, useDashboardPalette } from "./primitives";

/** Straight segments preserve actual observations; absent points are never interpolated. */
export default function CollectionChart({
  data,
  loading,
  error,
  onRetry,
  label = "Fee collections",
  valueFormat = formatMoney,
  color,
  chartHeight = 212,
}: {
  label?: string;
  color?: string;
  chartHeight?: number;
  valueFormat?: (value: number) => string;
  data: TrendPoint[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const p = useDashboardPalette();
  const chartColor = color || p.indigo;
  const gradientId = `collection-${useId().replace(/:/g, "")}`;
  const [width, setWidth] = useState(600);
  const controls = useRef<(View | null)[]>([]);
  const [keyboardIndex, setKeyboardIndex] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const points = useMemo(
    () =>
      data
        .filter(
          (point) =>
            point.value != null &&
            String(point.value).trim() !== "" &&
            Number.isFinite(Number(point.value)),
        )
        .map((point) => ({ ...point, value: Number(point.value) })),
    [data],
  );
  const financialHistory = label.toLowerCase().includes("collection");
  if (!points.length)
    return (
      <EmptyState
        icon="analytics-outline"
        loading={loading}
        title={
          loading
            ? `Loading ${label.toLowerCase()}…`
            : error
              ? `${label} unavailable`
              : financialHistory
                ? "No collections in this period"
                : "No observations in this period"
        }
        message={
          error
            ? "Please retry to load the latest records."
            : loading
              ? undefined
              : financialHistory
                ? "Recorded fee payments will appear here."
                : "Recorded observations will appear here."
        }
        onRetry={error ? onRetry : undefined}
      />
    );
  const height = chartHeight,
    left = 51,
    right = 18,
    top = 16,
    bottom = 30;
  const plotWidth = Math.max(1, width - left - right),
    plotHeight = height - top - bottom;
  const max = Math.max(...points.map((point) => point.value), 1);
  const min = Math.min(0, ...points.map((point) => point.value));
  const position = (i: number) => ({
    x:
      left +
      (points.length === 1
        ? plotWidth / 2
        : (i * plotWidth) / (points.length - 1)),
    y: top + plotHeight * (1 - (points[i].value - min) / (max - min)),
  });
  const line = points
    .map((_, i) => `${i === 0 ? "M" : "L"}${position(i).x},${position(i).y}`)
    .join(" ");
  const zeroY = top + plotHeight * (1 - (0 - min) / (max - min));
  const first = position(0),
    last = position(points.length - 1);
  const selectedIndex =
    active != null && active < points.length ? active : points.length - 1;
  const selected = points[selectedIndex];
  const stride = Math.max(1, Math.ceil(points.length / (width < 380 ? 4 : 7)));
  return (
    <View
      style={s.root}
      onLayout={(event) =>
        setWidth((previous) =>
          Math.abs(previous - event.nativeEvent.layout.width) >= 1
            ? Math.max(180, Math.round(event.nativeEvent.layout.width))
            : previous,
        )
      }
    >
      <View style={s.legend}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <View style={[s.dot, { backgroundColor: chartColor }]} />
          <Text style={[s.caption, { color: p.secondary }]}>{label}</Text>
        </View>
        <Text
          accessibilityLiveRegion="polite"
          style={[s.caption, { color: p.text, fontWeight: "600" }]}
        >
          {selected.label} · {valueFormat(selected.value)}
        </Text>
      </View>
      <View>
        <View
          accessibilityRole="image"
          accessibilityLabel={`${label} chart. ${points.map((point) => `${point.label}: ${valueFormat(point.value)}`).join("; ")}`}
        >
          <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={chartColor} stopOpacity="0.16" />
                <Stop offset="1" stopColor={chartColor} stopOpacity="0.01" />
              </LinearGradient>
            </Defs>
            {[0, 1, 2, 3].map((i) => {
              const y = top + (plotHeight * i) / 3;
              const value = max - ((max - min) * i) / 3;
              return (
                <React.Fragment key={i}>
                  <Line
                    x1={left}
                    x2={width - right}
                    y1={y}
                    y2={y}
                    stroke={p.line}
                    strokeDasharray="3 5"
                  />
                  <SvgText
                    x={left - 9}
                    y={y + 4}
                    fill={p.secondary}
                    fontSize={10}
                    textAnchor="end"
                  >
                    {Math.abs(value) >= 100000
                      ? `${(value / 100000).toFixed(1)}L`
                      : Math.abs(value) >= 1000
                        ? `${(value / 1000).toFixed(0)}k`
                        : value.toFixed(0)}
                  </SvgText>
                </React.Fragment>
              );
            })}
            <Path
              d={`${line} L${last.x},${zeroY} L${first.x},${zeroY} Z`}
              fill={`url(#${gradientId})`}
            />
            <Path
              d={line}
              stroke={chartColor}
              strokeWidth={2.5}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((point, i) => (
              <React.Fragment key={i}>
                {(i % stride === 0 || i === points.length - 1) && (
                  <SvgText
                    x={position(i).x}
                    y={height - 7}
                    textAnchor="middle"
                    fill={p.secondary}
                    fontSize={10}
                  >
                    {point.label}
                  </SvgText>
                )}
                {(points.length === 1 ||
                  i === active ||
                  i === points.length - 1) && (
                  <Circle
                    cx={position(i).x}
                    cy={position(i).y}
                    r={4}
                    fill={chartColor}
                    stroke={p.card}
                    strokeWidth={2}
                  />
                )}
              </React.Fragment>
            ))}
            {active != null && active < points.length && (
              <Line
                x1={position(active).x}
                x2={position(active).x}
                y1={top}
                y2={top + plotHeight}
                stroke={chartColor}
                strokeOpacity={0.25}
                strokeDasharray="4 4"
              />
            )}
          </Svg>
        </View>
        {active != null && active < points.length && (
          <View
            pointerEvents="none"
            aria-hidden
            {...dashboardData({ dashboardChartTooltip: "true" })}
            style={{
              position: "absolute",
              zIndex: 2,
              left: Math.min(
                Math.max(position(active).x - 64, 0),
                Math.max(width - 144, 0),
              ),
              top: Math.max(position(active).y - 54, 3),
              minWidth: 120,
              maxWidth: 144,
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: p.line,
              backgroundColor: p.dark
                ? "rgba(21,29,45,.96)"
                : "rgba(255,255,255,.96)",
              ...(Platform.OS === "web"
                ? {
                    boxShadow: "0 4px 18px rgba(16,24,40,.12)",
                    backdropFilter: "blur(8px)",
                  }
                : {}),
            }}
          >
            <Text
              numberOfLines={1}
              style={{ fontSize: 10, lineHeight: 15, color: p.secondary }}
            >
              {points[active].label}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 12,
                lineHeight: 18,
                fontWeight: "700",
                color: p.text,
                fontVariant: ["tabular-nums"],
              }}
            >
              {valueFormat(points[active].value)}
            </Text>
          </View>
        )}
        <View
          style={[
            StyleSheet.absoluteFill,
            { left, right, flexDirection: "row" },
          ]}
        >
          {points.map((point, i) => (
            <Pressable
              key={i}
              ref={(ref) => {
                controls.current[i] = ref;
              }}
              tabIndex={
                i === Math.min(keyboardIndex, points.length - 1) ? 0 : -1
              }
              accessibilityRole="button"
              accessibilityLabel={`${point.label}: ${valueFormat(point.value)}`}
              onPress={() => setActive(i)}
              onHoverIn={() => setActive(i)}
              onHoverOut={() => setActive(null)}
              onFocus={() => {
                setActive(i);
                setKeyboardIndex(i);
              }}
              onBlur={() => setActive(null)}
              {...(Platform.OS === "web"
                ? {
                    onKeyDown: (event: React.KeyboardEvent) => {
                      let next = i;
                      if (event.key === "ArrowRight")
                        next = Math.min(points.length - 1, i + 1);
                      else if (event.key === "ArrowLeft")
                        next = Math.max(0, i - 1);
                      else if (event.key === "Home") next = 0;
                      else if (event.key === "End") next = points.length - 1;
                      else return;
                      event.preventDefault();
                      setKeyboardIndex(next);
                      setActive(next);
                      (
                        controls.current[next] as unknown as HTMLElement | null
                      )?.focus({ preventScroll: true });
                    },
                  }
                : {})}
              style={{
                flex: 1,
                minWidth: 0,
                ...(Platform.OS === "web"
                  ? { cursor: "pointer" as const }
                  : {}),
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  root: { minWidth: 0 },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  caption: { fontSize: 11, lineHeight: 18 },
});
