import { memo, useMemo } from 'react';
import type { GachaRecord, PoolMetadata } from '@/domain/types';
import { getAssetUrl } from '@/lib/runtime';
import { judgeIsUp } from '@/modules/stats-engine/summary';

interface TimelineMarker {
  paidIndex: number;
  record: GachaRecord;
  type: 'up6' | 'six';
}

interface PullTimelineProps {
  records: GachaRecord[];
  metadata?: PoolMetadata;
}

export const PullTimeline = memo(function PullTimeline({ records, metadata }: PullTimelineProps) {
  const { totalPaid, markers, fivePositions } = useMemo(() => {
    const sorted = [...records].sort((a, b) => a.gacha_ts - b.gacha_ts);
    let paidCount = 0;
    const markers: TimelineMarker[] = [];
    const fivePositions: number[] = [];
    for (const r of sorted) {
      if (!r.is_free) paidCount++;
      if (r.rarity === 6) {
        const isUp = judgeIsUp(r, metadata);
        markers.push({
          paidIndex: paidCount,
          record: r,
          type: isUp ? 'up6' : 'six',
        });
      } else if (r.rarity === 5) {
        fivePositions.push(paidCount);
      }
    }
    return { totalPaid: paidCount, markers, fivePositions };
  }, [records, metadata]);

  if (totalPaid === 0) return null;

  const maxX = Math.max(totalPaid, 120);
  const W = 700;
  const padL = 50;
  const padR = 40;
  const barW = W - padL - padR;
  const barY = 32;
  const barH = 12;
  const rowH = 60;
  const H = 52 + markers.length * rowH + 16;

  const xPos = (paidIndex: number) => padL + (paidIndex / maxX) * barW;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-main)' }}>抽取时间线</span>
        <span className="text-xs text-muted">共 {totalPaid} 抽 (不计免费)</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: H }}>
        <defs>
          {markers.map((m, i) => (
            <clipPath key={`clip-${i}`} id={`clip-${i}`}>
              <circle cx={xPos(m.paidIndex)} cy={44 + i * rowH + 16} r={14} />
            </clipPath>
          ))}
        </defs>

        {/* Zone backgrounds */}
        <rect x={padL} y={barY - 3} width={Math.min(barW, (80 / maxX) * barW)} height={barH + 6} fill="#22c55e" opacity={0.08} rx={4} />
        {maxX > 80 && (
          <rect x={padL + (80 / maxX) * barW} y={barY - 3} width={Math.min(barW - (80 / maxX) * barW, (40 / maxX) * barW)} height={barH + 6} fill="#f59e0b" opacity={0.08} rx={4} />
        )}
        {maxX > 120 && (
          <rect x={padL + (120 / maxX) * barW} y={barY - 3} width={barW - (120 / maxX) * barW} height={barH + 6} fill="#dc2626" opacity={0.08} rx={4} />
        )}

        {/* Main bar */}
        <rect x={padL} y={barY} width={barW} height={barH} rx={4} fill="var(--text-muted)" opacity={0.2} />

        {/* Cap markers */}
        <line x1={xPos(80)} y1={barY - 6} x2={xPos(80)} y2={barY + barH + 6} stroke="#f59e0b" strokeWidth={1.5} />
        <text x={xPos(80)} y={barY - 10} textAnchor="middle" fill="#f59e0b" fontSize={10} fontWeight={700}>80</text>
        <line x1={xPos(120)} y1={barY - 6} x2={xPos(120)} y2={barY + barH + 6} stroke="#dc2626" strokeWidth={1.5} />
        <text x={xPos(120)} y={barY - 10} textAnchor="middle" fill="#dc2626" fontSize={10} fontWeight={700}>120</text>

        {/* 0 and total labels */}
        <text x={padL} y={barY + barH + 20} textAnchor="middle" fill="var(--text-muted)" fontSize={10}>0</text>
        <text x={padL + barW} y={barY + barH + 20} textAnchor="middle" fill="var(--text-muted)" fontSize={10}>{totalPaid}</text>

        {/* 5-star dots */}
        {fivePositions.map((pos, i) => (
          <circle key={`5-${i}`} cx={xPos(pos)} cy={barY + barH / 2} r={4} fill="#f59e0b" opacity={0.6} />
        ))}

        {/* 6-star markers with labels */}
        {markers.map((m, i) => {
          const x = xPos(m.paidIndex);
          const dotY = barY + barH / 2;
          const labelY = 44 + i * rowH;
          const typeColor = m.type === 'up6' ? '#ef4444' : '#f97316';
          const typeLabel = m.type === 'up6' ? '6★UP' : '6★';
          const folder = m.record.category === 'weapon' ? 'weapon' : 'character';
          const imgSrc = getAssetUrl(`/source/${folder}/${m.record.item_id}.png`);

          return (
            <g key={`${m.record.record_uid}-${m.paidIndex}`}>
              <line x1={x} y1={dotY + 7} x2={x} y2={labelY - 4} stroke={typeColor} strokeWidth={1} strokeDasharray="3 2" opacity={0.4} />
              <circle cx={x} cy={dotY} r={6} fill={typeColor} stroke="var(--panel)" strokeWidth={2} />

              <rect x={x - 110} y={labelY} width={220} height={rowH - 8} rx={10} fill="var(--panel-strong)" />
              <image href={imgSrc} x={x - 14} y={labelY + 2} width={28} height={28} clipPath={`url(#clip-${i})`} />
              <text x={x + 20} y={labelY + 18} fill="var(--text-main)" fontSize={13} fontWeight={600}>
                {m.record.item_name.length > 14 ? m.record.item_name.slice(0, 13) + '…' : m.record.item_name}
              </text>
              <text x={x + 20} y={labelY + 34} fill={typeColor} fontSize={11} fontWeight={600}>
                {typeLabel} · 第{m.paidIndex}抽
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex justify-center gap-4 mt-2 text-[10px] text-muted">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ef4444]" /> 6★UP</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#f97316]" /> 6★</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#f59e0b]" /> 5★</span>
      </div>
    </div>
  );
});
