import { useCallback, useMemo, useState } from 'react';
import { OfficialApiClient } from '@/modules/official-api/client';
import type { BoundAccount } from '@/modules/official-api/types';
import { SyncEngine } from '@/modules/sync-engine/service';
import { saveSecurePreference } from '@/modules/storage/repositories';
import { useNotifications } from './contexts';
import type { AuthContextValue } from './contexts';

const SKLAND_TOKEN_KEY = 'skland.token';
const APP_TOKEN_KEY = 'auth.appToken';

export function useAuthState(initialToken: string, initialAppToken: string | null): AuthContextValue {
  const { pushNotification } = useNotifications();
  const api = useMemo(() => new OfficialApiClient(), []);
  const syncEngine = useMemo(() => new SyncEngine(api), [api]);

  const [token, setTokenState] = useState(initialToken);
  const [appToken, setAppToken] = useState<string | null>(initialAppToken);
  const [bindings, setBindings] = useState<BoundAccount[]>([]);
  const [authenticating, setAuthenticating] = useState(false);

  const setToken = useCallback((newToken: string) => {
    setTokenState(newToken);
    void saveSecurePreference(SKLAND_TOKEN_KEY, newToken);
  }, []);

  const clearAppToken = useCallback(async () => {
    setAppToken(null);
    await saveSecurePreference(APP_TOKEN_KEY, '');
  }, []);

  const authenticate = useCallback(async () => {
    if (!token.trim()) throw new Error('请先填写官方 Token。');
    setAuthenticating(true);
    try {
      const result = await syncEngine.authenticate(token.trim());
      setAppToken(result.appToken);
      await saveSecurePreference(APP_TOKEN_KEY, result.appToken);
      const bindingsResponse = await syncEngine.fetchBindings(result.appToken);
      if (bindingsResponse.status !== 0) {
        throw new Error(bindingsResponse.msg || '获取绑定列表失败。');
      }
      const endfield = bindingsResponse.data.list.find((e) => e.appCode === 'endfield');
      setBindings(endfield?.bindingList ?? []);
      pushNotification('success', '认证成功', `已加载 ${endfield?.bindingList?.length ?? 0} 个绑定账号。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushNotification('error', '认证失败', message);
      throw error;
    } finally {
      setAuthenticating(false);
    }
  }, [token, syncEngine, pushNotification]);

  return { token, setToken, appToken, bindings, authenticating, authenticate, clearAppToken };
}
