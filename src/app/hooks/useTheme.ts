import { useCallback, useState } from 'react';
import { savePreference } from '@/modules/storage/repositories';
import { useNotifications } from './contexts';
import type { ThemeContextValue } from './contexts';

const THEME_KEY = 'ui.theme';

export function useThemeState(initial: 'dark' | 'light'): ThemeContextValue {
  const [theme, setThemeState] = useState(initial);
  const { pushNotification } = useNotifications();

  const setTheme = useCallback(async (nextTheme: 'dark' | 'light') => {
    setThemeState(nextTheme);
    await savePreference(THEME_KEY, nextTheme);
    pushNotification('success', '主题已更新', `当前主题：${nextTheme === 'dark' ? '深色' : '浅色'}`);
  }, [pushNotification]);

  return { theme, setTheme };
}
