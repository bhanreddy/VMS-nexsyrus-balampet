export interface SidebarTooltipProps {
  id: string;
  label: string;
  anchor: { left: number; top: number; width: number; height: number };
}
/** Native navigation already exposes its full accessible label. */
export default function SidebarTooltip(_props: SidebarTooltipProps) {
  return null;
}
