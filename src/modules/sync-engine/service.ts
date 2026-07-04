import type { GameAccount, GachaRecord } from '@/domain/types';
import { OfficialApiClient, OfficialRiskControlError } from '@/modules/official-api/client';
import { CHARACTER_POOL_TYPES } from '@/modules/official-api/types';
import { appendSyncLog, upsertGachaRecords } from '@/modules/storage/repositories';
import { getExistingCharacterSeqIdsByPool, getExistingSeqIds } from '@/modules/storage/queries';
import { mapOfficialCharacterRecord, mapOfficialWeaponRecord } from '@/modules/storage/mappers';

export type SyncStatus = 'idle' | 'authenticating' | 'fetching_bindings' | 'fetching_records' | 'done' | 'cancelled' | 'error';

export interface SyncState {
  status: SyncStatus;
  accountId?: string;
  category?: GachaRecord['category'];
  poolType?: string;
  poolIndex?: number;
  totalPools?: number;
  recordsFetched?: number;
  charRecordsFetched?: number;
  weaponRecordsFetched?: number;
  error?: string;
}

export interface AuthenticateResult {
  appToken: string;
}

export class SyncEngine {
  private readonly api: OfficialApiClient;

  constructor(api = new OfficialApiClient()) {
    this.api = api;
  }

  async authenticate(userToken: string): Promise<AuthenticateResult> {
    const result = await this.api.grantAppToken({ userToken });
    return {
      appToken: result.accessToken,
    };
  }

  async fetchBindings(appToken: string) {
    return this.api.listBindings(appToken);
  }

  async syncAccount(
    account: GameAccount,
    appToken: string,
    onProgress?: (state: SyncState) => void,
    signal?: AbortSignal,
  ): Promise<{ inserted: number; charInserted: number; weaponInserted: number }> {
    const startedAt = Date.now();
    const logId = `${account.id}-${startedAt}`;

    try {
      onProgress?.({ status: 'authenticating', accountId: account.id });
      const u8Token = await this.api.fetchU8TokenByUid(account.hg_uid, appToken, {
        signal,
      });

      const [existingCharacterSeqIdsByPoolRaw, existingWeaponSeqIds] = await Promise.all([
        getExistingCharacterSeqIdsByPool(account.id),
        getExistingSeqIds(account.id, 'weapon'),
      ]);

      const existingCharacterSeqIdsByPool = {
        E_CharacterGachaPoolType_Special: existingCharacterSeqIdsByPoolRaw.E_CharacterGachaPoolType_Special ?? new Set<string>(),
        E_CharacterGachaPoolType_Standard: existingCharacterSeqIdsByPoolRaw.E_CharacterGachaPoolType_Standard ?? new Set<string>(),
        E_CharacterGachaPoolType_Beginner: existingCharacterSeqIdsByPoolRaw.E_CharacterGachaPoolType_Beginner ?? new Set<string>(),
      };

      let charFetched = 0;
      let weaponFetched = 0;

      onProgress?.({
        status: 'fetching_records',
        accountId: account.id,
        category: 'character',
        totalPools: CHARACTER_POOL_TYPES.length + 1,
        recordsFetched: 0,
      });

      const result = await this.api.fetchAllGachaRecords(u8Token, {
        signal,
        existingCharacterSeqIdsByPool,
        existingWeaponSeqIds,
        onProgress: (progress) => {
          if (progress.category === 'character') {
            charFetched = progress.recordsFetched;
          } else {
            weaponFetched = progress.recordsFetched;
          }

          onProgress?.({
            status: 'fetching_records',
            accountId: account.id,
            category: progress.category,
            poolType: progress.poolType,
            poolIndex: progress.poolIndex,
            totalPools: progress.totalPools,
            recordsFetched: charFetched + weaponFetched,
            charRecordsFetched: charFetched,
            weaponRecordsFetched: weaponFetched,
          });
        },
      });

      const characterRecords = Object.values(result.character).flatMap((records) =>
        records.map((record) => mapOfficialCharacterRecord(account, record)),
      );
      const weaponRecords = Object.values(result.weapon).flatMap((records) =>
        records.map((record) => mapOfficialWeaponRecord(account, record)),
      );

      const [charInserted, weaponInserted] = await Promise.all([
        upsertGachaRecords(characterRecords),
        upsertGachaRecords(weaponRecords),
      ]);
      const inserted = charInserted + weaponInserted;

      await appendSyncLog({
        id: logId,
        account_id: account.id,
        region: account.region,
        category: 'character+weapon',
        started_at: startedAt,
        finished_at: Date.now(),
        status: 'completed',
        message: `Inserted ${inserted} records`,
      }).catch(() => {});

      onProgress?.({
        status: 'done',
        accountId: account.id,
        recordsFetched: inserted,
        charRecordsFetched: charInserted,
        weaponRecordsFetched: weaponInserted,
      });

      return { inserted, charInserted, weaponInserted };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = isAbort(error) ? 'cancelled' : 'error';

      await appendSyncLog({
        id: logId,
        account_id: account.id,
        region: account.region,
        category: 'character+weapon',
        started_at: startedAt,
        finished_at: Date.now(),
        status,
        message,
      }).catch(() => {});

      onProgress?.({
        status,
        accountId: account.id,
        error: normalizeSyncError(error),
      });

      throw error;
    }
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.message === 'Aborted');
}

function normalizeSyncError(error: unknown): string {
  if (error instanceof OfficialRiskControlError) {
    return 'Official API rate limit or risk control triggered. Please try again later.';
  }

  return error instanceof Error ? error.message : String(error);
}
