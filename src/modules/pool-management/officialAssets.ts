import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import type { GachaCategory, PoolMetadata } from '@/domain/types';
import { isTauriRuntime } from '@/lib/runtime';
import { comparePoolIds } from '@/modules/stats-engine/summary';
import { savePreference } from '@/modules/storage/repositories';
import { listPreferences } from '@/modules/storage/queries';

export const OFFICIAL_CONTENT_URL = 'https://ef-webview.hypergryph.com/api/content';
const PREF_PREFIX = 'official.banner.';

const registry = new Map<string, string[]>();

/** Official banner image URLs captured for a pool, if probed this session or restored from cache. */
export function getOfficialBannerUrls(poolId: string): string[] {
  return registry.get(poolId) ?? [];
}

export function setOfficialBannerUrls(poolId: string, urls: string[]): void {
  registry.set(poolId, urls);
}

export function clearOfficialBannerCache(): void {
  registry.clear();
}

function collectImageUrls(pool: Record<string, unknown>): string[] {
  const urls = new Set<string>();
  const push = (value: unknown): void => {
    if (typeof value === 'string' && /^https?:\/\//.test(value)) urls.add(value);
  };
  push(pool.up6_image);
  push(pool.up6_banner);
  push(pool.up5_image);
  push(pool.rotate_image);
  const rotateList = pool.rotate_list;
  if (Array.isArray(rotateList)) {
    for (const entry of rotateList) {
      if (entry && typeof entry === 'object') push((entry as Record<string, unknown>).image);
    }
  }
  return [...urls];
}

async function fetchPoolImageUrls(poolId: string): Promise<string[]> {
  const url = `${OFFICIAL_CONTENT_URL}?pool_id=${encodeURIComponent(poolId)}&server_id=1&lang=zh-cn`;
  try {
    const doFetch = isTauriRuntime() ? tauriFetch : fetch;
    const response = await doFetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return [];
    const json = (await response.json()) as { code?: number; data?: { pool?: Record<string, unknown> } };
    if (json.code !== 0 || !json.data?.pool) return [];
    return collectImageUrls(json.data.pool);
  } catch {
    return [];
  }
}

async function cachePoolBanner(poolId: string): Promise<void> {
  const urls = await fetchPoolImageUrls(poolId);
  if (urls.length === 0) return;
  setOfficialBannerUrls(poolId, urls);
  try {
    await savePreference(`${PREF_PREFIX}${poolId}`, JSON.stringify(urls));
  } catch {
    // best-effort: caching the URL in memory is enough for this session
  }
}

function latestPoolsByCategory(pools: PoolMetadata[]): PoolMetadata[] {
  const latest = new Map<GachaCategory, PoolMetadata>();
  for (const pool of pools) {
    const current = latest.get(pool.category);
    if (!current || comparePoolIds(pool.pool_id, current.pool_id) > 0) latest.set(pool.category, pool);
  }
  return [...latest.values()];
}

/**
 * Probe the official content API for each category's newest banner and cache its
 * image URLs. The official API only keeps the latest banner, so this captures a
 * banner early while the asset mirror config may not have caught up yet.
 */
export async function probeOfficialBanners(pools: PoolMetadata[]): Promise<void> {
  await Promise.allSettled(latestPoolsByCategory(pools).map((pool) => cachePoolBanner(pool.pool_id)));
}

/**
 * Probe specific pool ids for official banner images. Used after a gacha sync so
 * the newest banner is cached before the asset mirror's cfg catches up — the
 * official content API only keeps the currently active pools.
 */
export async function probeOfficialBannersByPoolIds(poolIds: string[]): Promise<void> {
  const unique = [...new Set(poolIds.filter((poolId) => poolId.length > 0))];
  await Promise.allSettled(unique.map((poolId) => cachePoolBanner(poolId)));
}

/** Restore previously probed official banner URLs from preferences (best-effort). */
export async function loadCachedOfficialBanners(): Promise<void> {
  try {
    const prefs = await listPreferences();
    for (const pref of prefs) {
      if (!pref.key.startsWith(PREF_PREFIX)) continue;
      try {
        const parsed = JSON.parse(pref.value) as unknown;
        if (Array.isArray(parsed) && parsed.every((value) => typeof value === 'string')) {
          registry.set(pref.key.slice(PREF_PREFIX.length), parsed as string[]);
        }
      } catch {
        // ignore malformed cached entries
      }
    }
  } catch {
    // preferences are unavailable outside the desktop runtime
  }
}
