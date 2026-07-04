import type { GachaCategory, GachaRarity } from '@/domain/types';

export interface OfficialApiOptions {
  lang?: string;
  serverId?: string;
  signal?: AbortSignal;
}

export interface OfficialTokenGrantInput {
  userToken: string;
}

export interface BoundRole {
  roleId: string;
  nickName: string;
  level: number;
  serverId: string;
  serverName: string;
  isDefault: boolean;
  isBanned: boolean;
  registerTs: number;
}

export interface BoundAccount {
  uid: string;
  channelMasterId: number;
  channelName: string;
  isOfficial: boolean;
  isDefault: boolean;
  isDeleted: boolean;
  isBanned: boolean;
  registerTs: number;
  roles: BoundRole[];
}

export interface UserBindingsResponse {
  status: number;
  msg: string;
  data: {
    list: Array<{
      appCode: string;
      appName: string;
      supportMultiServer: boolean;
      bindingList: BoundAccount[];
    }>;
  };
}

export const CHARACTER_POOL_TYPES = [
  'E_CharacterGachaPoolType_Special',
  'E_CharacterGachaPoolType_Standard',
  'E_CharacterGachaPoolType_Beginner',
] as const;

export type CharacterPoolType = (typeof CHARACTER_POOL_TYPES)[number];
export type WeaponPoolType = 'E_WeaponGachaPoolType_All';

export interface OfficialCharacterRecord {
  charId: string;
  charName: string;
  gachaTs: string;
  isFree: boolean;
  isNew: boolean;
  poolId: string;
  poolName: string;
  rarity: number;
  seqId: string;
}

export interface OfficialWeaponRecord {
  weaponId: string;
  weaponName: string;
  weaponType: string;
  gachaTs: string;
  isNew: boolean;
  poolId: string;
  poolName: string;
  rarity: number;
  seqId: string;
}

export interface CharacterGachaResponse {
  code: number;
  msg: string;
  data: {
    list: OfficialCharacterRecord[];
    hasMore: boolean;
  };
}

export interface WeaponGachaResponse {
  code: number;
  msg: string;
  data: {
    list: OfficialWeaponRecord[];
    hasMore: boolean;
  };
}

export interface FetchCharacterPoolPageInput {
  u8Token: string;
  poolType: CharacterPoolType;
  seqId?: string;
}

export interface FetchWeaponPoolPageInput {
  u8Token: string;
  seqId?: string;
}

export interface FetchPoolPageResult<T> {
  list: T[];
  hasMore: boolean;
  nextSeqId?: string;
}

export interface SyncProgressEvent {
  category: GachaCategory;
  poolType: string;
  poolIndex: number;
  totalPools: number;
  recordsFetched: number;
}

export interface FetchAllGachaOptions extends OfficialApiOptions {
  minDelayMs?: number;
  maxDelayMs?: number;
  poolSwitchMinDelayMs?: number;
  poolSwitchMaxDelayMs?: number;
  categorySwitchDelayMs?: number;
  existingCharacterSeqIdsByPool?: Partial<Record<CharacterPoolType, Set<string>>>;
  existingWeaponSeqIds?: Set<string>;
  onProgress?: (event: SyncProgressEvent) => void;
}

export interface AllOfficialGachaRecords {
  character: Record<CharacterPoolType, OfficialCharacterRecord[]>;
  weapon: Record<WeaponPoolType, OfficialWeaponRecord[]>;
}

export interface OfficialRecordPayload {
  seq_id: string;
  ts: number;
  item_id: string;
  item_name: string;
  rarity: GachaRarity;
  is_new: boolean;
  is_free: boolean;
  pool_id: string;
  pool_name: string;
  pool_type: string;
  weapon_type?: string | null;
}
