import { describe, expect, it } from 'vitest';
import {
  formatSyncDuration,
  formatSyncTimestamp,
  summarizeSyncLogs,
  syncCategoryLabel,
  syncStatusLabel,
  syncStatusTone,
} from './history';
import type { SyncLogEntry } from '@/domain/types';

function log(overrides: Partial<SyncLogEntry> = {}): SyncLogEntry {
  return {
    id: 'log-1',
    account_id: 'acc-1',
    region: 'cn',
    category: 'character',
    started_at: 0,
    finished_at: null,
    status: 'completed',
    message: '',
    ...overrides,
  };
}

describe('sync history helpers', () => {
  it('maps statuses to labels and tones', () => {
    expect(syncStatusLabel('completed')).toBe('已完成');
    expect(syncStatusLabel('failed')).toBe('失败');
    expect(syncStatusLabel('running')).toBe('进行中');
    expect(syncStatusLabel('cancelled')).toBe('已取消');
    expect(syncStatusLabel('weird')).toBe('weird');

    expect(syncStatusTone('completed')).toBe('ok');
    expect(syncStatusTone('failed')).toBe('error');
    expect(syncStatusTone('running')).toBe('warn');
    expect(syncStatusTone('cancelled')).toBe('warn');
    expect(syncStatusTone('idle')).toBe('muted');
  });

  it('maps categories to Chinese labels', () => {
    expect(syncCategoryLabel('character')).toBe('角色');
    expect(syncCategoryLabel('weapon')).toBe('武器');
    expect(syncCategoryLabel('other')).toBe('other');
  });

  it('formats durations in seconds and minutes', () => {
    expect(formatSyncDuration(1000, null)).toBe('进行中');
    expect(formatSyncDuration(1000, 6000)).toBe('5 秒');
    expect(formatSyncDuration(0, 65000)).toBe('1 分 5 秒');
    expect(formatSyncDuration(0, 120000)).toBe('2 分');
    expect(formatSyncDuration(5000, 1000)).toBe('0 秒');
  });

  it('formats timestamps deterministically in local time', () => {
    expect(formatSyncTimestamp(null)).toBe('—');
    const ts = new Date(2026, 0, 2, 3, 4, 5).getTime();
    expect(formatSyncTimestamp(ts)).toBe('2026-01-02 03:04:05');
  });

  it('summarizes counts and the latest finish time', () => {
    const stats = summarizeSyncLogs([
      log({ id: 'a', status: 'completed', finished_at: 100 }),
      log({ id: 'b', status: 'failed', finished_at: 300 }),
      log({ id: 'c', status: 'running', finished_at: null }),
      log({ id: 'd', status: 'completed', finished_at: 200 }),
    ]);
    expect(stats).toEqual({ total: 4, completed: 2, failed: 1, lastFinishedAt: 300 });
  });

  it('returns zeroed stats for an empty history', () => {
    expect(summarizeSyncLogs([])).toEqual({ total: 0, completed: 0, failed: 0, lastFinishedAt: null });
  });
});
