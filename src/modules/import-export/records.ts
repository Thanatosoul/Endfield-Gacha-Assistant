import type { GachaCategory, GachaRarity, GachaRecord, Region } from '@/domain/types';
import { dedupeRecords } from '@/modules/storage/normalize';

const CSV_HEADERS: Array<keyof GachaRecord> = [
  'record_uid',
  'account_id',
  'region',
  'category',
  'pool_type',
  'pool_id',
  'pool_name',
  'item_id',
  'item_name',
  'rarity',
  'is_new',
  'is_free',
  'weapon_type',
  'gacha_ts',
  'seq_id',
  'fetched_at',
];

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === ',' && !quoted) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function asRegion(value: unknown): Region {
  if (value === 'cn' || value === 'global') {
    return value;
  }

  throw new Error(`Invalid region: ${String(value)}`);
}

function asCategory(value: unknown): GachaCategory {
  if (value === 'character' || value === 'weapon') {
    return value;
  }

  throw new Error(`Invalid category: ${String(value)}`);
}

function asRarity(value: unknown): GachaRarity {
  const rarity = Number(value);
  if (rarity === 3 || rarity === 4 || rarity === 5 || rarity === 6) {
    return rarity;
  }

  throw new Error(`Invalid rarity: ${String(value)}`);
}

function asBoolean(value: unknown): boolean {
  if (value === true || value === 'true' || value === 1 || value === '1') {
    return true;
  }

  if (value === false || value === 'false' || value === 0 || value === '0' || value === '') {
    return false;
  }

  throw new Error(`Invalid boolean value: ${String(value)}`);
}

function asRequiredString(value: unknown, field: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  throw new Error(`Missing ${field}`);
}

function asTimestamp(value: unknown, field: string): number {
  const timestamp = Number(value);
  if (Number.isFinite(timestamp)) {
    return timestamp;
  }

  throw new Error(`Invalid ${field}`);
}

export function validateRecord(input: unknown): GachaRecord {
  if (!input || typeof input !== 'object') {
    throw new Error('Record must be an object');
  }

  const candidate = input as Record<string, unknown>;

  return {
    record_uid: asRequiredString(candidate.record_uid, 'record_uid'),
    account_id: asRequiredString(candidate.account_id, 'account_id'),
    region: asRegion(candidate.region),
    category: asCategory(candidate.category),
    pool_type: asRequiredString(candidate.pool_type, 'pool_type'),
    pool_id: asRequiredString(candidate.pool_id, 'pool_id'),
    pool_name: asRequiredString(candidate.pool_name, 'pool_name'),
    item_id: asRequiredString(candidate.item_id, 'item_id'),
    item_name: asRequiredString(candidate.item_name, 'item_name'),
    rarity: asRarity(candidate.rarity),
    is_new: asBoolean(candidate.is_new),
    is_free: asBoolean(candidate.is_free),
    weapon_type: typeof candidate.weapon_type === 'string' && candidate.weapon_type.length > 0 ? candidate.weapon_type : null,
    gacha_ts: asTimestamp(candidate.gacha_ts, 'gacha_ts'),
    seq_id: asRequiredString(candidate.seq_id, 'seq_id'),
    fetched_at: asTimestamp(candidate.fetched_at, 'fetched_at'),
  };
}

export function exportRecordsToJson(records: GachaRecord[]): string {
  return JSON.stringify(records, null, 2);
}

export function importRecordsFromJson(payload: string): GachaRecord[] {
  const parsed = JSON.parse(payload) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('JSON payload must be an array');
  }

  return dedupeRecords(parsed.map(validateRecord));
}

export function exportRecordsToCsv(records: GachaRecord[]): string {
  const lines = [CSV_HEADERS.join(',')];

  for (const record of records) {
    lines.push(
      CSV_HEADERS.map((header) => {
        const value = record[header];
        if (value === null) {
          return '';
        }

        return escapeCsvValue(String(value));
      }).join(','),
    );
  }

  return lines.join('\n');
}

export function importRecordsFromCsv(payload: string): GachaRecord[] {
  const lines = payload.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  const records = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const candidate: Record<string, unknown> = {};

    headers.forEach((header, index) => {
      candidate[header] = values[index] ?? '';
    });

    return validateRecord(candidate);
  });

  return dedupeRecords(records);
}
