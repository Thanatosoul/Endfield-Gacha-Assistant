export const STORAGE_SCHEMA = [
  `
  CREATE TABLE IF NOT EXISTS game_accounts (
    id TEXT PRIMARY KEY,
    region TEXT NOT NULL,
    uid TEXT NOT NULL,
    hg_uid TEXT NOT NULL,
    nickname TEXT NOT NULL,
    channel TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(region, uid)
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS gacha_records (
    record_uid TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    region TEXT NOT NULL,
    category TEXT NOT NULL,
    pool_type TEXT NOT NULL,
    pool_id TEXT NOT NULL,
    pool_name TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    rarity INTEGER NOT NULL,
    is_new INTEGER NOT NULL,
    is_free INTEGER NOT NULL,
    weapon_type TEXT,
    gacha_ts INTEGER NOT NULL,
    seq_id TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    UNIQUE(account_id, category, seq_id)
  )
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_gacha_records_account_ts
  ON gacha_records(account_id, gacha_ts DESC)
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_gacha_records_account_cat_ts
  ON gacha_records(account_id, category, gacha_ts DESC)
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_gacha_records_ts_seq
  ON gacha_records(gacha_ts DESC, seq_id DESC)
  `,
  `
  CREATE TABLE IF NOT EXISTS metadata (
    pool_id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    pool_type TEXT NOT NULL,
    pool_name TEXT NOT NULL,
    up6_name TEXT NOT NULL,
    up5_names_json TEXT NOT NULL,
    items_json TEXT NOT NULL,
    image_refs TEXT NOT NULL DEFAULT '',
    valid_from INTEGER NOT NULL,
    valid_to INTEGER NOT NULL,
    version TEXT NOT NULL,
    data_version INTEGER NOT NULL DEFAULT 0
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS sync_logs (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    region TEXT NOT NULL,
    category TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    status TEXT NOT NULL,
    message TEXT NOT NULL
  )
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_sync_logs_account
  ON sync_logs(account_id)
  `,
  `
  ALTER TABLE metadata ADD COLUMN data_version INTEGER NOT NULL DEFAULT 0
  `,
  `
  CREATE TABLE IF NOT EXISTS preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )
  `,
];
