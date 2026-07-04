import { describe, expect, it } from 'vitest';
import type { GachaRecord, PoolMetadata } from '@/domain/types';
import { calculateCurrentPity, judgeIsUp, summarizeRecords } from '@/modules/stats-engine/summary';

const metadata: PoolMetadata = {
  pool_id: 'special_launch_001',
  category: 'character',
  pool_type: 'special_character',
  pool_name: 'Vectors of Origination',
  up6_name: 'Perlica',
  up5_names: ['Yvonne'],
  items: [],
  valid_from: 0,
  valid_to: 1,
  version: '0.1.0',
};

function record(overrides: Partial<GachaRecord>): GachaRecord {
  return {
    record_uid: overrides.record_uid ?? Math.random().toString(),
    account_id: 'acc-1',
    region: 'cn',
    category: 'character',
    pool_type: 'special_character',
    pool_id: 'special_launch_001',
    pool_name: 'Vectors of Origination',
    item_id: 'item',
    item_name: 'Item',
    rarity: 3,
    is_new: false,
    is_free: false,
    weapon_type: null,
    gacha_ts: 0,
    seq_id: overrides.seq_id ?? Math.random().toString(),
    fetched_at: 0,
    ...overrides,
  };
}

describe('stats summary', () => {
  it('excludes free pulls from current pity', () => {
    const records = [
      record({ record_uid: 'a', seq_id: '1', rarity: 3, gacha_ts: 50, is_free: false }),
      record({ record_uid: 'b', seq_id: '2', rarity: 4, gacha_ts: 40, is_free: false }),
      record({ record_uid: 'c', seq_id: '3', rarity: 3, gacha_ts: 30, is_free: true }),
      record({ record_uid: 'd', seq_id: '4', rarity: 6, gacha_ts: 20, item_name: 'Perlica' }),
      record({ record_uid: 'e', seq_id: '5', rarity: 3, gacha_ts: 10, is_free: false }),
    ];

    expect(calculateCurrentPity(records)).toBe(2);
  });

  it('judges up results from metadata', () => {
    expect(judgeIsUp(record({ rarity: 6, item_name: 'Perlica' }), metadata)).toBe(true);
    expect(judgeIsUp(record({ rarity: 6, item_name: 'Off Banner' }), metadata)).toBe(false);
    expect(judgeIsUp(record({ rarity: 5, item_name: 'Yvonne' }), metadata)).toBe(true);
  });

  it('summarizes six-star featured and off-banner counts', () => {
    const records = [
      record({ record_uid: 'a', seq_id: '1', rarity: 6, gacha_ts: 60, item_name: 'Perlica' }),
      record({ record_uid: 'b', seq_id: '2', rarity: 6, gacha_ts: 50, item_name: 'Off Banner' }),
      record({ record_uid: 'c', seq_id: '3', rarity: 5, gacha_ts: 40, item_name: 'Yvonne' }),
      record({ record_uid: 'd', seq_id: '4', rarity: 4, gacha_ts: 30 }),
    ];

    const summary = summarizeRecords(records, new Map([[metadata.pool_id, metadata]]));
    expect(summary.featuredSixStarHits).toBe(1);
    expect(summary.offBannerSixStarHits).toBe(1);
    expect(summary.latestSixStar?.item_name).toBe('Perlica');
  });
});
