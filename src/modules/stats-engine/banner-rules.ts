import type { GachaRecord, PoolMetadata } from '@/domain/types';
import { compareRecordsChronologically } from '@/modules/storage/record-order';
import { classifyPoolKind } from '@/modules/pool-management/poolKind';
import { judgeIsUp } from './summary';

export const LIMITED_SIX_STAR_PITY = 80;
export const LIMITED_UP_PITY = 120;
export const LIMITED_TOKEN_INTERVAL = 240;
export const RERUN_CHAR_UP_PITY = 120;
export const RERUN_CHAR_TOKEN_INTERVAL = 240;
export const RERUN_WEAPON_SIX_STAR_CLAIMS = 4;
export const RERUN_WEAPON_UP_CLAIMS = 8;

/** Read-only cumulative reward thresholds (counted in paid pulls, excluding free ten-pulls). */
export const LIMITED_REWARD_MILESTONES = [30, 60] as const;
export const RERUN_CHARACTER_REWARD_MILESTONES = [30, 60, 90] as const;

export const JOINT_SIX_STAR_PITY = 80;
export const JOINT_FIVE_STAR_PITY = 10;
export const JOINT_TOKEN_INTERVAL = 240;
/** Joint (联合) banner cumulative reward thresholds (paid pulls only). */
export const JOINT_REWARD_MILESTONES = [30, 60, 120, 240] as const;

export interface LimitedCharacterPity {
  poolId: string | null;
  sixStarPity: number;
  sixStarRemaining: number;
  upPity: number;
  upRemaining: number;
  tokenPulls: number;
  tokenProgress: number;
  tokensEarned: number;
}

export interface RerunCharacterPity {
  poolId: string | null;
  upName: string | null;
  upPity: number;
  upRemaining: number;
  upGuaranteeConsumed: boolean;
  tokenPulls: number;
  tokenProgress: number;
  tokensEarned: number;
}

export interface RerunWeaponPity {
  poolId: string | null;
  claimCount: number;
  sixStarClaimPity: number;
  sixStarClaimRemaining: number;
  upClaimPity: number;
  upClaimRemaining: number;
  upGuaranteeConsumed: boolean;
}

export interface JointCharacterPity {
  poolId: string | null;
  sixStarPity: number;
  sixStarRemaining: number;
  fiveStarPity: number;
  fiveStarRemaining: number;
  tokenPulls: number;
  tokenProgress: number;
  tokensEarned: number;
}

function poolKindOf(record: GachaRecord, metadata: Map<string, PoolMetadata>) {
  return metadata.get(record.pool_id)?.pool_kind ?? classifyPoolKind(record.pool_id, record.pool_type, record.category);
}

function isRerunName(poolId: string, poolType: string): boolean {
  const id = poolId.toLowerCase();
  const type = poolType.toLowerCase();
  return id.includes('rerun') || id.includes('reprint') || type.includes('rerun') || type.includes('reprint');
}

export function isLimitedCharacterPool(record: GachaRecord, metadata: Map<string, PoolMetadata>): boolean {
  if (record.category !== 'character') return false;
  return metadata.get(record.pool_id)?.pool_kind
    ? metadata.get(record.pool_id)?.pool_kind === 'special'
    : classifyPoolKind(record.pool_id, record.pool_type, record.category) === 'special';
}

export function isRerunCharacterPool(record: GachaRecord, metadata: Map<string, PoolMetadata>): boolean {
  if (record.category !== 'character') return false;
  return poolKindOf(record, metadata) === 'rerun';
}

export function isRerunWeaponPool(record: GachaRecord, metadata: Map<string, PoolMetadata>): boolean {
  if (record.category !== 'weapon') return false;
  if (metadata.get(record.pool_id)?.pool_kind === 'rerun') return true;
  if (isRerunName(record.pool_id, record.pool_type)) return true;
  return false;
}

/**
 * Limited character banners share one continuous 80-pull six-star pity, while the
 * 120-pull UP guarantee and the 240-pull token reward reset per banner.
 */
export function computeLimitedCharacterPity(
  records: GachaRecord[],
  metadata: Map<string, PoolMetadata>,
): LimitedCharacterPity {
  const list = records.filter((record) => isLimitedCharacterPool(record, metadata)).sort(compareRecordsChronologically);

  if (list.length === 0) {
    return {
      poolId: null,
      sixStarPity: 0,
      sixStarRemaining: LIMITED_SIX_STAR_PITY,
      upPity: 0,
      upRemaining: LIMITED_UP_PITY,
      tokenPulls: 0,
      tokenProgress: 0,
      tokensEarned: 0,
    };
  }

  const poolId = list[list.length - 1].pool_id;

  let sixStarPity = 0;
  for (const record of list) {
    if (record.is_free) continue;
    if (record.rarity === 6) sixStarPity = 0;
    else sixStarPity += 1;
  }

  let upPity = 0;
  let tokenPulls = 0;
  for (const record of list) {
    if (record.pool_id !== poolId || record.is_free) continue;
    tokenPulls += 1;
    if (record.rarity === 6 && judgeIsUp(record, metadata.get(poolId))) upPity = 0;
    else upPity += 1;
  }

  return {
    poolId,
    sixStarPity,
    sixStarRemaining: Math.max(0, LIMITED_SIX_STAR_PITY - sixStarPity),
    upPity,
    upRemaining: Math.max(0, LIMITED_UP_PITY - upPity),
    tokenPulls,
    tokenProgress: tokenPulls % LIMITED_TOKEN_INTERVAL,
    tokensEarned: Math.floor(tokenPulls / LIMITED_TOKEN_INTERVAL),
  };
}

export interface RerunCharacterSeriesPity extends RerunCharacterPity {
  seriesKey: string;
  poolIds: string[];
  latestTs: number;
}

const EMPTY_RERUN_CHARACTER_PITY: RerunCharacterPity = {
  poolId: null,
  upName: null,
  upPity: 0,
  upRemaining: RERUN_CHAR_UP_PITY,
  upGuaranteeConsumed: false,
  tokenPulls: 0,
  tokenProgress: 0,
  tokensEarned: 0,
};

function summarizeRerunSeries(series: GachaRecord[], metadata: Map<string, PoolMetadata>): RerunCharacterPity {
  const latest = series[series.length - 1];
  const poolId = latest.pool_id;
  const upName = metadata.get(poolId)?.up6_name?.trim() || null;

  let upPity = 0;
  let tokenPulls = 0;
  let upGuaranteeConsumed = false;
  for (const record of series) {
    if (record.is_free) continue;
    tokenPulls += 1;
    if (record.rarity === 6 && judgeIsUp(record, metadata.get(record.pool_id))) {
      upGuaranteeConsumed = true;
      upPity = 0;
    } else {
      upPity += 1;
    }
  }

  return {
    poolId,
    upName,
    upPity,
    upRemaining: upGuaranteeConsumed ? 0 : Math.max(0, RERUN_CHAR_UP_PITY - upPity),
    upGuaranteeConsumed,
    tokenPulls,
    tokenProgress: tokenPulls % RERUN_CHAR_TOKEN_INTERVAL,
    tokensEarned: Math.floor(tokenPulls / RERUN_CHAR_TOKEN_INTERVAL),
  };
}

/**
 * Rerun (重构寻访) character banners accumulate per UP character, not across
 * different rerun characters: pulls on Yvonne's rerun are frozen until Yvonne
 * is rerun again, and a different character's rerun starts from zero. The
 * one-time 120-pull UP guarantee and the 240-pull token reward are also per
 * character and carry over between that character's rerun banners.
 */
export function rerunCharacterSeriesKey(record: GachaRecord, metadata: Map<string, PoolMetadata>): string {
  const upName = metadata.get(record.pool_id)?.up6_name?.trim().toLowerCase();
  return upName ? `up:${upName}` : `pool:${record.pool_id}`;
}

export function computeRerunCharacterPitySeries(
  records: GachaRecord[],
  metadata: Map<string, PoolMetadata>,
): RerunCharacterSeriesPity[] {
  const list = records.filter((record) => isRerunCharacterPool(record, metadata)).sort(compareRecordsChronologically);

  const groups = new Map<string, GachaRecord[]>();
  for (const record of list) {
    const key = rerunCharacterSeriesKey(record, metadata);
    const group = groups.get(key);
    if (group) group.push(record);
    else groups.set(key, [record]);
  }

  const series: RerunCharacterSeriesPity[] = [];
  for (const [seriesKey, group] of groups) {
    const pity = summarizeRerunSeries(group, metadata);
    const latest = group[group.length - 1];
    series.push({
      ...pity,
      seriesKey,
      poolIds: [...new Set(group.map((record) => record.pool_id))],
      latestTs: latest.gacha_ts,
    });
  }

  return series.sort((a, b) => b.latestTs - a.latestTs);
}

export function computeRerunCharacterPity(
  records: GachaRecord[],
  metadata: Map<string, PoolMetadata>,
): RerunCharacterPity {
  const series = computeRerunCharacterPitySeries(records, metadata);
  return series[0] ?? EMPTY_RERUN_CHARACTER_PITY;
}

/**
 * Rerun weapon (点绘申领) banners group individual weapon records into claims.
 * A claim is a run of records that share the same pool and timestamp (one 申领
 * yields ten weapons). The 4th-claim six-star rule is per banner, while the
 * 8th-claim UP rule is once-permanent and carries across rerun weapon banners.
 */
export function groupWeaponClaims(records: GachaRecord[]): GachaRecord[][] {
  const sorted = [...records].sort(compareRecordsChronologically);
  const claims: GachaRecord[][] = [];
  let current: GachaRecord[] = [];
  let currentKey = '';

  for (const record of sorted) {
    const key = `${record.pool_id}#${record.gacha_ts}`;
    if (current.length === 0 || key === currentKey) {
      current.push(record);
      currentKey = key;
    } else {
      claims.push(current);
      current = [record];
      currentKey = key;
    }
  }
  if (current.length > 0) claims.push(current);
  return claims;
}

export function computeRerunWeaponPity(records: GachaRecord[], metadata: Map<string, PoolMetadata>): RerunWeaponPity {
  const list = records.filter((record) => isRerunWeaponPool(record, metadata));
  const claims = groupWeaponClaims(list);

  if (claims.length === 0) {
    return {
      poolId: null,
      claimCount: 0,
      sixStarClaimPity: 0,
      sixStarClaimRemaining: RERUN_WEAPON_SIX_STAR_CLAIMS,
      upClaimPity: 0,
      upClaimRemaining: RERUN_WEAPON_UP_CLAIMS,
      upGuaranteeConsumed: false,
    };
  }

  const poolId = claims[claims.length - 1][0].pool_id;

  let sixStarClaimPity = 0;
  for (const claim of claims) {
    if (claim[0].pool_id !== poolId) continue;
    if (claim.some((record) => record.rarity === 6)) sixStarClaimPity = 0;
    else sixStarClaimPity += 1;
  }

  let upClaimPity = 0;
  let upGuaranteeConsumed = false;
  for (const claim of claims) {
    const hasUp = claim.some((record) => record.rarity === 6 && judgeIsUp(record, metadata.get(claim[0].pool_id)));
    if (hasUp) {
      upGuaranteeConsumed = true;
      upClaimPity = 0;
    } else {
      upClaimPity += 1;
    }
  }

  return {
    poolId,
    claimCount: claims.length,
    sixStarClaimPity,
    sixStarClaimRemaining: Math.max(0, RERUN_WEAPON_SIX_STAR_CLAIMS - sixStarClaimPity),
    upClaimPity,
    upClaimRemaining: upGuaranteeConsumed ? 0 : Math.max(0, RERUN_WEAPON_UP_CLAIMS - upClaimPity),
    upGuaranteeConsumed,
  };
}

export function isJointCharacterPool(record: GachaRecord, metadata: Map<string, PoolMetadata>): boolean {
  if (record.category !== 'character') return false;
  return poolKindOf(record, metadata) === 'joint';
}

/**
 * Joint (联合) banners such as "辉光庆典" run an independent pity: at most 80 pulls for a
 * six-star and at most 10 pulls for a five-star or above, plus cumulative rewards at
 * 30 / 60 / 120 / 240 pulls. Counts are per banner; a six-star resets both pity tracks.
 */
export function computeJointCharacterPity(
  records: GachaRecord[],
  metadata: Map<string, PoolMetadata>,
): JointCharacterPity {
  const list = records.filter((record) => isJointCharacterPool(record, metadata)).sort(compareRecordsChronologically);

  if (list.length === 0) {
    return {
      poolId: null,
      sixStarPity: 0,
      sixStarRemaining: JOINT_SIX_STAR_PITY,
      fiveStarPity: 0,
      fiveStarRemaining: JOINT_FIVE_STAR_PITY,
      tokenPulls: 0,
      tokenProgress: 0,
      tokensEarned: 0,
    };
  }

  const poolId = list[list.length - 1].pool_id;

  let sixStarPity = 0;
  let fiveStarPity = 0;
  let tokenPulls = 0;
  for (const record of list) {
    if (record.pool_id !== poolId || record.is_free) continue;
    tokenPulls += 1;
    if (record.rarity === 6) {
      sixStarPity = 0;
      fiveStarPity = 0;
    } else {
      sixStarPity += 1;
      if (record.rarity >= 5) fiveStarPity = 0;
      else fiveStarPity += 1;
    }
  }

  return {
    poolId,
    sixStarPity,
    sixStarRemaining: Math.max(0, JOINT_SIX_STAR_PITY - sixStarPity),
    fiveStarPity,
    fiveStarRemaining: Math.max(0, JOINT_FIVE_STAR_PITY - fiveStarPity),
    tokenPulls,
    tokenProgress: tokenPulls % JOINT_TOKEN_INTERVAL,
    tokensEarned: Math.floor(tokenPulls / JOINT_TOKEN_INTERVAL),
  };
}
