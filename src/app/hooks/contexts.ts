import { createContext, useContext } from 'react';
import type { GameAccount, GachaRecord, PoolMetadata } from '@/domain/types';
import type { BoundAccount } from '@/modules/official-api/types';
import type { SyncState } from '@/modules/sync-engine/service';
import type { summarizeRecords, summarizePools, selectFeaturedPools, PityGapInfo } from '@/modules/stats-engine/summary';

export interface AppNotification {
  id: string;
  tone: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

export interface NotificationContextValue {
  notifications: AppNotification[];
  pushNotification: (tone: AppNotification['tone'], title: string, message?: string) => void;
  dismissNotification: (id: string) => void;
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('NotificationContext not available');
  return ctx;
}

export interface ThemeContextValue {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => Promise<void>;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('ThemeContext not available');
  return ctx;
}

export interface AuthContextValue {
  token: string;
  setToken: (token: string) => void;
  appToken: string | null;
  bindings: BoundAccount[];
  authenticating: boolean;
  authenticate: () => Promise<void>;
  clearAppToken: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthContext not available');
  return ctx;
}

export interface DataContextValue {
  storageState: string;
  pathsLabel: string;
  resourceVersion: string;
  accounts: GameAccount[];
  activeAccountId: string | null;
  setActiveAccountId: (id: string | null) => Promise<void>;
  records: GachaRecord[];
  metadata: PoolMetadata[];
  metadataIndex: Map<string, PoolMetadata>;
  summary: ReturnType<typeof summarizeRecords>;
  poolSummaries: ReturnType<typeof summarizePools>;
  featuredPools: ReturnType<typeof selectFeaturedPools>;
  pityGaps: PityGapInfo[];
  pityGapsWpn: PityGapInfo[];
  refresh: (preferredAccountId?: string | null) => Promise<void>;
  syncAssets: () => Promise<{ pools: number; version: string; updatedAt: string }>;
  deleteAccount: (accountId: string) => Promise<void>;
  importBindings: () => Promise<void>;
  exportJson: () => Promise<string | null>;
  exportFullJson: () => Promise<string | null>;
  importJson: () => Promise<{ accounts: number; records: number; fromLegacy: boolean }>;
  exportCsv: () => Promise<string | null>;
  importCsv: () => Promise<number>;
}

export const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('DataContext not available');
  return ctx;
}

export interface SyncContextValue {
  syncState: SyncState;
  syncActiveAccount: () => Promise<void>;
  cancelSync: () => void;
}

export const SyncContext = createContext<SyncContextValue | null>(null);

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('SyncContext not available');
  return ctx;
}
