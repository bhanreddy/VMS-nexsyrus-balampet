export interface DashboardLayoutItem {
  id: string;
  height: number;
}
export interface DashboardPlacement extends DashboardLayoutItem {
  column: number;
  x: number;
  y: number;
  width: number;
}

/** Place each card below the shortest occupied column, in stable reading order. */
export function calculateDashboardLayout(
  items: readonly DashboardLayoutItem[],
  availableWidth: number,
  gap = 16,
  maxColumns = 3,
  minColumnWidth = 390,
) {
  const width = Math.max(
    1,
    Number.isFinite(availableWidth) ? availableWidth : 1,
  );
  const spacing = Math.max(0, gap);
  const columns = Math.max(
    1,
    Math.min(
      Math.max(1, maxColumns),
      Math.floor((width + spacing) / (minColumnWidth + spacing)),
    ),
  );
  const columnWidth = Math.max(1, (width - spacing * (columns - 1)) / columns);
  const bottoms = Array<number>(columns).fill(0);
  const placements: DashboardPlacement[] = items.map((item) => {
    const column = bottoms.indexOf(Math.min(...bottoms));
    const height = Math.max(
      1,
      Number.isFinite(item.height) ? item.height : 180,
    );
    const result = {
      id: item.id,
      height,
      column,
      x: column * (columnWidth + spacing),
      y: bottoms[column],
      width: columnWidth,
    };
    bottoms[column] += height + spacing;
    return result;
  });
  return {
    columns,
    columnWidth,
    placements,
    height: items.length ? Math.max(...bottoms) - spacing : 0,
  };
}
