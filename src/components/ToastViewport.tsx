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
          className="pointer-events-auto panel-strong rounded-3xl p-4 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div
                className={[
                  'text-xs uppercase tracking-[0.18em]',
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
              className="rounded-full border border-[color:var(--panel-border)] px-2 py-1 text-xs text-muted"
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
});
