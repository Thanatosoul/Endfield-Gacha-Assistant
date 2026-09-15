import { getDatabase } from '@/modules/storage/database';
import { decryptPreference, isEncrypted } from '@/modules/storage/crypto';
import { listAccounts, listMetadata, listPreferences, listRecordsByAccount } from '@/modules/storage/queries';
import {
  saveMetadataSnapshot,
  savePreference,
  saveSecurePreference,
  upsertGameAccount,
  upsertGachaRecords,
} from '@/modules/storage/repositories';
import { assignImportedPoolOrders } from '@/modules/storage/record-order';
import { BACKUP_VERSION } from '@/modules/backup/types';
import type { BackupPayload, BackupPreference, BackupRestoreResult } from '@/modules/backup/types';

/**
 * Build a portable snapshot of all local data. Secure preferences (tokens, WebDAV
 * credentials) are decrypted so the backup can be restored on another machine,
 * where they are re-encrypted with the target machine's key.
 */
export async function buildBackupPayload(): Promise<BackupPayload> {
  const [accounts, records, metadata, preferences] = await Promise.all([
    listAccounts(),
    listRecordsByAccount(),
    listMetadata(),
    listPreferences(),
  ]);

  const portablePreferences: BackupPreference[] = [];
  for (const entry of preferences) {
    const secure = isEncrypted(entry.value);
    const value = secure ? await decryptPreference(entry.value) : entry.value;
    portablePreferences.push({ key: entry.key, value, secure, updated_at: entry.updated_at });
  }

  return {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    accounts,
    records,
    metadata,
    preferences: portablePreferences,
  };
}

/** Merge a decoded backup payload into the local database. */
export async function applyBackupPayload(payload: BackupPayload): Promise<BackupRestoreResult> {
  const db = await getDatabase();

  for (const account of payload.accounts ?? []) {
    await upsertGameAccount(account, db);
  }

  if (Array.isArray(payload.records) && payload.records.length > 0) {
    await upsertGachaRecords(assignImportedPoolOrders(payload.records), db);
  }

  if (Array.isArray(payload.metadata) && payload.metadata.length > 0) {
    await saveMetadataSnapshot(payload.metadata, db);
  }

  for (const preference of payload.preferences ?? []) {
    if (preference.secure) {
      if (!preference.value) continue;
      await saveSecurePreference(preference.key, preference.value, db);
    } else {
      await savePreference(preference.key, preference.value, db);
    }
  }

  return {
    accounts: payload.accounts?.length ?? 0,
    records: payload.records?.length ?? 0,
    metadata: payload.metadata?.length ?? 0,
    preferences: payload.preferences?.length ?? 0,
  };
}
