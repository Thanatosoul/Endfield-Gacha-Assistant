import { useCallback, useMemo, useState } from 'react';
import type { GameAccount, GachaRecord, PoolMetadata } from '@/domain/types';
import { seedMetadata } from '@/modules/metadata/catalog';
import {
  exportSnapshotToJsonFile,
  exportFullJsonToFile,
  importSnapshotFromJsonFile,
  exportRecordsToCsvFile,
  importRecordsFromCsvFile,
} from '@/modules/import-export/service';
import { saveAccountsFromBindings } from '@/modules/storage/accounts';
import { listAccounts, listMetadata, listRecordsByAccount } from '@/modules/storage/queries';
import { deleteAccountCascade, savePreference, saveMetadataSnapshot } from '@/modules/storage/repositories';
import { summarizePools, summarizeRecords, selectFeaturedPools, computePityGaps } from '@/modules/stats-engine/summary';
import { ensurePoolScaffold } from '@/modules/pool-management/files';
import { useAuth, useNotifications } from './contexts';
import type { DataContextValue } from './contexts';

const ACTIVE_ACCOUNT_KEY = 'ui.activeAccountId';

interface DataBootInput {
  initialAccounts: GameAccount[];
  initialActiveAccountId: string | null;
  initialRecords: GachaRecord[];
  initialMetadata: PoolMetadata[];
  initialStorageState: string;
  initialPathsLabel: string;
}

export function useDataState(input: DataBootInput): DataContextValue {
  const { pushNotification } = useNotifications();
  const { bindings } = useAuth();

  const [accounts, setAccounts] = useState<GameAccount[]>(input.initialAccounts);
  const [activeAccountId, setActiveAccountIdState] = useState<string | null>(input.initialActiveAccountId);
  const [records, setRecords] = useState<GachaRecord[]>(input.initialRecords);
  const [metadata, setMetadata] = useState<PoolMetadata[]>(input.initialMetadata);
  const [storageState] = useState(input.initialStorageState);
  const [pathsLabel] = useState(input.initialPathsLabel);

  const metadataIndex = useMemo(() => {
    const map = new Map<string, PoolMetadata>();
    for (const entry of metadata) map.set(entry.pool_id, entry);
    return map;
  }, [metadata]);

  const summary = useMemo(() => summarizeRecords(records, metadataIndex), [metadataIndex, records]);
  const poolSummaries = useMemo(() => summarizePools(records, metadataIndex), [metadataIndex, records]);
  const featuredPools = useMemo(() => selectFeaturedPools(poolSummaries), [poolSummaries]);
  const pityGaps = useMemo(() => computePityGaps(records, 'character'), [records]);
  const pityGapsWpn = useMemo(() => computePityGaps(records, 'weapon'), [records]);

  const refresh = useCallback(async (preferredAccountId?: string | null) => {
    const accountsData = await listAccounts();
    const metadataData = await listMetadata();
    const preferred = preferredAccountId ?? activeAccountId ?? null;
    const hasPreferred = preferred ? accountsData.some((e) => e.id === preferred) : false;
    const accountId = hasPreferred ? preferred : (accountsData[0]?.id ?? null);
    const recordsData = await listRecordsByAccount(accountId ?? undefined);

    setAccounts(accountsData);
    setActiveAccountIdState(accountId);
    setRecords(recordsData);

    if (metadataData.length > 0) {
      setMetadata(metadataData);
    } else {
      await saveMetadataSnapshot(seedMetadata);
    }

    const pools = metadataData.length > 0 ? metadataData : seedMetadata;
    await Promise.allSettled(pools.map((p) => ensurePoolScaffold(p)));
  }, [activeAccountId]);

  const setActiveAccountId = useCallback(async (accountId: string | null) => {
    setActiveAccountIdState(accountId);
    await savePreference(ACTIVE_ACCOUNT_KEY, accountId ?? '');
    setRecords(await listRecordsByAccount(accountId ?? undefined));
    if (accountId) pushNotification('info', '已切换账号', accountId);
  }, [pushNotification]);

  const deleteAccount = useCallback(async (accountId: string) => {
    const account = accounts.find((e) => e.id === accountId);
    if (!account) throw new Error('未找到要删除的账号。');
    await deleteAccountCascade(accountId);
    const remaining = accounts.filter((e) => e.id !== accountId);
    const nextActive = activeAccountId === accountId ? (remaining[0]?.id ?? null) : activeAccountId;
    await savePreference(ACTIVE_ACCOUNT_KEY, nextActive ?? '');
    await refresh(nextActive);
    pushNotification('success', '账号已删除', `已删除 ${account.nickname} 的本地账号和记录。`);
  }, [accounts, activeAccountId, pushNotification, refresh]);

  const importBindings = useCallback(async () => {
    const imported = await saveAccountsFromBindings(bindings);
    await refresh();
    if (!activeAccountId && imported[0]) await setActiveAccountId(imported[0].id);
    pushNotification('success', '导入完成', `已更新 ${imported.length} 个本地账号。`);
  }, [bindings, refresh, activeAccountId, setActiveAccountId, pushNotification]);

  const exportJson = useCallback(async () => {
    const filePath = await exportSnapshotToJsonFile();
    if (filePath) pushNotification('success', '记录已导出', filePath);
    return filePath;
  }, [pushNotification]);

  const exportFullJson = useCallback(async () => {
    const filePath = await exportFullJsonToFile();
    if (filePath) pushNotification('success', '完整数据已导出（含账户与Token）', filePath);
    return filePath;
  }, [pushNotification]);

  const importJson = useCallback(async () => {
    const result = await importSnapshotFromJsonFile();
    await refresh();
    const label = result.fromLegacy ? 'Legacy JSON imported' : 'JSON imported';
    pushNotification('success', label, `${result.accounts} accounts, ${result.records} records restored.`);
    return result;
  }, [pushNotification, refresh]);

  const exportCsv = useCallback(async () => {
    const filePath = await exportRecordsToCsvFile();
    if (filePath) pushNotification('success', 'CSV exported', filePath);
    return filePath;
  }, [pushNotification]);

  const importCsv = useCallback(async () => {
    const count = await importRecordsFromCsvFile();
    await refresh();
    pushNotification('success', 'CSV imported', `${count} records imported.`);
    return count;
  }, [pushNotification, refresh]);

  return {
    storageState, pathsLabel, accounts, activeAccountId, setActiveAccountId,
    records, metadata, metadataIndex, summary, poolSummaries, featuredPools,
    pityGaps, pityGapsWpn, refresh, deleteAccount, importBindings,
    exportJson, exportFullJson, importJson, exportCsv, importCsv,
  };
}
