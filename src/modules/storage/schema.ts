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
    pool_order INTEGER NOT NULL DEFAULT 0,
    fetched_at INTEGER NOT NULL,
    UNIQUE(account_id, category, seq_id)
  )
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
  ALTER TABLE gacha_records ADD COLUMN pool_order INTEGER NOT NULL DEFAULT 0
  `,
  `
  UPDATE gacha_records AS current
  SET pool_order = (
    SELECT COUNT(*) + 1
    FROM gacha_records AS earlier
    WHERE earlier.account_id = current.account_id
      AND earlier.category = current.category
      AND earlier.pool_id = current.pool_id
      AND (
        earlier.gacha_ts < current.gacha_ts
        OR (earlier.gacha_ts = current.gacha_ts AND earlier.seq_id < current.seq_id)
      )
  )
  WHERE current.pool_order = 0
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_gacha_records_account_pool_order
  ON gacha_records(account_id, category, pool_id, pool_order DESC)
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_gacha_records_account_category_pool
  ON gacha_records(account_id, category, pool_id)
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_gacha_records_pool_order
  ON gacha_records(category, pool_id, pool_order DESC)
  `,
  `
  CREATE TABLE IF NOT EXISTS preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )
  `,
];
