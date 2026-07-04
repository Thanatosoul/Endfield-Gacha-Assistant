import type { GachaRecord, GameAccount } from '@/domain/types';
import type { OfficialCharacterRecord, OfficialWeaponRecord } from '@/modules/official-api/types';

export function mapOfficialCharacterRecord(account: GameAccount, record: OfficialCharacterRecord): GachaRecord {
  const lowerPoolId = record.poolId.toLowerCase();
  return {
    record_uid: `${account.id}_character_${record.seqId}`,
    account_id: account.id,
    region: account.region,
    category: 'character',
    pool_type: lowerPoolId.startsWith('special')
      ? 'E_CharacterGachaPoolType_Special'
      : lowerPoolId.startsWith('beginner')
        ? 'E_CharacterGachaPoolType_Beginner'
        : 'E_CharacterGachaPoolType_Standard',
    pool_id: record.poolId,
    pool_name: record.poolName,
    item_id: record.charId,
    item_name: record.charName,
    rarity: Math.max(3, Math.min(6, record.rarity)) as GachaRecord['rarity'],
    is_new: record.isNew,
    is_free: record.isFree,
    weapon_type: null,
    gacha_ts: Number(record.gachaTs),
    seq_id: record.seqId,
    fetched_at: Date.now(),
  };
}

export function mapOfficialWeaponRecord(account: GameAccount, record: OfficialWeaponRecord): GachaRecord {
  return {
    record_uid: `${account.id}_weapon_${record.seqId}`,
    account_id: account.id,
    region: account.region,
    category: 'weapon',
    pool_type: 'E_WeaponGachaPoolType_All',
    pool_id: record.poolId,
    pool_name: record.poolName,
    item_id: record.weaponId,
    item_name: record.weaponName,
    rarity: Math.max(3, Math.min(6, record.rarity)) as GachaRecord['rarity'],
    is_new: record.isNew,
    is_free: false,
    weapon_type: record.weaponType,
    gacha_ts: Number(record.gachaTs),
    seq_id: record.seqId,
    fetched_at: Date.now(),
  };
}
