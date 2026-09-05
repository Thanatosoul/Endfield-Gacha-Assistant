import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, Check } from 'lucide-react';
import { useData } from '@/app/hooks/contexts';
import { performCheckIn, type CheckInUserResult } from '@/modules/skland-checkin/service';
import { getCheckInConfig, getCheckInToken, saveCheckInLastResults, type CheckInConfig, type CheckInConfigLastResult } from '@/modules/skland-checkin/config';

interface AccountCheckInState {
  hgUid: string;
  nickname: string;
  config: CheckInConfig;
  checking: boolean;
  results: CheckInUserResult[] | null;
  error: string | null;
}

export function CheckInPage() {
  const { accounts } = useData();
  const [checkInStates, setCheckInStates] = useState<AccountCheckInState[]>([]);
  const [batchChecking, setBatchChecking] = useState(false);

  const loadConfigs = useCallback(async () => {
    const uniqueHgUids = [...new Set(accounts.map((a) => a.hg_uid))];
    const states: AccountCheckInState[] = [];
    for (const hgUid of uniqueHgUids) {
      try {
        const cfg = await getCheckInConfig(hgUid);
        if (cfg) {
          const acc = accounts.find((a) => a.hg_uid === hgUid);
          states.push({
            hgUid,
            nickname: acc?.nickname ?? hgUid,
            config: cfg,
            checking: false,
            results: null,
            error: null,
          });
        }
      } catch (e) {
        console.error('[CheckInPage] Failed to load config for', hgUid, e);
      }
    }
    setCheckInStates(states);
  }, [accounts]);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  const handleSingleCheckIn = async (index: number) => {
    const state = checkInStates[index];
    if (!state) return;
    const now = Date.now();
    setCheckInStates((prev) => prev.map((s, i) => (i === index ? { ...s, checking: true, error: null, results: null } : s)));

    try {
      const token = await getCheckInToken(state.hgUid);
      if (!token) throw new Error('未找到此账号的签到 Token，请在账号页面重新启用签到。');
      const results = await performCheckIn(token);
      const lastResults: CheckInConfigLastResult[] = [];
      for (const user of results) {
        for (const r of user.results) {
          lastResults.push({
            game: r.game,
            nickname: r.nickname,
            success: r.success,
            awards: r.awards.map((a) => `${a.name}x${a.count}`),
            error: r.error,
            at: now,
          });
        }
      }
      await saveCheckInLastResults(state.hgUid, lastResults);
      setCheckInStates((prev) =>
        prev.map((s, i) =>
          i === index
            ? {
                ...s,
                checking: false,
                results,
                config: { ...s.config, lastCheckInAt: now, lastResults },
              }
            : s,
        ),
      );
    } catch (e) {
      setCheckInStates((prev) =>
        prev.map((s, i) => (i === index ? { ...s, checking: false, error: e instanceof Error ? e.message : String(e) } : s)),
      );
    }
  };

  const handleBatchCheckIn = async () => {
    setBatchChecking(true);
    try {
      for (let i = 0; i < checkInStates.length; i++) {
        await handleSingleCheckIn(i);
      }
    } finally {
      setBatchChecking(false);
    }
  };

  const allConfigured = checkInStates.length > 0;

  const fmtTime = (ts: number | null) => {
    if (!ts) return '暂无';
    return new Date(ts).toLocaleString();
  };

  const resultChips = (results: CheckInConfigLastResult[] | undefined) => {
    if (!results || results.length === 0) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {results.map((r, i) => (
          <span
            key={i}
            className={`ef-chip ${r.success ? 'ef-chip--ok' : 'ef-chip--err'}`}
          >
            {r.game}: {r.success ? r.awards.join(', ') || '已签' : r.error}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="grid gap-4">
      <section className="ef-sec p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="ef-kicker">森空岛</p>
            <h3 className="mt-2 ef-title text-xl">每日签到</h3>
          </div>
          {allConfigured && (
            <button
              type="button"
              onClick={() => void handleBatchCheckIn()}
              disabled={batchChecking}
              className="ef-btn ef-btn--primary"
            >
              <Check className="h-4 w-4" />
              {batchChecking ? '签到中…' : '一键签到'}
            </button>
          )}
        </div>

        {!allConfigured && (
          <p className="mt-4 text-sm text-muted">
            暂无签到配置。请在「账号」页面点击账号旁的「签到设置」启用签到。
          </p>
        )}
      </section>

      {checkInStates.map((state, index) => (
        <section key={state.hgUid} className="ef-sec p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="ef-title text-lg">{state.nickname}</h4>
                <span className="ef-chip">{state.hgUid}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                <span>上次签到: {fmtTime(state.config.lastCheckInAt)}</span>
              </div>
              {resultChips(state.config.lastResults)}
            </div>
            <button
              type="button"
              onClick={() => void handleSingleCheckIn(index)}
              disabled={state.checking || batchChecking}
              className="ef-btn shrink-0"
            >
              <CalendarCheck className="h-4 w-4" />
              {state.checking ? '签到中…' : '签到'}
            </button>
          </div>

          {state.error && (
            <div className="mt-3 border border-[color:var(--danger)]/40 px-4 py-2 text-xs text-[color:var(--danger)]">
              {state.error}
            </div>
          )}

          {state.results && state.results.length > 0 && (
            <div className="mt-4 grid gap-2">
              {state.results.flatMap((user) =>
                user.results.map((r, i) => (
                  <div
                    key={`${r.game}-${r.nickname}-${i}`}
                    className={`ef-sub flex items-center justify-between gap-3 p-3 border-l-2 ${
                      r.success ? 'border-[color:var(--success)]' : 'border-[color:var(--danger)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs uppercase tracking-[0.15em] text-muted">{r.game}</span>
                      <span className="text-sm">{r.nickname}</span>
                      {r.success && r.awards.length > 0 && (
                        <span className="text-xs text-muted">
                          {r.awards.map((a) => `${a.name}x${a.count}`).join(' · ')}
                        </span>
                      )}
                      {r.error && r.success && <span className="text-xs text-muted">({r.error})</span>}
                      {r.error && !r.success && <span className="text-xs text-[color:var(--danger)]">{r.error}</span>}
                    </div>
                    <span className={`text-xs font-semibold ${r.success ? 'text-[color:var(--success)]' : 'text-[color:var(--danger)]'}`}>
                      {r.success ? '✓' : '✗'}
                    </span>
                  </div>
                )),
              )}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
