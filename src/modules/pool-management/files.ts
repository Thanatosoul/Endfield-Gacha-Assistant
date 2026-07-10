import { invoke } from '@tauri-apps/api/core';
import type { GachaCategory, PoolMetadata } from '@/domain/types';
import { getAssetUrl, isTauriRuntime } from '@/lib/runtime';
import { parsePoolJson, type ParsedPoolJson } from '@/modules/metadata/poolJson';

interface PoolJsonFile {
  pool_ID: string;
  pool_name: string;
  up6_name: string;
  up6_item_id?: string;
}

function toPoolJson(pool: PoolMetadata): PoolJsonFile {
  return {
    pool_ID: pool.pool_id,
    pool_name: pool.pool_name,
    up6_name: pool.up6_name,
  };
}

function withVersion(url: string, version: number): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${version}`;
}

// ─── Pool JSON ────────────────────────────────────────────────────

export async function readPoolJsonMerged(poolId: string): Promise<ParsedPoolJson | null> {
  if (isTauriRuntime()) {
    try {
      const content = await invoke<string>('pool_read_json', { poolId });
      const raw = JSON.parse(content) as unknown;
      return parsePoolJson(raw);
    } catch {
      // no-op, fallback to static
    }
  }

  return null;
}

export async function ensurePoolScaffold(pool: PoolMetadata): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const exists = await invoke<boolean>('pool_json_exists', { poolId: pool.pool_id });
    if (!exists) {
      await invoke('pool_write_json', {
        poolId: pool.pool_id,
        content: JSON.stringify(toPoolJson(pool), null, 2),
      });
    }
  } catch {
    // no-op
  }
}

export async function savePoolJson(pool: PoolMetadata): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('pool_write_json', {
    poolId: pool.pool_id,
    content: JSON.stringify(toPoolJson(pool), null, 2),
  });
}

// ─── Pool images ──────────────────────────────────────────────────

export async function getPoolImageCandidates(
  poolId: string,
  _category: GachaCategory,
  _up6ItemId: string | undefined,
  version: number,
): Promise<{ background: string[]; avatar: string[] }> {
  const background: string[] = [
    withVersion(getAssetUrl(`images/banner/${_category === 'weapon' ? 'weapon' : 'char'}/${poolId}.png`), version),
  ];
  const avatar: string[] = [];

  if (_up6ItemId) {
    const folder = _category === 'weapon' ? 'weapon' : 'character';
    avatar.push(withVersion(getAssetUrl(`/source/${folder}/${_up6ItemId}.png`), version));
    avatar.push(withVersion(getAssetUrl(`/source/${folder}/${_up6ItemId}.webp`), version));
  }

  return { background, avatar };
}
