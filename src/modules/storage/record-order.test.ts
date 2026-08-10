import { describe, expect, it } from 'vitest';
import type { GachaRecord } from '@/domain/types';
import { assignFallbackPoolOrders, assignImportedPoolOrders, compareRecordsChronologically, compareRecordsNewestFirst } from '@/modules/storage/record-order';

function record(overrides: Partial<GachaRecord>): GachaRecord {
  return {
    record_uid: 'record',
    account_id: 'account',
    region: 'cn',
    category: 'character',
    pool_type: 'E_CharacterGachaPoolType_Special',
    pool_id: 'special_1',
    pool_name: 'Pool',
    item_id: 'item',
    item_name: 'Item',
    rarity: 3,
    is_new: false,
    is_free: false,
    weapon_type: null,
    gacha_ts: 1_000,
    seq_id: '1',
    pool_order: 1,
    fetched_at: 1,
    ...overrides,
  };
}

describe('record ordering', () => {
  it('uses the official pool order when records share a timestamp', () => {
    const first = record({ record_uid: 'first', seq_id: '900', pool_order: 1 });
    const second = record({ record_uid: 'second', seq_id: '100', pool_order: 2 });

    expect([second, first].sort(compareRecordsChronologically)).toEqual([first, second]);
    expect([first, second].sort(compareRecordsNewestFirst)).toEqual([second, first]);
  });

  it('preserves JSON record array order when assigning imported pool orders', () => {
    const newest = record({ record_uid: 'newest', seq_id: '900', pool_order: 0 });
    const oldest = record({ record_uid: 'oldest', seq_id: '100', pool_order: 0 });

    expect(assignImportedPoolOrders([newest, oldest])).toMatchObject([
      { record_uid: 'oldest', pool_order: 1 },
      { record_uid: 'newest', pool_order: 2 },
    ]);
  });

  it('uses timestamp and sequence ID only as a CSV fallback', () => {
    const newest = record({ record_uid: 'newest', seq_id: '900', pool_order: 0 });
    const oldest = record({ record_uid: 'oldest', seq_id: '100', pool_order: 0 });

    expect(assignFallbackPoolOrders([newest, oldest])).toMatchObject([
      { record_uid: 'oldest', pool_order: 1 },
      { record_uid: 'newest', pool_order: 2 },
    ]);
  });
});
