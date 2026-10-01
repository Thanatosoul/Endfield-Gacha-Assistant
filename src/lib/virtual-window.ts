export interface VirtualWindowInput {
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  count: number;
  overscan?: number;
}

export interface VirtualWindow {
  start: number;
  end: number;
  paddingTop: number;
  paddingBottom: number;
}

/**
 * Computes the slice of rows to render for a fixed-height virtual list.
 * Returns an empty window when there is nothing to render.
 */
export function computeVirtualWindow({
  scrollTop,
  viewportHeight,
  rowHeight,
  count,
  overscan = 6,
}: VirtualWindowInput): VirtualWindow {
  if (count <= 0 || rowHeight <= 0) {
    return { start: 0, end: 0, paddingTop: 0, paddingBottom: 0 };
  }

  const safeScrollTop = Math.max(0, scrollTop);
  const visible = Math.max(1, Math.ceil(Math.max(0, viewportHeight) / rowHeight));
  const start = Math.max(0, Math.floor(safeScrollTop / rowHeight) - overscan);
  const end = Math.min(count, start + visible + overscan * 2);

  return {
    start,
    end,
    paddingTop: start * rowHeight,
    paddingBottom: (count - end) * rowHeight,
  };
}
