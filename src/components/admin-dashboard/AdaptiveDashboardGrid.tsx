import React, { useEffect, useMemo, useState } from "react";
import { Platform, View } from "react-native";
import { calculateDashboardLayout } from "../../utils/dashboardLayout";
import { dashboardData } from "./DashboardInteractions";

export interface DashboardGridCard {
  id: string;
  node: React.ReactNode;
  estimatedHeight?: number;
}
/** Uses each card's real height; failed, hidden and expanded cards never reserve a column. */
export default function AdaptiveDashboardGrid({
  cards,
  initialWidth,
  gap = 16,
}: {
  cards: DashboardGridCard[];
  initialWidth: number;
  gap?: number;
}) {
  const [hasLaidOut, setHasLaidOut] = useState(false);
  const [width, setWidth] = useState(Math.max(1, initialWidth));
  const [measurements, setMeasurements] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const layout = useMemo(() => {
    const sizing = calculateDashboardLayout(
      [],
      width,
      gap,
      Platform.OS === "web" ? 3 : 2,
    );
    return calculateDashboardLayout(
      cards.map((card) => ({
        id: card.id,
        height:
          measurements[card.id] &&
          Math.abs(measurements[card.id].width - sizing.columnWidth) < 1
            ? measurements[card.id].height
            : (card.estimatedHeight ?? 200),
      })),
      width,
      gap,
      Platform.OS === "web" ? 3 : 2,
    );
  }, [cards, width, gap, measurements]);
  const measured = cards.every(
    (card) =>
      measurements[card.id] &&
      Math.abs(measurements[card.id].width - layout.columnWidth) < 1,
  );
  useEffect(() => {
    if (measured) setHasLaidOut(true);
  }, [measured]);
  return (
    <View
      role="list"
      accessibilityLabel="School dashboard sections"
      aria-busy={!measured && !hasLaidOut}
      {...dashboardData({
        dashboardGrid: "adaptive",
        dashboardLayoutReady: measured ? "true" : "false",
      })}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        if (next > 0)
          setWidth((previous) =>
            Math.abs(previous - next) >= 1 ? next : previous,
          );
      }}
      style={{
        width: "100%",
        opacity: measured || hasLaidOut ? 1 : 0,
        height: layout.height,
        position: "relative",
        minWidth: 0,
      }}
    >
      {layout.placements.map((placement, index) => (
        <View
          key={placement.id}
          role="listitem"
          {...dashboardData({
            dashboardLayoutItem: placement.id,
            dashboardColumn: String(placement.column),
          })}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: placement.width,
            minWidth: 0,
            transform: [
              { translateX: placement.x },
              { translateY: placement.y },
            ],
          }}
        >
          <View
            onLayout={(event) => {
              const measured = event.nativeEvent.layout;
              if (measured.height <= 0 || measured.width <= 0) return;
              setMeasurements((previous) => {
                const saved = previous[placement.id];
                return saved &&
                  Math.abs(saved.height - measured.height) < 0.5 &&
                  Math.abs(saved.width - measured.width) < 0.5
                  ? previous
                  : {
                      ...previous,
                      [placement.id]: {
                        width: measured.width,
                        height: measured.height,
                      },
                    };
              });
            }}
            style={{ width: "100%", minWidth: 0 }}
          >
            {cards[index].node}
          </View>
        </View>
      ))}
    </View>
  );
}
