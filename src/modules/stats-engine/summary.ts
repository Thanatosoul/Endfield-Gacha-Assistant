import type { GachaCategory, GachaRecord, PoolMetadata } from '@/domain/types';

export interface SummaryMetrics {
  totalPulls: number;
  paidPulls: number;
  rarityCounts: Record<3 | 4 | 5 | 6, number>;
  sixStarRate: number;
  fiveStarRate: number;
  latestSixStar: GachaRecord | null;
  latestUpSixStar: GachaRecord | null;
  latestCharSixStar: GachaRecord | null;
  latestWpnSixStar: GachaRecord | null;
  currentPity: number;
  currentPityWpn: number;
  featuredSixStarHits: number;
  offBannerSixStarHits: number;
  pitySinceLastUp: number;
}

export interface PityGapInfo {
  gap: number;
  record: GachaRecord;
}

export interface PoolSummary {
  poolId: string;
  poolName: string;
  category: GachaCategory;
  pulls: number;
  freePulls: number;
  sixStarHits: number;
  featuredSixStarHits: number;
  rarityCounts: Record<3 | 4 | 5 | 6, number>;
  /** Earliest gacha_ts seen in this pool, used for chronological ordering. */
  earliestTs: number;
}

/** Parse pool version numbers for sorting.
 *  Returns an array of numeric segments extracted from the pool ID.
 *  e.g. "special_1_3_1" → [1, 3, 1],  "standard" → [],  "weaponbox_constant_2" → [0, 2]
 */
function poolSortKey(poolId: string): number[] {
  const id = poolId.toLowerCase();
  // Permanent pools come first.
  if (id === 'standard') return [-2];
  if (id === 'beginner') return [-1];
  if (id.startsWith('weaponbox_constant') || id.startsWith('weponbox_constant')) {
    const n = parseInt(id.replace(/\D+/g, ''), 10);
    return [0, Number.isNaN(n) ? 0 : n];
  }
  // Extract all digit groups and use them as the sort key.
  const digits = id.match(/\d+/g)?.map(Number) ?? [];
  return digits;
}

function comparePoolIds(a: string, b: string): number {
  const ka = poolSortKey(a);
  const kb = poolSortKey(b);
  const len = Math.max(ka.length, kb.length);
  for (let i = 0; i < len; i++) {
    const va = ka[i] ?? 0;
    const vb = kb[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function judgeIsUp(record: GachaRecord, metadata?: PoolMetadata): boolean {
  if (!metadata) {
    return false;
  }

  const itemName = normalizeName(record.item_name);

  if (record.rarity === 6) {
    return Boolean(metadata.up6_name) && itemName === normalizeName(metadata.up6_name);
  }

  if (record.rarity === 5) {
    return metadata.up5_names.some((name) => itemName === normalizeName(name));
  }

  return false;
}

export function computePityGaps(records: GachaRecord[], category?: GachaCategory): PityGapInfo[] {
  if (!Array.isArray(records) || records.length === 0) return [];
  const filtered = category ? records.filter((r) => r.category === category) : records;

  // Group by pool_id — each pool tracks pity independently
  const byPool = new Map<string, GachaRecord[]>();
  for (const r of filtered) {
    const list = byPool.get(r.pool_id);
    if (list) list.push(r);
    else byPool.set(r.pool_id, [r]);
  }

  const gaps: PityGapInfo[] = [];
  for (const [, poolRecords] of byPool) {
    const sorted = [...poolRecords].sort((a, b) => a.gacha_ts - b.gacha_ts);
    let count = 0;
    for (const record of sorted) {
      if (!record.is_free) count++;
      if (record.rarity === 6 && !record.is_free) {
        gaps.push({ gap: count, record });
        count = 0;
      }
    }
  }

  // Sort by timestamp to maintain chronological order
  return gaps.sort((a, b) => a.record.gacha_ts - b.record.gacha_ts);
}

export function computePitySinceLastUp(
  records: GachaRecord[],
  metadata: Map<string, PoolMetadata>,
  category?: GachaCategory
): number {
  if (!Array.isArray(records) || records.length === 0) return 0;
  // Only count pools that have an up6_name (limited/featured banners);
  // standard/permanent pools have no UP, so their pulls don't contribute.
  const filtered = records.filter((r) => {
    if (category && r.category !== category) return false;
    const meta = metadata.get(r.pool_id);
    return Boolean(meta?.up6_name);
  });
  const sorted = [...filtered].sort((a, b) => b.gacha_ts - a.gacha_ts);
  let count = 0;
  for (const record of sorted) {
    // Any 6-star resets the UP guarantee: an off-banner triggers it,
    // a featured UP consumes it.
    if (record.rarity === 6 && !record.is_free) {
      break;
    }
    if (!record.is_free) {
      count++;
    }
  }
  return count;
}

export function calculateCurrentPity(records: GachaRecord[], category?: GachaCategory, preSorted = false): number {
  const filtered = records
    .filter((record) => !category || record.category === category);

  const ordered = preSorted ? filtered : [...filtered].sort((left, right) => right.gacha_ts - left.gacha_ts);

  let pity = 0;
  for (const record of ordered) {
    if (record.rarity === 6 && !record.is_free) {
      break;
    }

    if (!record.is_free) {
      pity += 1;
    }
  }

  return pity;
}

export function summarizeRecords(records: GachaRecord[], metadata: Map<string, PoolMetadata>): SummaryMetrics {
  if (!Array.isArray(records)) {
    return { totalPulls: 0, paidPulls: 0, rarityCounts: { 3: 0, 4: 0, 5: 0, 6: 0 }, sixStarRate: 0, fiveStarRate: 0, latestSixStar: null, latestUpSixStar: null, latestCharSixStar: null, latestWpnSixStar: null, currentPity: 0, currentPityWpn: 0, featuredSixStarHits: 0, offBannerSixStarHits: 0, pitySinceLastUp: 0 };
  }
  const ordered = [...records].sort((left, right) => right.gacha_ts - left.gacha_ts);

  let totalPulls = 0;
  let paidPulls = 0;
  let latestSixStar: GachaRecord | null = null;
  let latestUpSixStar: GachaRecord | null = null;
  let latestCharSixStar: GachaRecord | null = null;
  let latestWpnSixStar: GachaRecord | null = null;
  let sixStarCount = 0;
  let featuredSixStarHits = 0;
  const rarityCounts: SummaryMetrics['rarityCounts'] = { 3: 0, 4: 0, 5: 0, 6: 0 };

  for (const record of ordered) {
    totalPulls++;
    rarityCounts[record.rarity]++;
    if (!record.is_free) paidPulls++;
    if (record.rarity === 6) {
      sixStarCount++;
      if (!latestSixStar) latestSixStar = record;
      if (!latestCharSixStar && record.category === 'character') latestCharSixStar = record;
      if (!latestWpnSixStar && record.category === 'weapon') latestWpnSixStar = record;
      if (judgeIsUp(record, metadata.get(record.pool_id))) {
        featuredSixStarHits++;
        if (!latestUpSixStar && record.category === 'character') latestUpSixStar = record;
      }
    }
  }

  return {
    totalPulls,
    paidPulls,
    rarityCounts,
    sixStarRate: totalPulls === 0 ? 0 : sixStarCount / totalPulls,
    fiveStarRate: totalPulls === 0 ? 0 : rarityCounts[5] / totalPulls,
    latestSixStar,
    latestUpSixStar,
    latestCharSixStar,
    latestWpnSixStar,
    currentPity: calculateCurrentPity(ordered, 'character', true),
    currentPityWpn: calculateCurrentPity(ordered, 'weapon', true),
    featuredSixStarHits,
    offBannerSixStarHits: sixStarCount - featuredSixStarHits,
    pitySinceLastUp: computePitySinceLastUp(records, metadata, 'character'),
  };
}

export function summarizePools(records: GachaRecord[], metadata: Map<string, PoolMetadata>): PoolSummary[] {
  if (!Array.isArray(records)) return [];
  const groups = new Map<string, PoolSummary>();

  for (const record of records) {
    const entry = groups.get(record.pool_id) ?? {
      poolId: record.pool_id,
      poolName: record.pool_name,
      category: record.category,
      pulls: 0,
      freePulls: 0,
      sixStarHits: 0,
      featuredSixStarHits: 0,
      rarityCounts: { 3: 0, 4: 0, 5: 0, 6: 0 },
      earliestTs: record.gacha_ts,
    };

    entry.pulls += 1;
    entry.freePulls += Number(record.is_free);
    entry.sixStarHits += Number(record.rarity === 6);
    entry.featuredSixStarHits += Number(record.rarity === 6 && judgeIsUp(record, metadata.get(record.pool_id)));
    entry.rarityCounts[record.rarity]++;
    if (record.gacha_ts < entry.earliestTs) entry.earliestTs = record.gacha_ts;

    groups.set(record.pool_id, entry);
  }

  // Sort pools by pool ID version numbers (descending = latest first).
  return [...groups.values()].sort((a, b) => comparePoolIds(b.poolId, a.poolId));
}

/**
 * Returns the three featured pool summaries for the Statistics page:
 *  1. Standard character pool (常驻/基础寻访)
 *  2. Latest limited character pool (special_*)
 *  3. Latest limited weapon pool (weponbox_*)
 */
export function selectFeaturedPools(allPools: PoolSummary[]): PoolSummary[] {
  if (!Array.isArray(allPools)) return [];
  const charPools = allPools.filter((p) => p.category === 'character');
  const wpnPools  = allPools.filter((p) => p.category === 'weapon');

  const standard = charPools.find((p) => {
    const id = p.poolId.toLowerCase();
    return id === 'standard' || id.startsWith('standard');
  });

  const limitedChars = charPools.filter((p) => p.poolId.toLowerCase().startsWith('special'));
  const latestLimitedChar = limitedChars[limitedChars.length - 1];

  const limitedWpns = wpnPools.filter((p) => {
    const id = p.poolId.toLowerCase();
    return (id.startsWith('weponbox_1_') || id.startsWith('weaponbox_1_')) && !id.includes('constant');
  });
  const latestLimitedWpn = limitedWpns[limitedWpns.length - 1];

  return [standard, latestLimitedChar, latestLimitedWpn].filter((p): p is PoolSummary => Boolean(p));
}
