import { useCallback, useEffect, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { useData } from '@/app/hooks/contexts';
import { listSyncLogs } from '@/modules/storage/queries';
import { isTauriRuntime } from '@/lib/runtime';
import {
  formatSyncDuration,
  formatSyncTimestamp,
  syncCategoryLabel,
  syncStatusLabel,
  syncStatusTone,
  summarizeSyncLogs,
  type SyncStatusTone,
} from '@/modules/sync-engine/history';
import type { SyncLogEntry } from '@/domain/types';

const TONE_CLASS: Record<SyncStatusTone, string> = {
  ok: 'text-[color:var(--success)]',
  warn: 'text-[color:var(--signal)]',
  error: 'text-[color:var(--danger)]',
  muted: 'text-muted',
};

const STATUS_DOT: Record<SyncStatusTone, string> = {
  ok: 'bg-[color:var(--success)]',
  warn: 'bg-[color:var(--signal)]',
  error: 'bg-[color:var(--danger)]',
  muted: 'bg-muted',
};

export function SyncHistoryPanel() {
  const { accounts } = useData();
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isTauriRuntime()) {
      setError('同步历史仅在桌面端可用。');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setLogs(await listSyncLogs());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nameOf = (accountId: string) => accounts.find((a) => a.id === accountId)?.nickname ?? accountId;
  const stats = summarizeSyncLogs(logs);

  return (
    <div className="ef-sub p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted">
          <History className="h-3.5 w-3.5" />
          同步历史
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="ef-btn ef-btn--sm">
          <RefreshCw className={loading ? 'animate-spin' : ''} /> 刷新
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Metric label="记录" value={String(stats.total)} />
        <Metric label="成功" value={String(stats.completed)} />
        <Metric label="失败" value={String(stats.failed)} />
      </div>
      <p className="mt-2 text-xs text-muted">
        最近完成：{stats.lastFinishedAt == null ? '暂无' : formatSyncTimestamp(stats.lastFinishedAt)}
      </p>

      {error && (
        <div className="mt-3 border-l-[3px] border-[color:var(--danger)] bg-[color:var(--danger)]/5 px-3 py-2 text-xs text-[color:var(--danger)]">
          {error}
        </div>
      )}

      {logs.length > 0 && (
        <div className="mt-3 max-h-64 overflow-auto border border-[color:var(--rule)] p-1">
          {logs.map((entry) => {
            const tone = syncStatusTone(entry.status);
            return (
              <div
                key={entry.id}
                className="flex items-start justify-between gap-3 px-2 py-1.5 text-xs hover:bg-white/5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[tone]}`} aria-hidden="true" />
                    <span className={`font-medium ${TONE_CLASS[tone]}`}>{syncStatusLabel(entry.status)}</span>
                    <span className="text-muted">· {syncCategoryLabel(entry.category)}</span>
                  </div>
                  <div className="mt-0.5 truncate text-muted">{nameOf(entry.account_id)}</div>
                  {entry.message && <div className="mt-0.5 break-all text-muted">{entry.message}</div>}
                </div>
                <div className="shrink-0 text-right text-muted">
                  <div>{formatSyncTimestamp(entry.started_at)}</div>
                  <div>{formatSyncDuration(entry.started_at, entry.finished_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!error && logs.length === 0 && !loading && <p className="mt-3 text-xs text-muted">还没有同步记录。</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[color:var(--rule-soft)] px-2 py-1.5">
      <div className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted">{label}</div>
      <div className="mt-1 text-sm text-[#f2f2f0]">{value}</div>
    </div>
  );
}
