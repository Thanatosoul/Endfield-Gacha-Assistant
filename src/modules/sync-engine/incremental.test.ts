import { describe, expect, it } from 'vitest';
import { collectIncrementalRecords } from '@/modules/sync-engine/incremental';

describe('collectIncrementalRecords', () => {
  it('stops immediately when an existing seq_id is seen', () => {
    const result = collectIncrementalRecords(
      [
        { items: [{ seq_id: '1003' }, { seq_id: '1002' }] },
        { items: [{ seq_id: '1001' }, { seq_id: '1000' }] },
      ],
      new Set(['1001']),
    );

    expect(result.records).toEqual([{ seq_id: '1003' }, { seq_id: '1002' }]);
    expect(result.stoppedOnSeqId).toBe('1001');
    expect(result.visitedPages).toBe(2);
  });
});
