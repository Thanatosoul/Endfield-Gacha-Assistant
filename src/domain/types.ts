export type Region = 'cn' | 'global';
export type GachaCategory = 'character' | 'weapon';
export type GachaRarity = 3 | 4 | 5 | 6;

export interface GachaRecord {
  record_uid: string;
  account_id: string;
  region: Region;
  category: GachaCategory;
  pool_type: string;
  pool_id: string;
  pool_name: string;
  item_id: string;
  item_name: string;
  rarity: GachaRarity;
  is_new: boolean;
  is_free: boolean;
  weapon_type: string | null;
  gacha_ts: number;
  seq_id: string;
  fetched_at: number;
}

export interface GameAccount {
  id: string;
  region: Region;
  uid: string;
  hg_uid: string;
  nickname: string;
  channel: string;
  created_at: number;
  updated_at: number;
}

export interface PoolMetadata {
  pool_id: string;
  category: GachaCategory;
  pool_type: string;
  pool_name: string;
  up6_name: string;
  up5_names: string[];
  items: Array<{
    item_id: string;
    item_name: string;
    rarity: GachaRarity;
  }>;
  valid_from: number;
  valid_to: number;
  version: string;
}

export interface SyncLogEntry {
  id: string;
  account_id: string;
  region: Region;
  category: GachaCategory;
  started_at: number;
  finished_at: number | null;
  status: 'idle' | 'running' | 'completed' | 'cancelled' | 'failed';
  message: string;
}

export interface AppPreference {
  key: string;
  value: string;
  updated_at: number;
}
