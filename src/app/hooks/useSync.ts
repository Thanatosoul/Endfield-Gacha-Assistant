import { useCallback, useRef, useState } from 'react';
import { OfficialApiClient } from '@/modules/official-api/client';
import { SyncEngine } from '@/modules/sync-engine/service';
import type { SyncState } from '@/modules/sync-engine/service';
import { saveSecurePreference } from '@/modules/storage/repositories';
import { useNotifications, useAuth, useData } from './contexts';
import type { SyncContextValue } from './contexts';

const APP_TOKEN_KEY = 'auth.appToken';

export function useSyncState(): SyncContextValue {
  const { pushNotification } = useNotifications();
  const { appToken } = useAuth();
  const { accounts, activeAccountId, refresh } = useData();
  const syncAbortRef = useRef<AbortController | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle' });

  const syncActiveAccount = useCallback(async () => {
    const api = new OfficialApiClient();
    const syncEngine = new SyncEngine(api);
    const controller = new AbortController();
    syncAbortRef.current = controller;

    try {
      if (!activeAccountId) throw new Error('请先选择一个账号。');
      if (!appToken) throw new Error('请先完成认证并获取 App Token。');
      const account = accounts.find((e) => e.id === activeAccountId);
      if (!account) throw new Error('未找到当前选中账号。');

      const { inserted, charInserted, weaponInserted } = await syncEngine.syncAccount(
        account, appToken, setSyncState, controller.signal,
      );
      await refresh();
      pushNotification('success', '同步完成',
        `${account.nickname}: 新增角色 ${charInserted} 条, 武器 ${weaponInserted} 条 (合计 ${inserted})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const title = controller.signal.aborted ? '同步已取消' : '同步失败';
      if (!controller.signal.aborted && isAuthError(error)) {
        await saveSecurePreference(APP_TOKEN_KEY, '');
        setSyncState({ status: 'idle' });
        pushNotification('error', '认证已失效', `${message}\nApp Token 已清除，请重新认证。`);
      } else {
        pushNotification(controller.signal.aborted ? 'info' : 'error', title, message);
      }
      throw error;
    } finally {
      syncAbortRef.current = null;
    }
  }, [accounts, activeAccountId, appToken, refresh, pushNotification]);

  const cancelSync = useCallback(() => {
    if (!syncAbortRef.current) {
      pushNotification('info', '当前没有进行中的同步任务');
      return;
    }
    syncAbortRef.current.abort();
    setSyncState((prev) => ({ ...prev, status: 'cancelled' }));
    pushNotification('info', '已发送取消请求', '正在停止当前同步任务。');
  }, [pushNotification]);

  return { syncState, syncActiveAccount, cancelSync };
}

function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    const m = error.message.toLowerCase();
    return m.includes('unauthorized') || m.includes('unauthenticated') ||
      m.includes('token') || m.includes('expired') || m.includes('login required') ||
      m.includes('请先登录') || m.includes('登录已过期');
  }
  return false;
}
