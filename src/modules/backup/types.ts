import type { GameAccount, GachaRecord, PoolMetadata } from '@/domain/types';

export const BACKUP_FORMAT = 'endfield-gacha-backup';
export const BACKUP_VERSION = 1;

export interface BackupPreference {
  key: string;
  /** Plaintext value. Secure entries are decrypted on export and re-encrypted on import. */
  value: string;
  /** Whether the value was encrypted at rest; determines whether it is re-encrypted on restore. */
  secure: boolean;
  updated_at: number;
}

export interface BackupPayload {
  version: number;
  exportedAt: number;
  appVersion?: string;
  accounts: GameAccount[];
  records: GachaRecord[];
  metadata: PoolMetadata[];
  preferences: BackupPreference[];
}

export interface BackupContainer {
  format: string;
  version: number;
  encrypted: boolean;
  /** Present only for unencrypted backups. */
  payload?: BackupPayload;
  /** PBKDF2 salt (hex) — present only for encrypted backups. */
  salt?: string;
  /** AES-CBC IV (hex) — present only for encrypted backups. */
  iv?: string;
  /** Base64 ciphertext — present only for encrypted backups. */
  data?: string;
}

export interface BackupRestoreResult {
  accounts: number;
  records: number;
  metadata: number;
  preferences: number;
}
