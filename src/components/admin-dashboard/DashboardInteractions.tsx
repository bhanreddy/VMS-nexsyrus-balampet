import React, { forwardRef } from "react";
import { Platform, Pressable, PressableProps, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

/** Web-only attributes stay out of native view props. */
export const dashboardData = (values: Record<string, string>) =>
  Platform.OS === "web" ? { dataSet: values } : {};

/** One feedback language for mouse, touch and keyboard, with no layout animation. */
export const MotionPressable = forwardRef<
  View,
  PressableProps & {
    feedback?: "lift" | "press" | "none";
    dataSet?: Record<string, string>;
  }
>(function MotionPressable(
  { style, feedback = "press", dataSet, ...props },
  ref,
) {
  const reduced = useReducedMotion();
  return (
    <Pressable
      ref={ref}
      {...props}
      {...dashboardData({ ...dataSet, dashboardMotion: feedback })}
      style={(state) => [
        typeof style === "function" ? style(state) : style,
        feedback !== "none" &&
          !reduced && {
            transform: [
              {
                translateY:
                  feedback === "lift" && state.hovered && !state.pressed
                    ? -2
                    : 0,
              },
              { scale: state.pressed ? 0.985 : 1 },
            ],
          },
      ]}
    />
  );
});

export function DashboardInteractionStyles() {
  if (Platform.OS !== "web") return null;
  return React.createElement(
    "style",
    null,
    `
    [data-dashboard-motion] { transition:transform 200ms cubic-bezier(.2,.8,.2,1),box-shadow 200ms ease,border-color 150ms ease,background-color 150ms ease,opacity 120ms ease; }
    [data-dashboard-motion]:focus-visible,[data-dashboard-surface] :focus-visible,[data-testid="premium-admin-dashboard"] :focus-visible { outline:2px solid #8573e7!important;outline-offset:3px; }
    [data-dashboard-motion]:disabled { cursor:default; }
    [data-dashboard-surface] { -webkit-font-smoothing:antialiased; }
    [data-dashboard-skeleton] { overflow:hidden;position:relative; }
    [data-dashboard-skeleton]::after { content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 20%,rgba(255,255,255,.22) 45%,transparent 70%);transform:translateX(-100%);animation:dashboard-shimmer 1.6s ease-in-out infinite; }
    [data-dashboard-dialog] { animation:dashboard-dialog-in 200ms cubic-bezier(.16,1,.3,1) both; }
    [data-dashboard-chart-tooltip] { animation:dashboard-tooltip-in 120ms ease-out both; }
    @keyframes dashboard-shimmer {to{transform:translateX(100%)}}
    @keyframes dashboard-dialog-in {from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes dashboard-tooltip-in {from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}
    @media(prefers-reduced-motion:reduce) {
      [data-dashboard-motion],[data-dashboard-dialog],[data-dashboard-chart-tooltip],[role="navigation"] {transition:none!important;animation:none!important;transform:none!important;}
      [data-dashboard-slider] {transition:none!important;animation:none!important;}
      [data-dashboard-skeleton]::after {animation:none!important;display:none;}
      [data-testid="premium-admin-dashboard"] * {scroll-behavior:auto!important;}
    }
  `,
  );
}
