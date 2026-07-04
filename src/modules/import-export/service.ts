import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import type { ExportSnapshot, TokenSnapshot } from '@/modules/storage/snapshot';
import { exportRecordsToCsv, importRecordsFromCsv } from '@/modules/import-export/records';
import { adaptLegacySnapshot, isLegacySnapshot } from '@/modules/import-export/legacyAdapter';
import { isTauriRuntime } from '@/lib/runtime';
import { listAccounts, listMetadata, listRecordsByAccount } from '@/modules/storage/queries';
import { getDatabase } from '@/modules/storage/database';
import { upsertGameAccount, upsertGachaRecords, saveMetadataSnapshot, saveSecurePreference } from '@/modules/storage/repositories';
import { dedupeRecords } from '@/modules/storage/normalize';

function withBom(text: string): string {
  return `\uFEFF${text}`;
}

export async function buildExportSnapshot(): Promise<ExportSnapshot> {
  const [records, metadata] = await Promise.all([
    listRecordsByAccount(),
    listMetadata(),
  ]);
  return {
    version: '0.1.0',
    exportedAt: Date.now(),
    records,
    metadata,
  };
}

export async function buildFullExportSnapshot(): Promise<ExportSnapshot> {
  const [accounts, records, metadata] = await Promise.all([
    listAccounts(),
    listRecordsByAccount(),
    listMetadata(),
  ]);

  // Collect tokens
  const tokens: TokenSnapshot = { appToken: null, sklandToken: null, checkInTokens: {} };
  try {
    const { getSecurePreference } = await import('@/modules/storage/repositories');
    tokens.appToken = await getSecurePreference('auth.appToken');
    tokens.sklandToken = await getSecurePreference('skland.token');

    const hgUids = [...new Set(accounts.map((a) => a.hg_uid))];
    await Promise.all(hgUids.map(async (hgUid) => {
      const tokenKey = `checkin.token.${hgUid}`;
      const t = await getSecurePreference(tokenKey);
      if (t) tokens.checkInTokens[hgUid] = t;
    }));
  } catch {
    // tokens are best-effort
  }

  return {
    version: '0.2.0',
    exportedAt: Date.now(),
    accounts,
    records,
    metadata,
    tokens,
  };
}

export async function exportSnapshotToJsonFile(): Promise<string | null> {
  if (!isTauriRuntime()) {
    throw new Error('File export is only available in Tauri runtime.');
  }

  const filePath = await save({
    defaultPath: `endfield-gacha-assistant-records-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });

  if (!filePath) {
    return null;
  }

  const snapshot = await buildExportSnapshot();
  await writeTextFile(filePath, JSON.stringify(snapshot, null, 2));
  return filePath;
}

export async function exportFullJsonToFile(): Promise<string | null> {
  if (!isTauriRuntime()) {
    throw new Error('File export is only available in Tauri runtime.');
  }

  const filePath = await save({
    defaultPath: `endfield-gacha-assistant-full-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });

  if (!filePath) {
    return null;
  }

  const snapshot = await buildFullExportSnapshot();
  await writeTextFile(filePath, JSON.stringify(snapshot, null, 2));
  return filePath;
}

export async function importSnapshotFromJsonFile(): Promise<{
  accounts: number;
  records: number;
  fromLegacy: boolean;
}> {
  if (!isTauriRuntime()) {
    throw new Error('File import is only available in Tauri runtime.');
  }

  const filePath = await open({
    multiple: false,
    filters: [{ name: 'JSON', extensions: ['json', 'endfieldgacha.json'] }],
  });

  if (!filePath || Array.isArray(filePath)) {
    return { accounts: 0, records: 0, fromLegacy: false };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await readTextFile(filePath));
  } catch {
    return { accounts: 0, records: 0, fromLegacy: false };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { accounts: 0, records: 0, fromLegacy: false };
  }

  const db = await getDatabase();

  // ─── Legacy format (EndfieldGachaHelper schemaVersion) ───
  if (isLegacySnapshot(raw)) {
    const adapted = adaptLegacySnapshot(raw);
    const deduped = dedupeRecords(adapted.records);

    for (const account of adapted.accounts) {
      await upsertGameAccount(account, db);
    }
    await upsertGachaRecords(deduped, db);

    return {
      accounts: adapted.accounts.length,
      records: deduped.length,
      fromLegacy: true,
    };
  }

  // ─── New format (Endfield Gacha Assistant snapshot) ───
  const snapshot = raw as ExportSnapshot;
  if (!snapshot.version && !snapshot.accounts && !snapshot.records) {
    return { accounts: 0, records: 0, fromLegacy: false };
  }
  for (const account of snapshot.accounts ?? []) {
    await upsertGameAccount(account, db);
  }
  await upsertGachaRecords(snapshot.records ?? [], db);
  await saveMetadataSnapshot(snapshot.metadata ?? [], db);

  // Restore tokens if present
  if (snapshot.tokens) {
    try {
      if (snapshot.tokens.appToken) {
        await saveSecurePreference('auth.appToken', snapshot.tokens.appToken, db);
      }
      if (snapshot.tokens.sklandToken) {
        await saveSecurePreference('skland.token', snapshot.tokens.sklandToken, db);
      }
      for (const [hgUid, t] of Object.entries(snapshot.tokens.checkInTokens ?? {})) {
        if (t) {
          await saveSecurePreference(`checkin.token.${hgUid}`, t, db);
        }
      }
    } catch {
      // tokens are best-effort
    }
  }

  return {
    accounts: snapshot.accounts?.length ?? 0,
    records: snapshot.records?.length ?? 0,
    fromLegacy: false,
  };
}

// CSV export for data portability.
export async function exportRecordsToCsvFile(): Promise<string | null> {
  if (!isTauriRuntime()) {
    throw new Error('File export is only available in Tauri runtime.');
  }

  const filePath = await save({
    defaultPath: `endfield-gacha-assistant-${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });

  if (!filePath) {
    return null;
  }

  const records = await listRecordsByAccount();
  await writeTextFile(filePath, withBom(exportRecordsToCsv(records)));
  return filePath;
}

export async function importRecordsFromCsvFile(): Promise<number> {
  if (!isTauriRuntime()) {
    throw new Error('File import is only available in Tauri runtime.');
  }

  const filePath = await open({
    multiple: false,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });

  if (!filePath || Array.isArray(filePath)) {
    return 0;
  }

  const content = await readTextFile(filePath);
  const records = importRecordsFromCsv(content);
  if (records.length === 0) return 0;

  const db = await getDatabase();
  await upsertGachaRecords(records, db);
  return records.length;
}
