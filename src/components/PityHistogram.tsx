import { memo, useMemo } from 'react';

const BUCKETS = [
  { min: 1, max: 10, label: '1-10', color: '#22c55e' },
  { min: 11, max: 20, label: '11-20', color: '#84cc16' },
  { min: 21, max: 30, label: '21-30', color: '#eab308' },
  { min: 31, max: 40, label: '31-40', color: '#f59e0b' },
  { min: 41, max: 50, label: '41-50', color: '#f97316' },
  { min: 51, max: 60, label: '51-60', color: '#ea580c' },
  { min: 61, max: 70, label: '61-70', color: '#dc2626' },
  { min: 71, max: 80, label: '71-80', color: '#b91c1c' },
  { min: 81, max: 100, label: '81-100', color: '#991b1b' },
  { min: 101, max: 120, label: '101-120', color: '#7f1d1d' },
  { min: 121, max: Infinity, label: '121+', color: '#450a0a' },
];

interface PityHistogramProps {
  gaps: number[];
}

export const PityHistogram = memo(function PityHistogram({ gaps }: PityHistogramProps) {
  const { binned, maxCount, average, minGap, maxGap } = useMemo(() => {
    const binned = BUCKETS.map(() => 0);
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const g of gaps) {
      const idx = BUCKETS.findIndex((b) => g >= b.min && g <= b.max);
      if (idx >= 0) binned[idx]++;
      sum += g;
      if (g < min) min = g;
      if (g > max) max = g;
    }
    return {
      binned,
      maxCount: Math.max(...binned, 1),
      average: gaps.length > 0 ? Math.round(sum / gaps.length) : 0,
      minGap: gaps.length > 0 ? min : 0,
      maxGap: gaps.length > 0 ? max : 0,
    };
  }, [gaps]);

  const W = 700;
  const H = 300;
  const pad = { t: 36, r: 20, b: 50, l: 50 };
  const chartW = W - pad.l - pad.r;
  const chartH = H - pad.t - pad.b;
  const bucketW = chartW / BUCKETS.length;
  const barW = bucketW * 0.72;
  const barOffset = (bucketW - barW) / 2;

  const yScale = (v: number) => pad.t + chartH - (v / maxCount) * chartH;

  if (gaps.length === 0) {
    return (
      <div className="panel-strong rounded-2xl p-6 text-center text-sm text-muted">
        暂无六星出货记录，无法生成分布图
      </div>
    );
  }

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 300 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = yScale(frac * maxCount);
          return (
            <g key={frac}>
              <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="var(--panel-border)" strokeWidth={0.5} />
              <text x={pad.l - 8} y={y + 4} textAnchor="end" fill="var(--text-muted)" style={{ fontSize: 11 }}>
                {Math.round(frac * maxCount)}
              </text>
            </g>
          );
        })}

        <rect
          x={pad.l + 7 * bucketW}
          y={pad.t}
          width={2 * bucketW}
          height={chartH}
          fill="#dc2626"
          opacity={0.07}
          rx={4}
        />
        <text
          x={pad.l + 8 * bucketW}
          y={pad.t + 14}
          textAnchor="middle"
          fill="#dc2626"
          style={{ fontSize: 10, fontWeight: 600 }}
        >
          软保底区域
        </text>

        <rect
          x={pad.l + 9 * bucketW}
          y={pad.t}
          width={2 * bucketW}
          height={chartH}
          fill="#7f1d1d"
          opacity={0.08}
          rx={4}
        />
        <text
          x={pad.l + 10 * bucketW}
          y={pad.t + 14}
          textAnchor="middle"
          fill="#7f1d1d"
          style={{ fontSize: 10, fontWeight: 600 }}
        >
          硬保底区域
        </text>

        {BUCKETS.map((bucket, i) => {
          const count = binned[i];
          const x = pad.l + i * bucketW + barOffset;
          const y = yScale(count);
          const h = chartH - (count / maxCount) * chartH;

          return (
            <g key={bucket.label}>
              <rect x={x} y={y} width={barW} height={Math.max(h, 2)} rx={3} fill={bucket.color} opacity={0.88}>
                <title>{bucket.label}: {count} 次</title>
              </rect>
              {count > 0 && (
                <text x={x + barW / 2} y={y - 7} textAnchor="middle" fill="var(--text-main)" style={{ fontSize: 12, fontWeight: 600 }}>
                  {count}
                </text>
              )}
              <text x={x + barW / 2} y={H - pad.b + 16} textAnchor="middle" fill="var(--text-muted)" style={{ fontSize: 10 }}>
                {bucket.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex justify-center gap-6 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>平均: <strong style={{ color: 'var(--text-main)' }}>{average}</strong> 抽</span>
        <span>最少: <strong style={{ color: 'var(--text-main)' }}>{minGap}</strong> 抽</span>
        <span>最多: <strong style={{ color: 'var(--text-main)' }}>{maxGap}</strong> 抽</span>
        <span>统计: <strong style={{ color: 'var(--text-main)' }}>{gaps.length}</strong> 次</span>
      </div>
    </div>
  );
});
