import { useCallback, useState } from 'react';
import type { AppNotification, NotificationContextValue } from './contexts';

export function useNotificationsState(): NotificationContextValue {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const pushNotification = useCallback((tone: AppNotification['tone'], title: string, message?: string) => {
    const notification: AppNotification = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      tone,
      title,
      message,
    };
    setNotifications((prev) => [...prev, notification]);
    window.setTimeout(() => {
      setNotifications((prev) => prev.filter((e) => e.id !== notification.id));
    }, 5000);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { notifications, pushNotification, dismissNotification };
}
