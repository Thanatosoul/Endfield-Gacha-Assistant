import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { BarChart3, Clock, Database, Info, Settings, Swords, UserRound, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastViewport } from '@/components/ToastViewport';
import { AboutPage } from '@/pages/AboutPage';
import { AccountsPage } from '@/pages/AccountsPage';
import { PoolBrowserPage } from '@/pages/PoolBrowserPage';
import { RecordsPage } from '@/pages/RecordsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { CheckInPage } from '@/pages/CheckInPage';
import { StatisticsPage } from '@/pages/StatisticsPage';
import {
  NotificationContext, ThemeContext, AuthContext, DataContext, SyncContext,
  useNotifications, useTheme, useData,
} from '@/app/hooks/contexts';
import { useNotificationsState } from '@/app/hooks/useNotifications';
import { useThemeState } from '@/app/hooks/useTheme';
import { useAuthState } from '@/app/hooks/useAuth';
import { useDataState } from '@/app/hooks/useData';
import { useSyncState } from '@/app/hooks/useSync';
import { useBootstrap, type BootstrapResult } from '@/app/hooks/useBootstrap';
import { isTauriRuntime } from '@/lib/runtime';

type PageKey = 'statistics' | 'characterPools' | 'weaponPools' | 'records' | 'accounts' | 'checkin' | 'settings' | 'about';
type NavItem = { key: PageKey; label: string; icon: ReactNode };

declare const __APP_VERSION__: string;
declare const __RESOURCE_VERSION__: string;

const navigation: NavItem[] = [
  { key: 'statistics', label: '统计', icon: <BarChart3 className="h-4 w-4" /> },
  { key: 'characterPools', label: '角色卡池', icon: <Users className="h-4 w-4" /> },
  { key: 'weaponPools', label: '武器卡池', icon: <Swords className="h-4 w-4" /> },
  { key: 'records', label: '记录', icon: <Database className="h-4 w-4" /> },
  { key: 'accounts', label: '账号', icon: <UserRound className="h-4 w-4" /> },
  { key: 'checkin', label: '签到', icon: <CalendarCheck className="h-4 w-4" /> },
  { key: 'settings', label: '设置', icon: <Settings className="h-4 w-4" /> },
  { key: 'about', label: '关于', icon: <Info className="h-4 w-4" /> },
];

export function App() {
  const boot = useBootstrap();
  if (!boot.ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-muted">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--accent)] border-transparent border-t-[color:var(--accent)]" />
          正在初始化...
        </div>
      </div>
    );
  }
  return <AppLayers boot={boot} />;
}

function AppLayers({ boot }: { boot: BootstrapResult }) {
  const notifCtx = useNotificationsState();
  return (
    <NotificationContext.Provider value={notifCtx}>
      <ThemeLayer boot={boot} />
    </NotificationContext.Provider>
  );
}

function ThemeLayer({ boot }: { boot: BootstrapResult }) {
  const themeCtx = useThemeState(boot.theme);
  return (
    <ThemeContext.Provider value={themeCtx}>
      <AuthLayer boot={boot} />
    </ThemeContext.Provider>
  );
}

function AuthLayer({ boot }: { boot: BootstrapResult }) {
  const authCtx = useAuthState(boot.token, boot.appToken);
  return (
    <AuthContext.Provider value={authCtx}>
      <DataLayer boot={boot} />
    </AuthContext.Provider>
  );
}

function DataLayer({ boot }: { boot: BootstrapResult }) {
  const dataCtx = useDataState({
    initialAccounts: boot.accounts,
    initialActiveAccountId: boot.activeAccountId,
    initialRecords: boot.records,
    initialMetadata: boot.metadata,
    initialStorageState: boot.storageState,
    initialPathsLabel: boot.pathsLabel,
  });
  return (
    <DataContext.Provider value={dataCtx}>
      <SyncLayer />
    </DataContext.Provider>
  );
}

function SyncLayer() {
  const syncCtx = useSyncState();
  return (
    <SyncContext.Provider value={syncCtx}>
      <AppContent />
    </SyncContext.Provider>
  );
}

function AppContent() {
  const { theme } = useTheme();
  const { notifications, dismissNotification, pushNotification } = useNotifications();
  const { accounts, activeAccountId, summary, poolSummaries, pityGaps, pityGapsWpn, records } = useData();
  const [page, setPage] = useState<PageKey>('statistics');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const autoUpdateRef = useRef(false);
  useEffect(() => {
    if (autoUpdateRef.current || !isTauriRuntime()) return;
    autoUpdateRef.current = true;
    let alive = true;
    (async () => {
      await new Promise((r) => setTimeout(r, 3000));
      if (!alive) return;
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();
        if (update && alive) {
          pushNotification('info', '发现新版本', `最新版本: ${update.version}，开始下载…`);
          await update.downloadAndInstall();
        }
      } catch { /* silent */ }
    })();
    return () => { alive = false; };
  }, [pushNotification]);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) ?? null,
    [accounts, activeAccountId],
  );

  const localTime = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const cstTime = (() => {
    const cst = new Date(now.getTime() + 8 * 3600000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(cst.getUTCHours())}:${pad(cst.getUTCMinutes())}:${pad(cst.getUTCSeconds())}`;
  })();

  const safeSummary = summary ?? {
    totalPulls: 0, paidPulls: 0, rarityCounts: { 3: 0, 4: 0, 5: 0, 6: 0 },
    sixStarRate: 0, fiveStarRate: 0,
    latestSixStar: null, latestUpSixStar: null, latestCharSixStar: null, latestWpnSixStar: null,
    currentPity: 0, currentPityWpn: 0, featuredSixStarHits: 0, offBannerSixStarHits: 0, pitySinceLastUp: 0,
  };

  const pageContent =
    page === 'statistics' ? (
      <StatisticsPage summary={safeSummary} poolSummaries={poolSummaries} pityGaps={pityGaps} pityGapsWpn={pityGapsWpn} />
    ) : page === 'characterPools' ? (
      <PoolBrowserPage category="character" poolSummaries={poolSummaries} records={records} />
    ) : page === 'weaponPools' ? (
      <PoolBrowserPage category="weapon" poolSummaries={poolSummaries} records={records} />
    ) : page === 'records' ? (
      <RecordsPage accounts={accounts} records={records} />
    ) : page === 'accounts' ? (
      <AccountsPage />
    ) : page === 'checkin' ? (
      <CheckInPage />
    ) : page === 'settings' ? (
      <SettingsPage />
    ) : (
      <AboutPage />
    );

  return (
    <div className="min-h-screen px-4 py-4 text-[color:var(--text-main)] sm:px-6 lg:px-8">
      <ToastViewport notifications={notifications} onDismiss={dismissNotification} />
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full gap-4 lg:gap-6">
        <aside className="panel hidden h-[calc(100vh-2rem)] w-72 shrink-0 self-start sticky top-0 rounded-[28px] p-5 lg:flex lg:flex-col">
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-[0.5em] text-[color:var(--accent)]">明日方舟：终末地</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Endfield 抽卡助手</h1>
            <p className="mt-3 text-sm text-muted leading-relaxed">统一抽卡记录分析工具</p>
          </div>
          <div className="mb-6 h-px accent-line" />
          <nav className="flex flex-1 flex-col gap-2">
            {navigation.map((item) => {
              const active = item.key === page;
              return (
                <button key={item.key} type="button" onClick={() => setPage(item.key)}
                  className={['flex items-center rounded-2xl px-4 py-3 text-left transition-all duration-200',
                    active
                      ? 'bg-[color:var(--accent-dim)] text-[color:var(--accent)] shadow-[inset_2px_0_0_var(--accent)]'
                      : 'text-muted hover:bg-white/[0.03] hover:text-[color:var(--text-main)]',
                  ].join(' ')}>
                  <span className="flex items-center gap-3">{item.icon}{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-3 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--accent-dim)]/30 p-4">
            <div className="flex items-center gap-2 text-sm">
              <UserRound className="h-4 w-4 shrink-0 text-[color:var(--accent)]" />
              <span className="truncate">{activeAccount ? activeAccount.nickname : '未选择账号'}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted">
              <span>程序版本</span><span className="text-right font-mono text-[color:var(--text-main)]">v{__APP_VERSION__}</span>
              <span>资源版本</span><span className="text-right font-mono text-[color:var(--text-main)]">v{__RESOURCE_VERSION__}</span>
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-[color:var(--accent)]" /><span className="font-mono tabular-nums">{localTime}</span></div>
                <span>本地时间</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-[color:var(--accent)]" /><span className="font-mono tabular-nums">{cstTime}</span></div>
                <span>中国标准时间</span>
              </div>
            </div>
          </div>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="panel rounded-[28px] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-[color:var(--accent)]">抽卡记录管理</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">{navigation.find((item) => item.key === page)?.label}</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricChip label="账号" value={String(accounts.length)} />
                <MetricChip label="记录" value={String(safeSummary.totalPulls)} />
                <MetricChip label="当前保底" value={String(safeSummary.currentPity)} />
                <MetricChip label="六星率" value={`${(safeSummary.sixStarRate * 100).toFixed(1)}%`} />
              </div>
            </div>
          </header>
          <div className="grid gap-3 lg:hidden">
            {navigation.map((item) => (
              <button key={item.key} type="button" onClick={() => setPage(item.key)}
                className={['panel rounded-2xl px-4 py-3 text-left', item.key === page ? 'border-[color:var(--accent)]/40' : ''].join(' ')}>
                <span className="flex items-center gap-3">{item.icon}{item.label}</span>
              </button>
            ))}
          </div>
          <section className="min-h-0 flex-1"><ErrorBoundary>{pageContent}</ErrorBoundary></section>
        </main>
      </div>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-strong rounded-2xl px-4 py-3 border-l-2 border-[color:var(--accent)]/40">
      <div className="text-xs uppercase tracking-[0.2em] text-muted">{label}</div>
      <div className="mt-2 text-lg font-semibold text-[color:var(--accent)]">{value}</div>
    </div>
  );
}
