import { describe, expect, it } from 'vitest';
import type { GachaRecord } from '@/domain/types';
import { dedupeRecords } from '@/modules/storage/normalize';

const baseRecord: GachaRecord = {
  record_uid: 'r1',
  account_id: 'acc-1',
  region: 'cn',
  category: 'character',
  pool_type: 'special_character',
  pool_id: 'pool-1',
  pool_name: 'Pool',
  item_id: 'item-1',
  item_name: 'Item',
  rarity: 5,
  is_new: false,
  is_free: false,
  weapon_type: null,
  gacha_ts: 1,
  seq_id: '1001',
  fetched_at: 2,
};

describe('dedupeRecords', () => {
  it('dedupes by account, category, and seq_id', () => {
    const result = dedupeRecords([
      baseRecord,
      { ...baseRecord, record_uid: 'r2' },
      { ...baseRecord, record_uid: 'r3', category: 'weapon', seq_id: '1001' },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].record_uid).toBe('r1');
    expect(result[1].record_uid).toBe('r3');
  });
});
