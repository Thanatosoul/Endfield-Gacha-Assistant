import type { PoolMetadata } from '@/domain/types';
import { getDatabase } from '@/modules/storage/database';

function safeJsonParse(raw: string, fallback: unknown): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function parseRow(row: {
  pool_id: string;
  category: string;
  pool_type: string;
  pool_name: string;
  up6_name: string;
  up5_names_json: string;
  items_json: string;
  valid_from: number;
  valid_to: number;
  version: string;
}): PoolMetadata {
  return {
    pool_id: row.pool_id,
    category: row.category as 'character' | 'weapon',
    pool_type: row.pool_type,
    pool_name: row.pool_name,
    up6_name: row.up6_name,
    up5_names: safeJsonParse(row.up5_names_json, []) as string[],
    items: safeJsonParse(row.items_json, []) as PoolMetadata['items'],
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    version: row.version,
  };
}

export async function getAllPoolMetadata(): Promise<PoolMetadata[]> {
  const db = await getDatabase();
  const rows = await db.select<Array<{
    pool_id: string;
    category: string;
    pool_type: string;
    pool_name: string;
    up6_name: string;
    up5_names_json: string;
    items_json: string;
    valid_from: number;
    valid_to: number;
    version: string;
  }>>(
    'SELECT pool_id, category, pool_type, pool_name, up6_name, up5_names_json, items_json, valid_from, valid_to, version FROM metadata ORDER BY valid_from DESC',
    [],
  );

  return rows.map(parseRow);
}

export async function getPoolMetadata(poolId: string): Promise<PoolMetadata | null> {
  const db = await getDatabase();
  const rows = await db.select<Array<{
    pool_id: string;
    category: string;
    pool_type: string;
    pool_name: string;
    up6_name: string;
    up5_names_json: string;
    items_json: string;
    valid_from: number;
    valid_to: number;
    version: string;
  }>>(
    'SELECT pool_id, category, pool_type, pool_name, up6_name, up5_names_json, items_json, valid_from, valid_to, version FROM metadata WHERE pool_id = ?',
    [poolId],
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return parseRow(row);
}

export async function upsertPoolMetadata(metadata: PoolMetadata): Promise<void> {
  const db = await getDatabase();

  await db.execute(
    `INSERT INTO metadata (
      pool_id, category, pool_type, pool_name, up6_name,
      up5_names_json, items_json, image_refs, valid_from, valid_to, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    [
      metadata.pool_id,
      metadata.category,
      metadata.pool_type,
      metadata.pool_name,
      metadata.up6_name,
      JSON.stringify(metadata.up5_names),
      JSON.stringify(metadata.items),
      '',
      metadata.valid_from,
      metadata.valid_to,
      metadata.version,
    ],
  );
}

export async function deletePoolMetadata(poolId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM metadata WHERE pool_id = ?', [poolId]);
}
