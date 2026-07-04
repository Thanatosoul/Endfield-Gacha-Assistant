import type { GachaRecord } from '@/domain/types';

export interface SyncPage<T> {
  items: T[];
  nextCursor?: string | null;
}

export interface IncrementalSyncResult<T> {
  records: T[];
  stoppedOnSeqId: string | null;
  visitedPages: number;
}

export function collectIncrementalRecords<T extends Pick<GachaRecord, 'seq_id'>>(
  pages: Array<SyncPage<T>>,
  existingSeqIds: Set<string>,
): IncrementalSyncResult<T> {
  if (!Array.isArray(pages)) {
    return { records: [], stoppedOnSeqId: null, visitedPages: 0 };
  }
  const seqIds = existingSeqIds instanceof Set ? existingSeqIds : new Set<string>();
  const records: T[] = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];

    for (const record of page.items) {
      if (seqIds.has(record.seq_id)) {
        return {
          records,
          stoppedOnSeqId: record.seq_id,
          visitedPages: pageIndex + 1,
        };
      }

      records.push(record);
    }
  }

  return {
    records,
    stoppedOnSeqId: null,
    visitedPages: pages.length,
  };
}

export function createSyncCancellation() {
  let cancelled = false;

  return {
    cancel() {
      cancelled = true;
    },
    get isCancelled() {
      return cancelled;
    },
  };
}

export async function waitWithJitter(baseDelayMs: number, varianceMs = 180): Promise<number> {
  const jitter = Math.round(Math.random() * varianceMs);
  const total = baseDelayMs + jitter;
  await new Promise((resolve) => setTimeout(resolve, total));
  return total;
}
