import React from "react";
import { useSidebarPalette } from "./sidebarPalette";
import type { SidebarTooltipProps } from "./SidebarTooltip";
// ReactDOM is already a runtime dependency; keep this portal's type local.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createPortal } = require("react-dom") as {
  createPortal: (
    children: React.ReactNode,
    container: Element | DocumentFragment,
  ) => React.ReactPortal;
};
export default function SidebarTooltip({
  id,
  label,
  anchor,
}: SidebarTooltipProps) {
  const p = useSidebarPalette();
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      id={id}
      role="tooltip"
      style={{
        position: "fixed",
        left: Math.min(anchor.left + anchor.width + 20, innerWidth - 260),
        top: Math.min(
          Math.max(anchor.top + anchor.height / 2 - 18, 8),
          innerHeight - 48,
        ),
        maxWidth: 240,
        padding: "10px 13px",
        background: p.tooltip,
        border: `1px solid ${p.flyoutLine}`,
        borderRadius: 9,
        color: p.tooltipText,
        boxShadow: "0 6px 24px rgba(16,24,40,.2)",
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        fontSize: 12,
        lineHeight: "18px",
        pointerEvents: "none",
        zIndex: 10000,
      }}
    >
      {label}
    </div>,
    document.body,
  );
}
