import type { SyncLogEntry } from '@/domain/types';

export type SyncStatusTone = 'ok' | 'warn' | 'error' | 'muted';

export function syncStatusLabel(status: string): string {
  switch (status) {
    case 'idle':
      return '待机';
    case 'running':
      return '进行中';
    case 'completed':
      return '已完成';
    case 'cancelled':
      return '已取消';
    case 'failed':
      return '失败';
    default:
      return status;
  }
}

export function syncStatusTone(status: string): SyncStatusTone {
  switch (status) {
    case 'completed':
      return 'ok';
    case 'running':
    case 'cancelled':
      return 'warn';
    case 'failed':
      return 'error';
    default:
      return 'muted';
  }
}

export function syncCategoryLabel(category: string): string {
  if (category === 'weapon') return '武器';
  if (category === 'character') return '角色';
  return category;
}

export function formatSyncDuration(startedAt: number, finishedAt: number | null): string {
  if (finishedAt == null) return '进行中';
  const seconds = Math.max(0, Math.round((finishedAt - startedAt) / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} 分` : `${minutes} 分 ${rest} 秒`;
}

export function formatSyncTimestamp(ts: number | null): string {
  if (ts == null) return '—';
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export interface SyncLogStats {
  total: number;
  completed: number;
  failed: number;
  lastFinishedAt: number | null;
}

export function summarizeSyncLogs(entries: SyncLogEntry[]): SyncLogStats {
  let completed = 0;
  let failed = 0;
  let lastFinishedAt: number | null = null;
  for (const entry of entries) {
    if (entry.status === 'completed') completed += 1;
    if (entry.status === 'failed') failed += 1;
    if (entry.finished_at != null && (lastFinishedAt == null || entry.finished_at > lastFinishedAt)) {
      lastFinishedAt = entry.finished_at;
    }
  }
  return { total: entries.length, completed, failed, lastFinishedAt };
}
