import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, Check } from 'lucide-react';
import { useData, useAuth } from '@/app/hooks/contexts';
import { performCheckIn, type CheckInUserResult } from '@/modules/skland-checkin/service';
import { getCheckInConfig, saveCheckInLastResults, type CheckInConfig, type CheckInConfigLastResult } from '@/modules/skland-checkin/config';

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
  const { token } = useAuth();
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
    if (!token.trim()) {
      setCheckInStates((prev) => prev.map((s, i) => (i === index ? { ...s, checking: false, error: '请先在账号页面设置 Token' } : s)));
      return;
    }

    const now = Date.now();
    setCheckInStates((prev) => prev.map((s, i) => (i === index ? { ...s, checking: true, error: null, results: null } : s)));

    try {
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
            className={`rounded-full border px-2 py-0.5 text-[10px] ${r.success ? 'border-[color:var(--success)]/40 text-[color:var(--success)]' : 'border-[color:var(--danger)]/40 text-[color:var(--danger)]'}`}
          >
            {r.game}: {r.success ? r.awards.join(', ') || '已签' : r.error}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="grid gap-4">
      <section className="panel rounded-[28px] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">森空岛</p>
            <h3 className="mt-2 text-xl font-semibold">每日签到</h3>
          </div>
          {allConfigured && (
            <button
              type="button"
              onClick={() => void handleBatchCheckIn()}
              disabled={batchChecking}
              className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--accent)] bg-[color:var(--accent)]/12 px-5 py-3 text-sm font-medium disabled:opacity-50 transition hover:bg-[color:var(--accent)]/20"
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
        <section key={state.hgUid} className="panel rounded-[28px] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-semibold">{state.nickname}</h4>
                <span className="rounded-full border border-[color:var(--panel-border)] px-2 py-0.5 text-[10px] text-muted">
                  {state.hgUid}
                </span>
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
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-[color:var(--panel-border)] px-4 py-2.5 text-sm disabled:opacity-50 transition hover:border-[color:var(--accent)]/50"
            >
              <CalendarCheck className="h-4 w-4" />
              {state.checking ? '签到中…' : '签到'}
            </button>
          </div>

          {state.error && (
            <div className="mt-3 rounded-2xl border border-[color:var(--danger)]/40 px-4 py-2 text-xs text-[color:var(--danger)]">
              {state.error}
            </div>
          )}

          {state.results && state.results.length > 0 && (
            <div className="mt-4 grid gap-2">
              {state.results.flatMap((user) =>
                user.results.map((r, i) => (
                  <div
                    key={`${r.game}-${r.nickname}-${i}`}
                    className={`panel-strong flex items-center justify-between rounded-2xl p-3 border-l-2 ${
                      r.success ? 'border-[color:var(--success)]/40' : 'border-[color:var(--danger)]/40'
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
