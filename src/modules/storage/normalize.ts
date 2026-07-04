import type { GachaRecord } from '@/domain/types';

export function buildRecordKey(record: Pick<GachaRecord, 'account_id' | 'category' | 'seq_id'>): string {
  return `${record.account_id}::${record.category}::${record.seq_id}`;
}

export function dedupeRecords(records: GachaRecord[]): GachaRecord[] {
  const seen = new Set<string>();

  return records.filter((record) => {
    const key = buildRecordKey(record);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
