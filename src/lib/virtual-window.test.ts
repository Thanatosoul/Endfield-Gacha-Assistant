import { describe, expect, it } from 'vitest';
import { computeVirtualWindow } from '@/lib/virtual-window';

describe('computeVirtualWindow', () => {
  it('returns an empty window for zero rows', () => {
    expect(computeVirtualWindow({ scrollTop: 0, viewportHeight: 400, rowHeight: 50, count: 0 })).toEqual({
      start: 0,
      end: 0,
      paddingTop: 0,
      paddingBottom: 0,
    });
  });

  it('renders only a viewport plus overscan when scrolled to the top', () => {
    const w = computeVirtualWindow({ scrollTop: 0, viewportHeight: 400, rowHeight: 50, count: 1000, overscan: 4 });
    expect(w.start).toBe(0);
    expect(w.end).toBe(8 + 8);
    expect(w.paddingTop).toBe(0);
    expect(w.paddingBottom).toBe((1000 - 16) * 50);
  });

  it('shifts the window by one row per rowHeight of scroll', () => {
    const w = computeVirtualWindow({ scrollTop: 500, viewportHeight: 400, rowHeight: 50, count: 1000, overscan: 0 });
    expect(w.start).toBe(10);
    expect(w.end).toBe(18);
    expect(w.paddingTop).toBe(500);
  });

  it('clamps the end at the total count near the bottom', () => {
    const w = computeVirtualWindow({ scrollTop: 49_500, viewportHeight: 400, rowHeight: 50, count: 1000, overscan: 6 });
    expect(w.end).toBe(1000);
    expect(w.paddingBottom).toBe(0);
  });

  it('guards against negative scroll and non-positive row height', () => {
    expect(
      computeVirtualWindow({ scrollTop: -100, viewportHeight: 400, rowHeight: 50, count: 10, overscan: 0 }).start,
    ).toBe(0);
    expect(computeVirtualWindow({ scrollTop: 0, viewportHeight: 400, rowHeight: 0, count: 10 })).toEqual({
      start: 0,
      end: 0,
      paddingTop: 0,
      paddingBottom: 0,
    });
  });
});
