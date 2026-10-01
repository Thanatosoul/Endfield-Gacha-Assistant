import { useEffect, useRef, useState, type RefObject } from 'react';
import { computeVirtualWindow, type VirtualWindow } from '@/lib/virtual-window';

export interface VirtualRowsState {
  scrollRef: RefObject<HTMLDivElement | null>;
  window: VirtualWindow;
}

/**
 * Tracks a scroll container and returns the visible row window for a fixed-height list.
 * Falls back to a bounded initial slice before the first measurement.
 */
export function useVirtualRows(count: number, rowHeight: number, overscan = 6, initialRows = 30): VirtualRowsState {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [virtualWindow, setVirtualWindow] = useState<VirtualWindow>(() => ({
    start: 0,
    end: Math.min(Math.max(count, 0), initialRows),
    paddingTop: 0,
    paddingBottom: 0,
  }));

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      setVirtualWindow(
        computeVirtualWindow({
          scrollTop: el.scrollTop,
          viewportHeight: el.clientHeight,
          rowHeight,
          count,
          overscan,
        }),
      );
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(el);

    return () => {
      el.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, [count, rowHeight, overscan]);

  return { scrollRef, window: virtualWindow };
}
