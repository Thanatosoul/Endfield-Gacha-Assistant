import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { GameAccount, GachaRecord, PoolMetadata } from '@/domain/types';
import { seedMetadata } from '@/modules/metadata/catalog';
import { bootstrapStorage } from '@/modules/storage/database';
import { listAccounts, listMetadata, listRecordsByAccount, getPreference } from '@/modules/storage/queries';
import { saveMetadataSnapshot, getSecurePreference, saveSecurePreference } from '@/modules/storage/repositories';
import { ensurePoolScaffold } from '@/modules/pool-management/files';
import { isTauriRuntime } from '@/lib/runtime';

export interface BootstrapResult {
  ready: boolean;
  theme: 'dark' | 'light';
  token: string;
  appToken: string | null;
  activeAccountId: string | null;
  accounts: GameAccount[];
  records: GachaRecord[];
  metadata: PoolMetadata[];
  storageState: string;
  pathsLabel: string;
  error: string | null;
}

const THEME_KEY = 'ui.theme';
const ACTIVE_ACCOUNT_KEY = 'ui.activeAccountId';
const SKLAND_TOKEN_KEY = 'skland.token';
const APP_TOKEN_KEY = 'auth.appToken';

export function useBootstrap(): BootstrapResult {
  const [result, setResult] = useState<BootstrapResult>({
    ready: false, theme: 'dark', token: '', appToken: null,
    activeAccountId: null, accounts: [], records: [], metadata: seedMetadata,
    storageState: '', pathsLabel: '', error: null,
  });

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { databaseUrl } = await bootstrapStorage();

        const [savedTheme, savedActiveAccount, savedToken] = await Promise.all([
          getPreference(THEME_KEY), getPreference(ACTIVE_ACCOUNT_KEY), getPreference(SKLAND_TOKEN_KEY),
        ]);
        const nextTheme = savedTheme?.value === 'light' ? 'light' : 'dark';
        const preferredAccountId = savedActiveAccount?.value?.trim() ? savedActiveAccount.value : null;
        if (!alive) return;

        const encryptedToken = await getSecurePreference(SKLAND_TOKEN_KEY);
        let token = '';
        if (encryptedToken) {
          token = encryptedToken;
        } else if (savedToken?.value?.trim()) {
          token = savedToken.value;
          await saveSecurePreference(SKLAND_TOKEN_KEY, savedToken.value);
        }
        if (!alive) return;

        const encryptedAppToken = await getSecurePreference(APP_TOKEN_KEY);
        const appToken = encryptedAppToken || null;
        if (!alive) return;

        await saveMetadataSnapshot(seedMetadata);
        if (!alive) return;

        const accountsData = await listAccounts();
        const hasPreferred = preferredAccountId
          ? accountsData.some((e) => e.id === preferredAccountId)
          : false;
        const accountId = hasPreferred ? preferredAccountId : (accountsData[0]?.id ?? null);
        const recordsData = await listRecordsByAccount(accountId ?? undefined);

        const metadataData = await listMetadata();
        const finalMetadata = metadataData.length > 0 ? metadataData : seedMetadata;
        const pools = metadataData.length > 0 ? metadataData : seedMetadata;
        await Promise.allSettled(pools.map((p) => ensurePoolScaffold(p)));

        if (!alive) return;
        let pathsLabel = '浏览器预览';
        try {
          if (isTauriRuntime()) pathsLabel = await invoke<string>('pool_source_dir');
        } catch { /* browser fallback */ }

        if (!alive) return;
        setResult({
          ready: true, theme: nextTheme, token, appToken,
          activeAccountId: accountId, accounts: accountsData, records: recordsData,
          metadata: finalMetadata,
          storageState: databaseUrl.replace(/^sqlite:/, ''),
          pathsLabel, error: null,
        });
      } catch (error) {
        if (!alive) return;
        const message = error instanceof Error ? error.message : String(error);
        setResult((prev) => ({
          ...prev, ready: true,
          storageState: `预览模式：${message}`,
          pathsLabel: '浏览器预览',
          error: message,
        }));
      }
    })();
    return () => { alive = false; };
  }, []);

  return result;
}
