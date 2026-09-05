import { memo } from 'react';
import type { AppNotification } from '@/app/hooks/contexts';

export const ToastViewport = memo(function ToastViewport({
  notifications,
  onDismiss,
}: {
  notifications: AppNotification[];
  onDismiss: (id: string) => void;
}) {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={[
            'ef-toast pointer-events-auto',
            notification.tone === 'success'
              ? 'ef-toast--success'
              : notification.tone === 'error'
                ? 'ef-toast--error'
                : 'ef-toast--info',
          ].join(' ')}
        >
          <div className="flex w-full items-start justify-between gap-3">
            <div>
              <div
                className={[
                  'text-xs font-semibold uppercase tracking-[0.18em]',
                  notification.tone === 'success'
                    ? 'text-[color:var(--success)]'
                    : notification.tone === 'error'
                      ? 'text-[color:var(--danger)]'
                      : 'text-[color:var(--accent)]',
                ].join(' ')}
              >
                {notification.title}
              </div>
              {notification.message ? <div className="mt-2 text-sm text-muted">{notification.message}</div> : null}
            </div>

            <button
              type="button"
              onClick={() => onDismiss(notification.id)}
              className="ef-btn ef-btn--sm shrink-0 px-2"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
});
