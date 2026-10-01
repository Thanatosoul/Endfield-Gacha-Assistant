import { memo } from 'react';
import {
  LIMITED_REWARD_MILESTONES,
  RERUN_CHARACTER_REWARD_MILESTONES,
  JOINT_REWARD_MILESTONES,
  type LimitedCharacterPity,
  type RerunCharacterPity,
  type JointCharacterPity,
} from '@/modules/stats-engine/banner-rules';

const LIMITED_MILESTONE_LABELS: Record<number, string> = {
  30: '加急招募 ×10',
  60: '寻访情报书 ×1',
};

const RERUN_MILESTONE_LABELS: Record<number, string> = {
  30: '加急招募 ×10',
  60: '加急招募 ×10',
  90: '加急招募 ×10',
};

const JOINT_MILESTONE_LABELS: Record<number, string> = {
  30: '加急招募 ×10',
  60: '基础寻访凭证 ×10',
  120: '流光庆时调用凭证 ×1',
  240: '流光庆时信物补给 ×1',
};

function RewardMilestones({
  pulls,
  milestones,
  labels,
}: {
  pulls: number;
  milestones: readonly number[];
  labels: Record<number, string>;
}) {
  return (
    <div className="mt-3 border-t border-[color:var(--rule-soft)] pt-2">
      <div className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted">累计奖励（只读参考）</div>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {milestones.map((milestone) => {
          const reached = pulls >= milestone;
          return (
            <span
              key={milestone}
              className={[
                'border px-2 py-1 text-xs',
                reached
                  ? 'border-[color:var(--success)] text-[color:var(--success)]'
                  : 'border-[color:var(--rule)] text-muted',
              ].join(' ')}
            >
              累计 {milestone} · {labels[milestone]}
              {reached ? ' ✓' : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function toneFor(ratio: number): string {
  if (ratio >= 1) return '#991b1b';
  if (ratio >= 0.75) return '#dc2626';
  if (ratio >= 0.6) return '#f59e0b';
  return '#22c55e';
}

export const PityBar = memo(function PityBar({
  label,
  value,
  cap,
  note,
}: {
  label: string;
  value: number;
  cap: number;
  note?: string;
}) {
  const ratio = cap > 0 ? value / cap : 0;
  const pct = Math.min(ratio * 100, 100);
  const color = toneFor(ratio);

  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">{label}</span>
        <span className="font-mono text-xs tabular-nums text-muted">
          <strong className="text-[color:var(--text-main)]">{value}</strong>
          <span> / {cap}</span>
          {note ? <span className="ml-2">{note}</span> : null}
        </span>
      </div>
      <div
        className="relative h-3 w-full overflow-hidden"
        style={{ background: 'var(--rule-soft)', outline: '1px solid var(--rule)' }}
      >
        <div
          className="h-full transition-[width]"
          style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%`, background: color, opacity: 0.9 }}
        />
      </div>
    </div>
  );
});

export const LimitedPityPanel = memo(function LimitedPityPanel({ pity }: { pity: LimitedCharacterPity }) {
  return (
    <section className="ef-sub p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="ef-code">限定寻访 · 连续保底</span>
        <span className="text-xs text-muted">六星跨限定池 · UP 与本池信物按本期 · 免费十连不计入</span>
      </div>
      <PityBar
        label="六星保底（跨限定池）"
        value={pity.sixStarPity}
        cap={80}
        note={pity.sixStarRemaining === 0 ? '已达保底' : `还差 ${pity.sixStarRemaining}`}
      />
      <PityBar
        label="UP 保底（本池，出 UP 六星重置）"
        value={pity.upPity}
        cap={120}
        note={pity.upRemaining === 0 ? '已达保底' : `还差 ${pity.upRemaining}`}
      />
      <PityBar label="UP 信物（本池 240 抽）" value={pity.tokenProgress} cap={240} note={`已获 ${pity.tokensEarned}`} />
      <RewardMilestones
        pulls={pity.tokenPulls}
        milestones={LIMITED_REWARD_MILESTONES}
        labels={LIMITED_MILESTONE_LABELS}
      />
    </section>
  );
});

export const RerunPityPanel = memo(function RerunPityPanel({ pity }: { pity: RerunCharacterPity }) {
  return (
    <section className="ef-sub p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="ef-code">复刻寻访{pity.upName ? ` · ${pity.upName}` : ''}</span>
        <span className="text-xs text-muted">
          {pity.upGuaranteeConsumed ? '该角色一次性 UP 保底已消耗' : '120 抽 UP 保底（同角色跨复刻继承）'}
        </span>
      </div>
      <PityBar
        label="UP 保底（同角色跨复刻）"
        value={pity.upPity}
        cap={120}
        note={pity.upGuaranteeConsumed ? '已消耗' : `还差 ${pity.upRemaining}`}
      />
      <PityBar
        label="UP 信物（同角色 240 抽）"
        value={pity.tokenProgress}
        cap={240}
        note={`已获 ${pity.tokensEarned}`}
      />
      <RewardMilestones
        pulls={pity.tokenPulls}
        milestones={RERUN_CHARACTER_REWARD_MILESTONES}
        labels={RERUN_MILESTONE_LABELS}
      />
    </section>
  );
});

export const JointPityPanel = memo(function JointPityPanel({ pity }: { pity: JointCharacterPity }) {
  return (
    <section className="ef-sub p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="ef-code">联合寻访 · 独立保底</span>
        <span className="text-xs text-muted">本池独立计数 · 免费十连不计入</span>
      </div>
      <PityBar
        label="六星保底（本池）"
        value={pity.sixStarPity}
        cap={80}
        note={pity.sixStarRemaining === 0 ? '已达保底' : `还差 ${pity.sixStarRemaining}`}
      />
      <PityBar
        label="五星保底（本池，10 抽内必出 5 星及以上）"
        value={pity.fiveStarPity}
        cap={10}
        note={pity.fiveStarRemaining === 0 ? '已达保底' : `还差 ${pity.fiveStarRemaining}`}
      />
      <PityBar
        label="信物补给（本池 240 抽）"
        value={pity.tokenProgress}
        cap={240}
        note={`已获 ${pity.tokensEarned}`}
      />
      <RewardMilestones pulls={pity.tokenPulls} milestones={JOINT_REWARD_MILESTONES} labels={JOINT_MILESTONE_LABELS} />
    </section>
  );
});
