import { memo, useMemo } from 'react';
import type { PoolSummary, SummaryMetrics, PityGapInfo } from '@/modules/stats-engine/summary';
import { PityProgressBar } from '@/components/PityProgressBar';
import { AvatarImg } from '@/components/AvatarImg';

interface StatisticsPageProps {
  summary: SummaryMetrics;
  poolSummaries: PoolSummary[];
  pityGaps: PityGapInfo[];
  pityGapsWpn: PityGapInfo[];
}

function GapStatsSection({ title, gaps }: { title: string; gaps: PityGapInfo[] }) {
  const stats = useMemo(() => {
    if (gaps.length === 0) return null;
    let min = gaps[0];
    let max = gaps[0];
    let sum = 0;
    for (const g of gaps) {
      if (g.gap < min.gap) min = g;
      if (g.gap > max.gap) max = g;
      sum += g.gap;
    }
    return { average: Math.round(sum / gaps.length), min, max, count: gaps.length };
  }, [gaps]);

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)] mb-3">{title}</p>
      {stats ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="panel-strong rounded-2xl p-4 text-center">
            <div className="text-xs uppercase tracking-[0.2em] text-muted">平均抽数</div>
            <div className="mt-2 text-2xl font-semibold">{stats.average}</div>
          </div>
          <div className="panel-strong rounded-2xl p-4 text-center">
            <div className="text-xs uppercase tracking-[0.2em] text-muted">最少抽数</div>
            <div className="mt-2 text-2xl font-semibold">{stats.min.gap}</div>
            {stats.min.record && (
              <div className="mt-1 flex items-center justify-center gap-1.5 truncate">
                <AvatarImg category={stats.min.record.category} itemId={stats.min.record.item_id} size={16} ringClass="border border-red-500/50" />
                <span className="text-xs text-muted truncate">{stats.min.record.item_name}</span>
              </div>
            )}
          </div>
          <div className="panel-strong rounded-2xl p-4 text-center">
            <div className="text-xs uppercase tracking-[0.2em] text-muted">最多抽数</div>
            <div className="mt-2 text-2xl font-semibold">{stats.max.gap}</div>
            {stats.max.record && (
              <div className="mt-1 flex items-center justify-center gap-1.5 truncate">
                <AvatarImg category={stats.max.record.category} itemId={stats.max.record.item_id} size={16} ringClass="border border-red-500/50" />
                <span className="text-xs text-muted truncate">{stats.max.record.item_name}</span>
              </div>
            )}
          </div>
          <div className="panel-strong rounded-2xl p-4 text-center">
            <div className="text-xs uppercase tracking-[0.2em] text-muted">统计次数</div>
            <div className="mt-2 text-2xl font-semibold">{stats.count}</div>
          </div>
        </div>
      ) : (
        <div className="panel-strong rounded-2xl p-6 text-center text-sm text-muted">
          暂无数据
        </div>
      )}
    </div>
  );
}

export const StatisticsPage = memo(function StatisticsPage({ summary, poolSummaries, pityGaps, pityGapsWpn }: StatisticsPageProps) {
  return (
    <div className="grid gap-4">
      <section className="panel rounded-[28px] p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">总览</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="总抽数" value={String(summary.totalPulls)} hint={`${summary.paidPulls} paid`} />
          <StatTile label="六星" value={String(summary.rarityCounts[6])} hint={`${(summary.sixStarRate * 100).toFixed(2)}%`} />
          <StatTile label="五星" value={String(summary.rarityCounts[5])} hint={`${(summary.fiveStarRate * 100).toFixed(2)}%`} />
          <StatTile label="UP保底" value={String(summary.currentPity)} hint="距上次六星" />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="panel-strong rounded-2xl p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted mb-2">最新6星 UP 角色</div>
            {summary.latestUpSixStar ? (
              <div className="flex items-center gap-2">
                <AvatarImg category={summary.latestUpSixStar.category} itemId={summary.latestUpSixStar.item_id} size={28} ringClass="border border-red-500/50" />
                <span className="text-sm font-medium truncate">{summary.latestUpSixStar.item_name}</span>
              </div>
            ) : <span className="text-sm text-muted">—</span>}
          </div>
          <div className="panel-strong rounded-2xl p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted mb-2">最新6星 角色</div>
            {summary.latestCharSixStar ? (
              <div className="flex items-center gap-2">
                <AvatarImg category={summary.latestCharSixStar.category} itemId={summary.latestCharSixStar.item_id} size={28} ringClass="border border-red-500/50" />
                <span className="text-sm font-medium truncate">{summary.latestCharSixStar.item_name}</span>
              </div>
            ) : <span className="text-sm text-muted">—</span>}
          </div>
          <div className="panel-strong rounded-2xl p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted mb-2">最新6星 武器</div>
            {summary.latestWpnSixStar ? (
              <div className="flex items-center gap-2">
                <AvatarImg category={summary.latestWpnSixStar.category} itemId={summary.latestWpnSixStar.item_id} size={28} ringClass="border border-red-500/50" />
                <span className="text-sm font-medium truncate">{summary.latestWpnSixStar.item_name}</span>
              </div>
            ) : <span className="text-sm text-muted">—</span>}
          </div>
        </div>
      </section>

      <section className="panel rounded-[28px] p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)] mb-3">保底进度</p>
        <PityProgressBar currentPity={summary.currentPity} />
      </section>

      <section className="panel rounded-[28px] p-5 sm:p-6 grid gap-6">
        <GapStatsSection title="六星出货统计 (角色池)" gaps={pityGaps} />
        <GapStatsSection title="六星出货统计 (武器池)" gaps={pityGapsWpn} />
      </section>

      <section className="panel rounded-[28px] p-5 sm:p-6">
        <p className="text-sm text-muted">
          卡池已拆分为独立页面：角色卡池 / 武器卡池。当前共 {poolSummaries.length} 个卡池。
        </p>
      </section>
    </div>
  );
});

const StatTile = memo(function StatTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="panel-strong rounded-2xl p-4">
      <div className="text-xs uppercase tracking-[0.22em] text-muted">{label}</div>
      <div className="mt-3 text-3xl font-semibold">{value}</div>
      <div className="mt-2 text-sm text-muted">{hint}</div>
    </div>
  );
});
