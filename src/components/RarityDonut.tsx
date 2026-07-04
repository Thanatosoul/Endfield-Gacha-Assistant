import { memo, useMemo } from 'react';

const RARITY_CONFIG = [
  { rarity: 6, color: '#ef4444', label: '6★' },
  { rarity: 5, color: '#f59e0b', label: '5★' },
  { rarity: 4, color: '#a78bfa', label: '4★' },
  { rarity: 3, color: '#6b7280', label: '3★' },
] as const;

interface RarityDonutProps {
  counts: Record<3 | 4 | 5 | 6, number>;
  size?: number;
}

export const RarityDonut = memo(function RarityDonut({ counts, size = 160 }: RarityDonutProps) {
  const { segments, total, strokeWidth } = useMemo(() => {
    const total = counts[3] + counts[4] + counts[5] + counts[6];
    const strokeWidth = size * 0.18;
    const r = (size - strokeWidth) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const circumference = 2 * Math.PI * r;

    let offset = 0;
    const segments = RARITY_CONFIG.map((cfg) => {
      const value = counts[cfg.rarity];
      const fraction = total > 0 ? value / total : 0;
      const length = fraction * circumference;
      const seg = {
        ...cfg,
        value,
        fraction,
        dashArray: `${Math.max(length, 0.5)} ${circumference - length}`,
        dashOffset: -offset,
      };
      offset += length;
      return seg;
    });

    return { segments, total, strokeWidth, cx, cy, r, circumference };
  }, [counts, size]);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-xs text-muted">无数据</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((seg) => (
          <circle
            key={seg.rarity}
            cx={size / 2}
            cy={size / 2}
            r={(size - strokeWidth) / 2}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={seg.dashArray}
            strokeDashoffset={seg.dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            opacity={0.85}
          />
        ))}

        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fill="var(--text-main)" style={{ fontSize: size * 0.12, fontWeight: 700 }}>
          {total}
        </text>
        <text x={size / 2} y={size / 2 + 12} textAnchor="middle" fill="var(--text-muted)" style={{ fontSize: size * 0.065 }}>
          总计
        </text>
      </svg>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {RARITY_CONFIG.map((cfg) => {
          const seg = segments.find((s) => s.rarity === cfg.rarity)!;
          return (
            <div key={cfg.rarity} className="flex items-center gap-1.5 text-xs">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: cfg.color }} />
              <span style={{ color: 'var(--text-muted)' }}>{cfg.label}</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{seg.value}</span>
              <span style={{ color: 'var(--text-muted)' }}>({(seg.fraction * 100).toFixed(1)}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
