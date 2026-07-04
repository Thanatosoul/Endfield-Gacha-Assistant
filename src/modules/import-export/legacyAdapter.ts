/**
 * Adapter that converts legacy EndfieldGachaHelper JSON exports to the new
 * unified data model used by Endfield Gacha Assistant.
 *
 * Legacy schema (schemaVersion: 2):
 *   - accounts[]: { uid, hgUid, channelName, addedAt, provider, serverId, roleId, roles[] }
 *   - records[]: character records (camelCase)
 *   - weaponRecords[]: weapon records (camelCase)
 *
 * New schema:
 *   - game_accounts: { id, region, uid, hg_uid, nickname, channel, created_at, updated_at }
 *   - gacha_records:  unified (snake_case), category distinguishes character vs weapon
 */

import type { GameAccount, GachaRecord, GachaRarity } from '@/domain/types';

// ───────── Legacy type stubs ─────────

interface LegacyRole {
  roleId: string;
  nickName?: string;
  serverId?: string;
  serverName?: string;
}

interface LegacyAccount {
  uid: string;           // "serverId:roleId" or legacy hgUid
  hgUid?: string;
  channelName?: string;
  addedAt?: number;
  provider?: string;     // "hypergryph" | "gryphline"
  serverId?: string;
  roleId?: string;
  roles?: LegacyRole[];
}

interface LegacyCharRecord {
  uid: string;           // account uid ("1:1640319142")
  recordUid: string;
  fetchedAt: number;
  category?: string;
  poolId: string;
  poolName: string;
  charId: string;
  charName: string;
  rarity: number;
  isNew: boolean;
  isFree: boolean;
  gachaTs: string | number;
  seqId: string;
}

interface LegacyWeaponRecord {
  uid: string;
  recordUid: string;
  fetchedAt: number;
  category?: string;
  poolId: string;
  poolName: string;
  weaponId: string;
  weaponName: string;
  weaponType: string;
  rarity: number;
  isNew: boolean;
  gachaTs: string | number;
  seqId: string;
}

export interface LegacySnapshot {
  schemaVersion?: number;
  exportedAt?: number;
  accounts?: LegacyAccount[];
  records?: LegacyCharRecord[];
  weaponRecords?: LegacyWeaponRecord[];
}

// ───────── Detection ─────────

export function isLegacySnapshot(raw: unknown): raw is LegacySnapshot {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Record<string, unknown>;

  // The new snapshot has a top-level "version" string, the legacy has "schemaVersion" number.
  // Also, legacy has "weaponRecords" as a separate array.
  const hasLegacyMarker =
    ('schemaVersion' in obj && typeof obj.schemaVersion === 'number') ||
    ('weaponRecords' in obj && Array.isArray(obj.weaponRecords));

  return hasLegacyMarker;
}

// ───────── Helpers ─────────

function toGachaTs(raw: string | number): number {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  // Values in the 1.7 × 10^12 range are milliseconds; convert to seconds for the new model.
  return n > 1_000_000_000_000 ? Math.floor(n / 1000) : n;
}

function clampRarity(n: number): GachaRarity {
  if (n === 3 || n === 4 || n === 5 || n === 6) return n;
  return 4;
}

function deriveRegion(): 'cn' | 'global' {
  return 'cn';
}

function extractRoleId(account: LegacyAccount): string {
  // Prefer explicit roleId field, then parse from "serverId:roleId" uid.
  if (account.roleId) return account.roleId;
  const parts = account.uid.split(':');
  return parts[1] ?? account.uid;
}

function deriveNickname(account: LegacyAccount): string {
  const firstRole = account.roles?.[0];
  if (firstRole?.nickName) return firstRole.nickName;
  return extractRoleId(account);
}

// ───────── Account conversion ─────────

function adaptAccount(legacy: LegacyAccount): GameAccount {
  const now = legacy.addedAt ?? Date.now();
  const region = deriveRegion();

  // The new model uses the legacy uid directly as the account id (keeps "1:1640319142" key intact).
  return {
    id: legacy.uid,
    region,
    uid: extractRoleId(legacy),
    hg_uid: legacy.hgUid ?? extractRoleId(legacy),
    nickname: deriveNickname(legacy),
    channel: legacy.channelName ?? '',
    created_at: now,
    updated_at: now,
  };
}

// ───────── Record conversion ─────────

function adaptCharRecord(legacy: LegacyCharRecord, account: GameAccount): GachaRecord {
  const poolId = legacy.poolId.toLowerCase();
  let poolType: string;
  if (poolId.startsWith('special')) {
    poolType = 'E_CharacterGachaPoolType_Special';
  } else if (poolId.startsWith('beginner')) {
    poolType = 'E_CharacterGachaPoolType_Beginner';
  } else {
    poolType = 'E_CharacterGachaPoolType_Standard';
  }

  return {
    record_uid: legacy.recordUid,
    account_id: account.id,
    region: account.region,
    category: 'character',
    pool_type: poolType,
    pool_id: legacy.poolId,
    pool_name: legacy.poolName,
    item_id: legacy.charId,
    item_name: legacy.charName,
    rarity: clampRarity(legacy.rarity),
    is_new: Boolean(legacy.isNew),
    is_free: Boolean(legacy.isFree),
    weapon_type: null,
    gacha_ts: toGachaTs(legacy.gachaTs),
    seq_id: legacy.seqId,
    fetched_at: legacy.fetchedAt,
  };
}

function adaptWeaponRecord(legacy: LegacyWeaponRecord, account: GameAccount): GachaRecord {
  const poolId = legacy.poolId.toLowerCase();
  // Legacy uses "weponbox" (typo) or "weaponbox" prefixes.
  const poolType = poolId.startsWith('weaponbox_constant')
    ? 'E_WeaponGachaPoolType_Standard'
    : 'E_WeaponGachaPoolType_All';

  return {
    record_uid: legacy.recordUid,
    account_id: account.id,
    region: account.region,
    category: 'weapon',
    pool_type: poolType,
    pool_id: legacy.poolId,
    pool_name: legacy.poolName,
    item_id: legacy.weaponId,
    item_name: legacy.weaponName,
    rarity: clampRarity(legacy.rarity),
    is_new: Boolean(legacy.isNew),
    is_free: false,
    weapon_type: legacy.weaponType,
    gacha_ts: toGachaTs(legacy.gachaTs),
    seq_id: legacy.seqId,
    fetched_at: legacy.fetchedAt,
  };
}

// ───────── Main adapter ─────────

export interface AdaptedSnapshot {
  accounts: GameAccount[];
  records: GachaRecord[];
}

export function adaptLegacySnapshot(legacy: LegacySnapshot): AdaptedSnapshot {
  // Build a uid → GameAccount map for record linking.
  const accountMap = new Map<string, GameAccount>();
  for (const legacyAccount of legacy.accounts ?? []) {
    const account = adaptAccount(legacyAccount);
    accountMap.set(legacyAccount.uid, account);
  }

  const records: GachaRecord[] = [];

  // Convert character records.
  for (const legacyRecord of legacy.records ?? []) {
    const account = accountMap.get(legacyRecord.uid);
    if (!account) {
      // Create a minimal placeholder account if not found.
      const placeholder: GameAccount = {
        id: legacyRecord.uid,
        region: 'cn',
        uid: legacyRecord.uid.split(':')[1] ?? legacyRecord.uid,
        hg_uid: legacyRecord.uid,
        nickname: legacyRecord.uid,
        channel: '',
        created_at: legacyRecord.fetchedAt,
        updated_at: legacyRecord.fetchedAt,
      };
      accountMap.set(legacyRecord.uid, placeholder);
      records.push(adaptCharRecord(legacyRecord, placeholder));
    } else {
      records.push(adaptCharRecord(legacyRecord, account));
    }
  }

  // Convert weapon records.
  for (const legacyRecord of legacy.weaponRecords ?? []) {
    const account = accountMap.get(legacyRecord.uid);
    if (!account) {
      const placeholder: GameAccount = {
        id: legacyRecord.uid,
        region: 'cn',
        uid: legacyRecord.uid.split(':')[1] ?? legacyRecord.uid,
        hg_uid: legacyRecord.uid,
        nickname: legacyRecord.uid,
        channel: '',
        created_at: legacyRecord.fetchedAt,
        updated_at: legacyRecord.fetchedAt,
      };
      accountMap.set(legacyRecord.uid, placeholder);
      records.push(adaptWeaponRecord(legacyRecord, placeholder));
    } else {
      records.push(adaptWeaponRecord(legacyRecord, account));
    }
  }

  return {
    accounts: [...accountMap.values()],
    records,
  };
}
