import { describe, expect, it } from 'vitest';
import type { GachaRecord } from '@/domain/types';
import {
  exportRecordsToCsv,
  exportRecordsToJson,
  importRecordsFromCsv,
  importRecordsFromJson,
} from '@/modules/import-export/records';

const sampleRecord: GachaRecord = {
  record_uid: 'r-1',
  account_id: 'acc-1',
  region: 'cn',
  category: 'weapon',
  pool_type: 'special_weapon',
  pool_id: 'weapon-1',
  pool_name: 'Forged Horizon Arsenal',
  item_id: 'wpn-1',
  item_name: 'Pharos, Prototype',
  rarity: 6,
  is_new: true,
  is_free: false,
  weapon_type: 'rifle',
  gacha_ts: 123,
  seq_id: '2001',
  fetched_at: 456,
};

describe('record import/export', () => {
  it('round-trips json and removes duplicates', () => {
    const payload = exportRecordsToJson([sampleRecord, { ...sampleRecord, record_uid: 'r-2' }]);
    const result = importRecordsFromJson(payload);
    expect(result).toHaveLength(1);
    expect(result[0].item_name).toBe(sampleRecord.item_name);
  });

  it('round-trips csv with escaping', () => {
    const payload = exportRecordsToCsv([sampleRecord]);
    const result = importRecordsFromCsv(payload);
    expect(result).toEqual([sampleRecord]);
  });

  it('rejects invalid rarity values', () => {
    expect(() => importRecordsFromJson(JSON.stringify([{ ...sampleRecord, rarity: 2 }]))).toThrow('Invalid rarity');
  });
});
