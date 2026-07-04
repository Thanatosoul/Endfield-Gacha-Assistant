import Database from '@tauri-apps/plugin-sql';
import type { GameAccount, GachaRecord, PoolMetadata } from '@/domain/types';
import { getDatabase } from '@/modules/storage/database';
import { dedupeRecords } from '@/modules/storage/normalize';
import { encryptPreference, decryptPreference } from '@/modules/storage/crypto';

async function resolveDatabase(database?: Database): Promise<Database> {
  return database ?? getDatabase();
}

export async function upsertGameAccount(account: GameAccount, database?: Database): Promise<void> {
  const db = await resolveDatabase(database);
  await db.execute(
    `
    INSERT INTO game_accounts (id, region, uid, hg_uid, nickname, channel, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      region = excluded.region,
      uid = excluded.uid,
      hg_uid = excluded.hg_uid,
      nickname = excluded.nickname,
      channel = excluded.channel,
      updated_at = excluded.updated_at
    `,
    [
      account.id,
      account.region,
      account.uid,
      account.hg_uid,
      account.nickname,
      account.channel,
      account.created_at,
      account.updated_at,
    ],
  );
}

export async function upsertGachaRecords(records: GachaRecord[], database?: Database): Promise<number> {
  if (!Array.isArray(records)) return 0;
  const db = await resolveDatabase(database);
  const deduped = dedupeRecords(records);
  if (deduped.length === 0) return 0;

  const placeholders = deduped.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const params: unknown[] = [];
  for (const record of deduped) {
    params.push(
      record.record_uid,
      record.account_id,
      record.region,
      record.category,
      record.pool_type,
      record.pool_id,
      record.pool_name,
      record.item_id,
      record.item_name,
      record.rarity,
      Number(record.is_new),
      Number(record.is_free),
      record.weapon_type,
      record.gacha_ts,
      record.seq_id,
      record.fetched_at,
    );
  }

  const result = await db.execute(
    `INSERT OR IGNORE INTO gacha_records (
      record_uid, account_id, region, category, pool_type, pool_id, pool_name,
      item_id, item_name, rarity, is_new, is_free, weapon_type, gacha_ts, seq_id, fetched_at
    ) VALUES ${placeholders}`,
    params,
  );
  return result.rowsAffected;
}

export async function listGachaRecords(database?: Database): Promise<GachaRecord[]> {
  const db = await resolveDatabase(database);
  return db.select<GachaRecord[]>('SELECT * FROM gacha_records ORDER BY gacha_ts DESC, seq_id DESC');
}

export async function clearGachaRecordsByAccount(accountId: string, database?: Database): Promise<void> {
  const db = await resolveDatabase(database);
  await db.execute('DELETE FROM gacha_records WHERE account_id = ?', [accountId]);
}

export async function deleteAccountCascade(accountId: string, database?: Database): Promise<void> {
  const db = await resolveDatabase(database);
  await db.execute('DELETE FROM gacha_records WHERE account_id = ?', [accountId]);
  await db.execute('DELETE FROM sync_logs WHERE account_id = ?', [accountId]);
  await db.execute('DELETE FROM game_accounts WHERE id = ?', [accountId]);
}

export async function savePreference(key: string, value: string, database?: Database): Promise<void> {
  const db = await resolveDatabase(database);
  await db.execute(
    `
    INSERT INTO preferences (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
    `,
    [key, value, Date.now()],
  );
}

export async function saveSecurePreference(key: string, plaintext: string, database?: Database): Promise<void> {
  const encrypted = await encryptPreference(plaintext);
  await savePreference(key, encrypted, database);
}

export async function getSecurePreference(key: string, database?: Database): Promise<string | null> {
  const { getPreference } = await import('@/modules/storage/queries');
  const entry = await getPreference(key, database);
  if (!entry?.value) return null;
  return decryptPreference(entry.value);
}

export async function appendSyncLog(entry: {
  id: string;
  account_id: string;
  region: string;
  category: string;
  started_at: number;
  finished_at: number | null;
  status: string;
  message: string;
}, database?: Database): Promise<void> {
  const db = await resolveDatabase(database);
  await db.execute(
    `
    INSERT INTO sync_logs (id, account_id, region, category, started_at, finished_at, status, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      entry.id,
      entry.account_id,
      entry.region,
      entry.category,
      entry.started_at,
      entry.finished_at,
      entry.status,
      entry.message,
    ],
  );
}

export async function saveMetadataSnapshot(metadata: PoolMetadata[], database?: Database): Promise<void> {
  if (!Array.isArray(metadata) || metadata.length === 0) return;
  const db = await resolveDatabase(database);

  const placeholders = metadata.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const params: unknown[] = [];
  for (const entry of metadata) {
    params.push(
      entry.pool_id,
      entry.category,
      entry.pool_type,
      entry.pool_name,
      entry.up6_name,
      JSON.stringify(entry.up5_names),
      JSON.stringify(entry.items),
      '',
      entry.valid_from,
      entry.valid_to,
      entry.version,
    );
  }

  await db.execute(
    `INSERT INTO metadata (
      pool_id, category, pool_type, pool_name, up6_name,
      up5_names_json, items_json, image_refs, valid_from, valid_to, version
    ) VALUES ${placeholders}
    ON CONFLICT(pool_id) DO UPDATE SET
      category = excluded.category,
      pool_type = excluded.pool_type,
      pool_name = excluded.pool_name,
      up6_name = excluded.up6_name,
      up5_names_json = excluded.up5_names_json,
      items_json = excluded.items_json,
      image_refs = excluded.image_refs,
      valid_from = excluded.valid_from,
      valid_to = excluded.valid_to,
      version = excluded.version`,
    params,
  );
}
