import { describe, expect, it } from 'vitest';
import type { GachaCategory, GachaRecord, PoolKind, PoolMetadata } from '@/domain/types';
import {
  computeLimitedCharacterPity,
  computeRerunCharacterPity,
  computeRerunWeaponPity,
  groupWeaponClaims,
  isLimitedCharacterPool,
  isRerunCharacterPool,
  isRerunWeaponPool,
} from './banner-rules';

function meta(
  poolId: string,
  kind: PoolKind,
  category: GachaCategory,
  up6Name = 'UP6',
): PoolMetadata {
  return {
    pool_id: poolId,
    category,
    pool_type: kind,
    pool_kind: kind,
    pool_name: poolId,
    up6_name: up6Name,
    up5_names: [],
    items: [],
    valid_from: 0,
    valid_to: 0,
    version: 'test',
  };
}

let uid = 0;
function record(overrides: Partial<GachaRecord> & { pool_id: string }): GachaRecord {
  uid += 1;
  return {
    record_uid: `r${uid}`,
    account_id: 'a1',
    region: 'cn',
    category: 'character',
    pool_type: 'special',
    pool_name: overrides.pool_id,
    item_id: 'item',
    item_name: 'Item',
    rarity: 3,
    is_new: true,
    is_free: false,
    weapon_type: null,
    gacha_ts: uid,
    seq_id: String(uid),
    pool_order: uid,
    fetched_at: 0,
    ...overrides,
  };
}

function index(...entries: PoolMetadata[]): Map<string, PoolMetadata> {
  return new Map(entries.map((entry) => [entry.pool_id, entry]));
}

const limited = (poolId: string, up6 = 'UP6') => meta(poolId, 'special', 'character', up6);

describe('pool classification', () => {
  it('treats only special character pools as limited', () => {
    const metadata = index(
      limited('special_1'),
      meta('joint_1', 'joint', 'character'),
      meta('standard', 'standard', 'character'),
      meta('beginner', 'beginner', 'character'),
      meta('rerun_chr_1', 'rerun', 'character'),
    );
    expect(isLimitedCharacterPool(record({ pool_id: 'special_1' }), metadata)).toBe(true);
    expect(isLimitedCharacterPool(record({ pool_id: 'joint_1' }), metadata)).toBe(false);
    expect(isLimitedCharacterPool(record({ pool_id: 'standard' }), metadata)).toBe(false);
    expect(isLimitedCharacterPool(record({ pool_id: 'beginner' }), metadata)).toBe(false);
    expect(isLimitedCharacterPool(record({ pool_id: 'rerun_chr_1' }), metadata)).toBe(false);
  });

  it('detects rerun weapon pools without static pool_kind', () => {
    const metadata = index(meta('rerun_wpn_1', 'weapon', 'weapon', 'Art Tyrant'));
    const weapon = record({ pool_id: 'rerun_wpn_1', category: 'weapon' });
    expect(isRerunWeaponPool(weapon, metadata)).toBe(true);
    expect(isLimitedCharacterPool(weapon, metadata)).toBe(false);
    expect(isRerunCharacterPool(weapon, metadata)).toBe(false);
  });
});

describe('limited character pity', () => {
  it('carries the 80-pull six-star pity across limited banners', () => {
    const metadata = index(limited('special_1'), limited('special_2'));
    const records = [
      ...Array.from({ length: 79 }, (_, i) => record({ pool_id: 'special_1', gacha_ts: i })),
      record({ pool_id: 'special_2', gacha_ts: 1_000 }),
    ];
    const result = computeLimitedCharacterPity(records, metadata);
    expect(result.poolId).toBe('special_2');
    expect(result.sixStarPity).toBe(80);
    expect(result.sixStarRemaining).toBe(0);
    expect(result.upPity).toBe(1);
  });

  it('ignores free pulls for both guarantees and the token count', () => {
    const metadata = index(limited('special_1'));
    const records = [
      record({ pool_id: 'special_1', gacha_ts: 1 }),
      record({ pool_id: 'special_1', gacha_ts: 2, is_free: true }),
      record({ pool_id: 'special_1', gacha_ts: 3, is_free: true }),
      record({ pool_id: 'special_1', gacha_ts: 4 }),
    ];
    const result = computeLimitedCharacterPity(records, metadata);
    expect(result.sixStarPity).toBe(2);
    expect(result.upPity).toBe(2);
    expect(result.tokenPulls).toBe(2);
  });

  it('resets the 120-pull UP pity only on a UP six-star', () => {
    const metadata = index(limited('special_1', 'Perlica'));
    const records = [
      ...Array.from({ length: 119 }, (_, i) => record({ pool_id: 'special_1', gacha_ts: i })),
      record({ pool_id: 'special_1', gacha_ts: 200, rarity: 6, item_name: 'Off Banner' }),
    ];
    const before = computeLimitedCharacterPity(records, metadata);
    expect(before.upPity).toBe(120);
    expect(before.upRemaining).toBe(0);

    const after = computeLimitedCharacterPity(
      [...records, record({ pool_id: 'special_1', gacha_ts: 300, rarity: 6, item_name: 'Perlica' })],
      metadata,
    );
    expect(after.upPity).toBe(0);
    expect(after.upRemaining).toBe(120);
  });

  it('counts the 240-pull token reward per banner', () => {
    const metadata = index(limited('special_1'), limited('special_2'));
    const records = [
      ...Array.from({ length: 240 }, (_, i) => record({ pool_id: 'special_1', gacha_ts: i })),
      record({ pool_id: 'special_2', gacha_ts: 1_000 }),
    ];
    const result = computeLimitedCharacterPity(records, metadata);
    expect(result.tokenPulls).toBe(1);
    expect(result.tokensEarned).toBe(0);
  });

  it('awards a token for every 240 pulls within the current banner', () => {
    const metadata = index(limited('special_1'));
    const records = Array.from({ length: 481 }, (_, i) =>
      record({ pool_id: 'special_1', rarity: i % 80 === 0 ? 6 : 3, gacha_ts: i }),
    );
    const result = computeLimitedCharacterPity(records, metadata);
    expect(result.tokensEarned).toBe(2);
    expect(result.tokenProgress).toBe(1);
  });
});

describe('rerun character pity', () => {
  it('carries the one-time 120-pull UP guarantee across reruns of the same character', () => {
    const metadata = index(
      meta('rerun_chr_1', 'rerun', 'character', 'Yvonne'),
      meta('rerun_chr_2', 'rerun', 'character', 'Yvonne'),
    );
    const records = [
      ...Array.from({ length: 119 }, (_, i) => record({ pool_id: 'rerun_chr_1', gacha_ts: i })),
      record({ pool_id: 'rerun_chr_2', gacha_ts: 1_000 }),
    ];
    const before = computeRerunCharacterPity(records, metadata);
    expect(before.upName).toBe('Yvonne');
    expect(before.upPity).toBe(120);
    expect(before.upGuaranteeConsumed).toBe(false);

    const after = computeRerunCharacterPity(
      [...records, record({ pool_id: 'rerun_chr_2', gacha_ts: 2_000, rarity: 6, item_name: 'Yvonne' })],
      metadata,
    );
    expect(after.upGuaranteeConsumed).toBe(true);
    expect(after.upPity).toBe(0);
    expect(after.upRemaining).toBe(0);
  });

  it('does not accumulate across different rerun characters', () => {
    const metadata = index(
      meta('rerun_chr_yvonne', 'rerun', 'character', 'Yvonne'),
      meta('rerun_chr_other', 'rerun', 'character', 'Zhuang'),
    );
    const records = [
      ...Array.from({ length: 239 }, (_, i) => record({ pool_id: 'rerun_chr_yvonne', gacha_ts: i })),
      record({ pool_id: 'rerun_chr_other', gacha_ts: 10_000 }),
    ];
    const result = computeRerunCharacterPity(records, metadata);
    expect(result.upName).toBe('Zhuang');
    expect(result.poolId).toBe('rerun_chr_other');
    expect(result.upPity).toBe(1);
    expect(result.tokenPulls).toBe(1);
  });

  it('carries the 240-pull token count across reruns of the same character', () => {
    const metadata = index(
      meta('rerun_chr_1', 'rerun', 'character', 'Yvonne'),
      meta('rerun_chr_2', 'rerun', 'character', 'Yvonne'),
    );
    const records = [
      ...Array.from({ length: 200 }, (_, i) => record({ pool_id: 'rerun_chr_1', gacha_ts: i })),
      ...Array.from({ length: 40 }, (_, i) => record({ pool_id: 'rerun_chr_2', gacha_ts: 1_000 + i })),
    ];
    const result = computeRerunCharacterPity(records, metadata);
    expect(result.tokenPulls).toBe(240);
    expect(result.tokensEarned).toBe(1);
    expect(result.tokenProgress).toBe(0);
  });
});

function weaponClaim(poolId: string, ts: number, rarity: GachaRecord['rarity'], count = 10): GachaRecord[] {
  return Array.from({ length: count }, () =>
    record({ pool_id: poolId, category: 'weapon', pool_type: 'rerun', gacha_ts: ts, rarity }),
  );
}

describe('rerun weapon pity', () => {
  it('guarantees a six-star on the 4th consecutive non-six-star claim (per banner)', () => {
    const metadata = index(meta('rerun_wpn_1', 'weapon', 'weapon', 'Art Tyrant'));
    const claims = [
      ...weaponClaim('rerun_wpn_1', 1, 3),
      ...weaponClaim('rerun_wpn_1', 2, 4),
      ...weaponClaim('rerun_wpn_1', 3, 3),
    ];
    const before = computeRerunWeaponPity(claims, metadata);
    expect(before.claimCount).toBe(3);
    expect(before.sixStarClaimPity).toBe(3);
    expect(before.sixStarClaimRemaining).toBe(1);

    const after = computeRerunWeaponPity([...claims, ...weaponClaim('rerun_wpn_1', 4, 6)], metadata);
    expect(after.sixStarClaimPity).toBe(0);
    expect(after.sixStarClaimRemaining).toBe(4);
  });

  it('carries the one-time 8th-claim UP guarantee across rerun weapon banners', () => {
    const metadata = index(
      meta('rerun_wpn_1', 'weapon', 'weapon', 'Art Tyrant'),
      meta('rerun_wpn_2', 'weapon', 'weapon', 'Art Tyrant'),
    );
    const claims = [
      ...weaponClaim('rerun_wpn_1', 1, 3),
      ...weaponClaim('rerun_wpn_1', 2, 6),
      ...weaponClaim('rerun_wpn_1', 3, 3),
      ...weaponClaim('rerun_wpn_1', 4, 4),
      ...weaponClaim('rerun_wpn_2', 5, 3),
      ...weaponClaim('rerun_wpn_2', 6, 5),
      ...weaponClaim('rerun_wpn_2', 7, 3),
    ];
    const before = computeRerunWeaponPity(claims, metadata);
    expect(before.upClaimPity).toBe(7);
    expect(before.upGuaranteeConsumed).toBe(false);
    expect(before.upClaimRemaining).toBe(1);

    const upClaim = weaponClaim('rerun_wpn_2', 8, 6).map((r) => ({ ...r, item_name: 'Art Tyrant' }));
    const after = computeRerunWeaponPity([...claims, ...upClaim], metadata);
    expect(after.upGuaranteeConsumed).toBe(true);
    expect(after.upClaimPity).toBe(0);
    expect(after.upClaimRemaining).toBe(0);
  });

  it('groups records sharing a pool and timestamp into a single claim', () => {
    const claims = groupWeaponClaims([
      ...weaponClaim('rerun_wpn_1', 1, 3, 10),
      ...weaponClaim('rerun_wpn_1', 2, 3, 10),
      ...weaponClaim('rerun_wpn_2', 3, 3, 10),
    ]);
    expect(claims).toHaveLength(3);
    expect(claims[0]).toHaveLength(10);
  });
});
