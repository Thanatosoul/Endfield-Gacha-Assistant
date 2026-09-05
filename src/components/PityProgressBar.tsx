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
    <div className="ef-sub p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="ef-code">Pity / 保底进度</span>
        <span className="font-mono text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
          距软保底：<strong className="text-[color:var(--text-main)]">{remaining}</strong>
        </span>
      </div>

      <div className="relative h-6 w-full overflow-hidden" style={{ background: 'var(--rule-soft)', outline: '1px solid var(--rule)' }}>
        <div
          className="h-full flex items-center justify-end"
          style={{ width: `${Math.max(pct, currentPity > 0 ? 6 : 0)}%`, background: fillColor, opacity: 0.9 }}
        >
          {currentPity > 0 && (
            <span
              className="font-mono tabular-nums font-bold select-none mr-2"
              style={{
                fontSize: '13px',
                color: '#fff',
                textShadow: '0 1px 2px rgba(0,0,0,0.6)',
              }}
            >
              {currentPity}
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex justify-between font-mono text-[0.68rem] uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
        <span>0</span>
        <span style={{ color: inSoft ? '#dc2626' : undefined }}>80 软保底</span>
        <span>120 硬保底</span>
      </div>

      {inSoft && (
        <div className="mt-3 border-l-2 pl-2 text-xs font-semibold" style={{ color: '#dc2626', borderColor: '#dc2626' }}>
          已进入软保底区间 — 第 {currentPity} 抽，预期 80 抽内必出六星
        </div>
      )}
    </div>
  );
});
