import type { GachaRecord } from '@/domain/types';

function compareSequenceIds(left: string, right: string): number {
  const leftValue = Number(left);
  const rightValue = Number(right);
  if (Number.isSafeInteger(leftValue) && Number.isSafeInteger(rightValue) && leftValue !== rightValue) {
    return leftValue - rightValue;
  }
  return left.localeCompare(right);
}

export function isSamePool(left: GachaRecord, right: GachaRecord): boolean {
  return left.account_id === right.account_id
    && left.category === right.category
    && left.pool_id === right.pool_id;
}

export function compareRecordsChronologically(left: GachaRecord, right: GachaRecord): number {
  if (isSamePool(left, right) && left.pool_order !== right.pool_order) {
    return left.pool_order - right.pool_order;
  }
  if (left.gacha_ts !== right.gacha_ts) return left.gacha_ts - right.gacha_ts;
  return compareSequenceIds(left.seq_id, right.seq_id);
}

export function compareRecordsNewestFirst(left: GachaRecord, right: GachaRecord): number {
  return compareRecordsChronologically(right, left);
}

export function assignImportedPoolOrders(records: GachaRecord[]): GachaRecord[] {
  const grouped = new Map<string, GachaRecord[]>();
  for (const record of records) {
    const key = `${record.account_id}\u0000${record.category}\u0000${record.pool_id}`;
    const poolRecords = grouped.get(key);
    if (poolRecords) poolRecords.push(record);
    else grouped.set(key, [record]);
  }

  return [...grouped.values()].flatMap((poolRecords) => {
    if (poolRecords.every((record) => record.pool_order > 0)) return poolRecords;
    // Full JSON snapshots retain their record array order, newest first, from the source API.
    return [...poolRecords].reverse().map((record, index) => ({ ...record, pool_order: index + 1 }));
  });
}

export function assignFallbackPoolOrders(records: GachaRecord[]): GachaRecord[] {
  const grouped = new Map<string, GachaRecord[]>();
  for (const record of records) {
    const key = `${record.account_id}\u0000${record.category}\u0000${record.pool_id}`;
    const poolRecords = grouped.get(key);
    if (poolRecords) poolRecords.push(record);
    else grouped.set(key, [record]);
  }

  return [...grouped.values()].flatMap((poolRecords) =>
    [...poolRecords]
      .sort((left, right) => {
        if (left.gacha_ts !== right.gacha_ts) return left.gacha_ts - right.gacha_ts;
        return compareSequenceIds(left.seq_id, right.seq_id);
      })
      .map((record, index) => ({ ...record, pool_order: index + 1 })),
  );
}
