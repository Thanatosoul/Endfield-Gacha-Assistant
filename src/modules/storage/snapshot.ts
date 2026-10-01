import type { GameAccount, GachaRecord, PoolMetadata } from '@/domain/types';

/** Per-account token entry in a full export. Keyed by `hg_uid`. */
export interface AccountTokenSnapshot {
  /** Skland token for this account; also used for check-in. */
  sklandToken?: string;
  /** Whether daily check-in is enabled for this account. */
  checkIn?: boolean;
}

export interface TokenSnapshot {
  /** App-wide token obtained from authentication. */
  appToken: string | null;
  /** Per-account tokens, keyed by `hg_uid`. */
  accounts?: Record<string, AccountTokenSnapshot>;
  /** Global Skland token, emitted only when it cannot be attached to an account. */
  sklandToken?: string | null;
  /** @deprecated Legacy per-account check-in tokens; still accepted on import. */
  checkInTokens?: Record<string, string>;
}

export interface ExportSnapshot {
  version: string;
  exportedAt: number;
  accounts?: GameAccount[];
  records: GachaRecord[];
  metadata: PoolMetadata[];
  /** Present only in full export (transfer). Tokens in plaintext — handle with care. */
  tokens?: TokenSnapshot;
}
