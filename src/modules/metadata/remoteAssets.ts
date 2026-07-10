import type { GachaCategory, GachaRarity, PoolMetadata } from '@/domain/types';

export const ASSET_REPOSITORY_URL = 'https://raw.githubusercontent.com/Thanatosoul/Endfield-Gacha-Assets/master/public';
const INDEX_URL = `${ASSET_REPOSITORY_URL}/data/index.json`;
const POOL_TABLE_URL = `${ASSET_REPOSITORY_URL}/data/GachaPoolTable.json`;

interface RemoteIndex {
  version: string;
  updatedAt: string;
}

export interface ResourceSyncResult {
  metadata: PoolMetadata[];
  version: string;
  updatedAt: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asRarity(value: unknown): GachaRarity | null {
  return value === 3 || value === 4 || value === 5 || value === 6 ? value : null;
}

function parseIndex(value: unknown): RemoteIndex {
  const index = asRecord(value);
  const version = asString(index?.version);
  const updatedAt = asString(index?.updated_at);
  if (!version || !updatedAt) throw new Error('资源版本摘要格式无效。');
  return { version, updatedAt };
}

function parsePool(id: string, value: unknown, version: string): PoolMetadata | null {
  const pool = asRecord(value);
  const category: GachaCategory | null = pool?.pool_gacha_type === 'char'
    ? 'character'
    : pool?.pool_gacha_type === 'weapon' ? 'weapon' : null;
  const poolName = asString(pool?.pool_name);
  if (!category || !poolName) return null;

  const items = Array.isArray(pool?.all)
    ? pool.all.flatMap((value) => {
      const item = asRecord(value);
      const rarity = asRarity(item?.rarity);
      const itemId = asString(item?.id);
      const itemName = asString(item?.name);
      return rarity && itemId && itemName ? [{ item_id: itemId, item_name: itemName, rarity }] : [];
    })
    : [];
  const up5Names = asString(pool?.up5_name).split(/[,，]/).map((name) => name.trim()).filter(Boolean);

  return {
    pool_id: id,
    category,
    pool_type: asString(pool?.pool_type) || 'unknown',
    pool_name: poolName,
    up6_name: asString(pool?.up6_name),
    up5_names: up5Names,
    items,
    valid_from: 0,
    valid_to: 4102444800,
    version,
  };
}

export function parseRemotePoolTable(value: unknown, version: string): PoolMetadata[] {
  const table = asRecord(value);
  if (!table) throw new Error('卡池资源格式无效。');
  const metadata = Object.entries(table).flatMap(([id, pool]) => {
    const parsed = parsePool(id, pool, version);
    return parsed ? [parsed] : [];
  });
  if (metadata.length === 0) throw new Error('远端资源中没有有效卡池。');
  return metadata;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`获取资源失败 (${response.status})。`);
  return response.json();
}

export async function fetchRemoteAssets(): Promise<ResourceSyncResult> {
  const [rawIndex, rawTable] = await Promise.all([fetchJson(INDEX_URL), fetchJson(POOL_TABLE_URL)]);
  const index = parseIndex(rawIndex);
  return {
    metadata: parseRemotePoolTable(rawTable, index.version),
    version: index.version,
    updatedAt: index.updatedAt,
  };
}

export function getRemoteAssetUrl(relativePath: string): string {
  const normalized = relativePath.replace(/^\/+/, '');
  return `${ASSET_REPOSITORY_URL}/${normalized}`;
}
