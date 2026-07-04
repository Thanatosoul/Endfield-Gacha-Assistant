import { memo } from 'react';

interface PityProgressBarProps {
  currentPity: number;
}

export const PityProgressBar = memo(function PityProgressBar({
  currentPity,
}: PityProgressBarProps) {
  const softCap = 80;
  const remaining = Math.max(0, softCap - currentPity);

  const pct = Math.min((currentPity / softCap) * 100, 100);

  const fillColor =
    currentPity >= softCap ? '#991b1b' :
    currentPity >= 60 ? '#dc2626' :
    currentPity >= 50 ? '#f59e0b' :
    '#22c55e';

  const inSoft = currentPity >= 60;

  return (
    <div className="panel-strong rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">保底进度</span>
        <span className="text-sm tabular-nums" style={{ color: 'var(--text-muted)' }}>
          距离下次保底：<strong className="text-[color:var(--text-main)]">{remaining}</strong>
        </span>
      </div>

      <div className="relative h-7 w-full rounded-full overflow-hidden" style={{ background: 'var(--panel-border)' }}>
        <div
          className="h-full rounded-full transition-all duration-300 flex items-center justify-end"
          style={{ width: `${Math.max(pct, currentPity > 0 ? 8 : 0)}%`, background: fillColor, opacity: 0.85 }}
        >
          {currentPity > 0 && (
            <span
              className="tabular-nums font-bold select-none mr-2"
              style={{
                fontSize: '15px',
                color: '#fff',
                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
              }}
            >
              {currentPity}
            </span>
          )}
        </div>
      </div>

      <div className="mt-1 flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>0</span>
        <span style={{ color: inSoft ? '#dc2626' : undefined }}>80 软保底</span>
      </div>

      {inSoft && (
        <div className="mt-2 text-xs font-semibold" style={{ color: '#dc2626' }}>
          ⚠ 已进入软保底区间 — 第 {currentPity} 抽，预期 80 抽内必出六星
        </div>
      )}
    </div>
  );
});
