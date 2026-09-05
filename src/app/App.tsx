import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { BarChart3, Database, Info, Settings, Swords, UserRound, Users } from 'lucide-react';
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
  NotificationContext, AuthContext, DataContext, SyncContext,
  useNotifications, useData,
} from '@/app/hooks/contexts';
import { useNotificationsState } from '@/app/hooks/useNotifications';
import { useAuthState } from '@/app/hooks/useAuth';
import { useDataState } from '@/app/hooks/useData';
import { useSyncState } from '@/app/hooks/useSync';
import { useBootstrap, type BootstrapResult } from '@/app/hooks/useBootstrap';
import { getAppVersion, isTauriRuntime } from '@/lib/runtime';

type PageKey = 'statistics' | 'characterPools' | 'weaponPools' | 'records' | 'accounts' | 'checkin' | 'settings' | 'about';
type NavItem = { key: PageKey; label: string; code: string; icon: ReactNode };

declare const __APP_VERSION__: string;

const navigation: NavItem[] = [
  { key: 'statistics', label: '统计', code: 'STAT', icon: <BarChart3 className="h-4 w-4" /> },
  { key: 'characterPools', label: '角色卡池', code: 'UNIT', icon: <Users className="h-4 w-4" /> },
  { key: 'weaponPools', label: '武器卡池', code: 'WEAP', icon: <Swords className="h-4 w-4" /> },
  { key: 'records', label: '记录', code: 'GACHA', icon: <Database className="h-4 w-4" /> },
  { key: 'accounts', label: '账号', code: 'USER', icon: <UserRound className="h-4 w-4" /> },
  { key: 'checkin', label: '签到', code: 'CHECK', icon: <CalendarCheck className="h-4 w-4" /> },
  { key: 'settings', label: '设置', code: 'CFG', icon: <Settings className="h-4 w-4" /> },
  { key: 'about', label: '关于', code: 'INFO', icon: <Info className="h-4 w-4" /> },
];

const pageIndex = (key: PageKey) => String(navigation.findIndex((n) => n.key === key) + 1).padStart(2, '0');

export function App() {
  const boot = useBootstrap();
  if (!boot.ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">
          <span className="ef-spinner" aria-hidden="true" />
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
      <AuthLayer boot={boot} />
    </NotificationContext.Provider>
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
    initialResourceVersion: boot.resourceVersion,
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
  const { notifications, dismissNotification, pushNotification } = useNotifications();
  const { accounts, activeAccountId, summary, poolSummaries, pityGaps, pityGapsWpn, records, resourceVersion } = useData();
  const [page, setPage] = useState<PageKey>('statistics');
  const [now, setNow] = useState(new Date());
  const [appVersion, setAppVersion] = useState<string>(__APP_VERSION__);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const version = await getAppVersion(__APP_VERSION__);
      if (active) {
        setAppVersion(version);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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

  const activeNav = navigation.find((item) => item.key === page) ?? navigation[0];

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
    <div className="ef-app">
      <ToastViewport notifications={notifications} onDismiss={dismissNotification} />
      <div className="ef-frame">
        <aside className="ef-dock">
          <div className="ef-brand">
            <span className="ef-brand-mark" aria-hidden="true" />
            <div>
              <p className="ef-brand-code">EGA // REC</p>
              <p className="ef-brand-name mt-1">终末地抽卡助手</p>
            </div>
          </div>
          <p className="ef-nav-caption">模块 / Module</p>
          <nav className="ef-nav" aria-label="主导航">
            {navigation.map((item, idx) => {
              const active = item.key === page;
              return (
                <button key={item.key} type="button" onClick={() => setPage(item.key)}
                  aria-current={active ? 'page' : undefined} className="ef-navbtn">
                  <span className="ef-navbtn-idx">{String(idx + 1).padStart(2, '0')}</span>
                  {item.icon}
                  <span className="ef-navbtn-label">{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="ef-dockfoot">
            <div className="flex items-center gap-2 pb-1 text-sm text-[#f2f2f0]">
              <UserRound className="h-4 w-4 shrink-0 text-[color:var(--signal)]" />
              <span className="truncate">{activeAccount ? activeAccount.nickname : '未选择账号'}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="ef-code">版本</span>
              <span className="font-mono text-xs text-[#f2f2f0]">v{appVersion}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="ef-code">资源</span>
              <span className="font-mono text-xs text-[#f2f2f0]">{resourceVersion === '未同步' ? resourceVersion : `v${resourceVersion}`}</span>
            </div>
          </div>
        </aside>

        <div className="ef-workspace">
          <header className="ef-topbar">
            <div className="ef-top-status">
              <span className="ef-pulse" aria-hidden="true" />
              <span>{activeNav.label} / 数据链路正常</span>
            </div>
            <div className="ef-top-clocks">
              <span className="hidden sm:inline">本地 {localTime}</span>
              <span className="ef-clock-cst">CST {cstTime}</span>
            </div>
          </header>

          <div className="ef-metrics grid-cols-2 xl:grid-cols-4">
            <MetricCell label="账号" value={String(accounts.length)} />
            <MetricCell label="记录" value={String(safeSummary.totalPulls)} />
            <MetricCell label="当前保底" value={String(safeSummary.currentPity)} />
            <MetricCell label="六星率" value={`${(safeSummary.sixStarRate * 100).toFixed(1)}%`} />
          </div>

          <main className="ef-content">
            <div className="ef-pagehead">
              <p className="ef-kicker">{pageIndex(page)} / {activeNav.code} // ENDFIELD DATA</p>
              <h1 className="ef-title mt-2 text-3xl">{activeNav.label}</h1>
            </div>
            <ErrorBoundary>{pageContent}</ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="ef-metric">
      <div className="ef-metric-label">{label}</div>
      <div className="ef-metric-value">{value}</div>
    </div>
  );
}
