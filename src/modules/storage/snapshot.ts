import type { GameAccount, GachaRecord, PoolMetadata } from '@/domain/types';

export interface TokenSnapshot {
  appToken: string | null;
  sklandToken: string | null;
  checkInTokens: Record<string, string>;
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
