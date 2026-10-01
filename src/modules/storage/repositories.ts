import Database from '@tauri-apps/plugin-sql';
import type { GameAccount, GachaRecord, PoolMetadata } from '@/domain/types';
import { getDatabase } from '@/modules/storage/database';
import { dedupeRecords } from '@/modules/storage/normalize';
import { encryptPreference, decryptPreference, isLegacyEncrypted } from '@/modules/storage/crypto';

async function resolveDatabase(database?: Database): Promise<Database> {
  return database ?? getDatabase();
}

// Bulk writes bind the whole payload as a single JSON parameter and expand it
// with `json_each`. This keeps the statement atomic (no batching, no partial
// inserts) and sidesteps SQLITE_MAX_VARIABLE_NUMBER entirely.

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

  const poolOrders = await assignMissingPoolOrders(deduped, db);

  const payload = deduped.map((record) => ({
    record_uid: record.record_uid,
    account_id: record.account_id,
    region: record.region,
    category: record.category,
    pool_type: record.pool_type,
    pool_id: record.pool_id,
    pool_name: record.pool_name,
    item_id: record.item_id,
    item_name: record.item_name,
    rarity: record.rarity,
    is_new: record.is_new ? 1 : 0,
    is_free: record.is_free ? 1 : 0,
    weapon_type: record.weapon_type,
    gacha_ts: record.gacha_ts,
    seq_id: record.seq_id,
    pool_order: poolOrders.get(record.record_uid) ?? record.pool_order,
    fetched_at: record.fetched_at,
  }));

  const result = await db.execute(
    `INSERT OR IGNORE INTO gacha_records (
      record_uid, account_id, region, category, pool_type, pool_id, pool_name,
      item_id, item_name, rarity, is_new, is_free, weapon_type, gacha_ts, seq_id, pool_order, fetched_at
    )
    SELECT
      json_extract(value, '$.record_uid'),
      json_extract(value, '$.account_id'),
      json_extract(value, '$.region'),
      json_extract(value, '$.category'),
      json_extract(value, '$.pool_type'),
      json_extract(value, '$.pool_id'),
      json_extract(value, '$.pool_name'),
      json_extract(value, '$.item_id'),
      json_extract(value, '$.item_name'),
      json_extract(value, '$.rarity'),
      json_extract(value, '$.is_new'),
      json_extract(value, '$.is_free'),
      json_extract(value, '$.weapon_type'),
      json_extract(value, '$.gacha_ts'),
      json_extract(value, '$.seq_id'),
      json_extract(value, '$.pool_order'),
      json_extract(value, '$.fetched_at')
    FROM json_each(?)`,
    [JSON.stringify(payload)],
  );

  return result.rowsAffected;
}

async function assignMissingPoolOrders(records: GachaRecord[], db: Database): Promise<Map<string, number>> {
  const assigned = new Map<string, number>();
  const byPool = new Map<string, GachaRecord[]>();

  for (const record of records) {
    if (record.pool_order > 0) continue;
    const key = `${record.account_id}\u0000${record.category}\u0000${record.pool_id}`;
    const poolRecords = byPool.get(key);
    if (poolRecords) poolRecords.push(record);
    else byPool.set(key, [record]);
  }

  for (const poolRecords of byPool.values()) {
    const first = poolRecords[0];
    if (!first) continue;
    const rows = await db.select<Array<{ max_order: number | null }>>(
      'SELECT MAX(pool_order) AS max_order FROM gacha_records WHERE account_id = ? AND category = ? AND pool_id = ?',
      [first.account_id, first.category, first.pool_id],
    );
    const maxOrder = Number(rows[0]?.max_order ?? 0);

    // The official API lists newest records first; reverse so pool_order increases chronologically.
    for (let index = poolRecords.length - 1; index >= 0; index -= 1) {
      const record = poolRecords[index];
      if (record) assigned.set(record.record_uid, maxOrder + poolRecords.length - index);
    }
  }

  return assigned;
}

export async function deleteAccountCascade(accountId: string, database?: Database): Promise<void> {
  const db = await resolveDatabase(database);
  // The trg_game_accounts_cascade_delete trigger removes records and logs.
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

  const plaintext = await decryptPreference(entry.value);
  // Upgrade legacy CBC ciphertexts to authenticated AES-GCM opportunistically.
  if (plaintext && isLegacyEncrypted(entry.value)) {
    await saveSecurePreference(key, plaintext, database);
  }
  return plaintext;
}

export async function appendSyncLog(
  entry: {
    id: string;
    account_id: string;
    region: string;
    category: string;
    started_at: number;
    finished_at: number | null;
    status: string;
    message: string;
  },
  database?: Database,
): Promise<void> {
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

  const payload = metadata.map((entry) => ({
    pool_id: entry.pool_id,
    category: entry.category,
    pool_type: entry.pool_type,
    pool_kind: entry.pool_kind ?? null,
    pool_name: entry.pool_name,
    up6_name: entry.up6_name,
    up5_names_json: JSON.stringify(entry.up5_names),
    items_json: JSON.stringify(entry.items),
    valid_from: entry.valid_from,
    valid_to: entry.valid_to,
    version: entry.version,
  }));

  await db.execute(
    `INSERT INTO metadata (
      pool_id, category, pool_type, pool_kind, pool_name, up6_name,
      up5_names_json, items_json, image_refs, valid_from, valid_to, version
    )
    SELECT
      json_extract(value, '$.pool_id'),
      json_extract(value, '$.category'),
      json_extract(value, '$.pool_type'),
      json_extract(value, '$.pool_kind'),
      json_extract(value, '$.pool_name'),
      json_extract(value, '$.up6_name'),
      json_extract(value, '$.up5_names_json'),
      json_extract(value, '$.items_json'),
      '',
      json_extract(value, '$.valid_from'),
      json_extract(value, '$.valid_to'),
      json_extract(value, '$.version')
    FROM json_each(?)
    ON CONFLICT(pool_id) DO UPDATE SET
      category = excluded.category,
      pool_type = excluded.pool_type,
      pool_kind = excluded.pool_kind,
      pool_name = excluded.pool_name,
      up6_name = excluded.up6_name,
      up5_names_json = excluded.up5_names_json,
      items_json = excluded.items_json,
      image_refs = excluded.image_refs,
      valid_from = excluded.valid_from,
      valid_to = excluded.valid_to,
      version = excluded.version`,
    [JSON.stringify(payload)],
  );
}
