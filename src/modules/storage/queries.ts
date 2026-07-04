import Database from '@tauri-apps/plugin-sql';
import type { AppPreference, GameAccount, GachaRecord, PoolMetadata, SyncLogEntry } from '@/domain/types';
import { getDatabase } from '@/modules/storage/database';

async function resolveDatabase(database?: Database): Promise<Database> {
  return database ?? getDatabase();
}

export async function listAccounts(database?: Database): Promise<GameAccount[]> {
  const db = await resolveDatabase(database);
  return db.select<GameAccount[]>('SELECT * FROM game_accounts ORDER BY updated_at DESC, created_at DESC');
}

export async function getAccountById(accountId: string, database?: Database): Promise<GameAccount | null> {
  const db = await resolveDatabase(database);
  const rows = await db.select<GameAccount[]>('SELECT * FROM game_accounts WHERE id = ? LIMIT 1', [accountId]);
  return rows[0] ?? null;
}

export async function listRecordsByAccount(accountId?: string, database?: Database): Promise<GachaRecord[]> {
  const db = await resolveDatabase(database);
  if (accountId) {
    return db.select<GachaRecord[]>(
      'SELECT * FROM gacha_records WHERE account_id = ? ORDER BY gacha_ts DESC, seq_id DESC',
      [accountId],
    );
  }

  return db.select<GachaRecord[]>('SELECT * FROM gacha_records ORDER BY gacha_ts DESC, seq_id DESC');
}

export async function getExistingSeqIds(accountId: string, category: GachaRecord['category'], database?: Database): Promise<Set<string>> {
  const db = await resolveDatabase(database);
  const rows = await db.select<Array<{ seq_id: string }>>(
    'SELECT seq_id FROM gacha_records WHERE account_id = ? AND category = ?',
    [accountId, category],
  );

  return new Set(rows.map((row: { seq_id: string }) => row.seq_id));
}

export async function getExistingCharacterSeqIdsByPool(
  accountId: string,
  database?: Database,
): Promise<Record<string, Set<string>>> {
  const db = await resolveDatabase(database);
  const rows = await db.select<Array<{ pool_type: string; seq_id: string }>>(
    'SELECT pool_type, seq_id FROM gacha_records WHERE account_id = ? AND category = ?',
    [accountId, 'character'],
  );

  const result: Record<string, Set<string>> = {};
  for (const row of rows) {
    if (!result[row.pool_type]) {
      result[row.pool_type] = new Set<string>();
    }
    result[row.pool_type]?.add(row.seq_id);
  }

  return result;
}

export async function listMetadata(database?: Database): Promise<PoolMetadata[]> {
  const db = await resolveDatabase(database);
  const rows = await db.select<Array<{
    pool_id: string;
    category: PoolMetadata['category'];
    pool_type: string;
    pool_name: string;
    up6_name: string;
    up5_names_json: string;
    items_json: string;
    valid_from: number;
    valid_to: number;
    version: string;
  }>>('SELECT pool_id, category, pool_type, pool_name, up6_name, up5_names_json, items_json, valid_from, valid_to, version FROM metadata ORDER BY valid_from DESC, pool_id DESC');

  return rows.map((row) => ({
    pool_id: row.pool_id,
    category: row.category,
    pool_type: row.pool_type,
    pool_name: row.pool_name,
    up6_name: row.up6_name,
    up5_names: JSON.parse(row.up5_names_json) as string[],
    items: JSON.parse(row.items_json) as PoolMetadata['items'],
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    version: row.version,
  }));
}

export async function listPreferences(database?: Database): Promise<AppPreference[]> {
  const db = await resolveDatabase(database);
  return db.select<AppPreference[]>('SELECT * FROM preferences ORDER BY updated_at DESC');
}

export async function getPreference(key: string, database?: Database): Promise<AppPreference | null> {
  const db = await resolveDatabase(database);
  const rows = await db.select<AppPreference[]>('SELECT * FROM preferences WHERE key = ? LIMIT 1', [key]);
  return rows[0] ?? null;
}

export async function listSyncLogs(database?: Database): Promise<SyncLogEntry[]> {
  const db = await resolveDatabase(database);
  return db.select<SyncLogEntry[]>('SELECT * FROM sync_logs ORDER BY started_at DESC');
}
