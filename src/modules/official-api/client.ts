import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { isTauriRuntime } from '@/lib/runtime';
import type {
  AllOfficialGachaRecords,
  CharacterGachaResponse,
  CharacterPoolType,
  FetchAllGachaOptions,
  FetchCharacterPoolPageInput,
  FetchPoolPageResult,
  FetchWeaponPoolPageInput,
  OfficialApiOptions,
  OfficialCharacterRecord,
  OfficialTokenGrantInput,
  OfficialWeaponRecord,
  UserBindingsResponse,
  WeaponGachaResponse,
} from '@/modules/official-api/types';
import { CHARACTER_POOL_TYPES } from '@/modules/official-api/types';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.112 Safari/537.36';

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
  }
}

export class OfficialRiskControlError extends Error {
  readonly status: number;
  readonly url: string;
  readonly responseText?: string;

  constructor(message: string, status: number, url: string, responseText?: string) {
    super(message);
    this.name = 'OfficialRiskControlError';
    this.status = status;
    this.url = url;
    this.responseText = responseText;
  }
}

function createAbortError(): Error {
  try {
    return new DOMException('Aborted', 'AbortError');
  } catch {
    const error = new Error('Aborted');
    (error as Error & { name?: string }).name = 'AbortError';
    return error;
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function providerToDomain(): string {
  return 'hypergryph.com';
}

function normalizeServerId(options?: OfficialApiOptions): string {
  return options?.serverId ?? '1';
}

function is404PageNotFound(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized === '404 page not found' || normalized.includes('404 page not found');
}

async function sleepAbortable(ms: number, signal?: AbortSignal) {
  throwIfAborted(signal);
  if (!signal) {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return;
  }

  const globalSetTimeout = setTimeout;
  const globalClearTimeout = clearTimeout;

  await new Promise<void>((resolve, reject) => {
    const timer = globalSetTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      globalClearTimeout(timer);
      reject(createAbortError());
    };

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function createFetcher(): FetchLike {
  return async (input, init) => {
    if (isTauriRuntime()) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      return tauriFetch(url, {
        method: init?.method ?? 'GET',
        headers: (init?.headers ?? {}) as HeadersInit,
        body: init?.body,
        signal: init?.signal,
      });
    }

    return fetch(input, init);
  };
}

export class OfficialApiClient {
  private readonly fetcher: FetchLike;
  private readonly userAgent: string;

  constructor(fetcher: FetchLike = createFetcher(), userAgent = DEFAULT_UA) {
    this.fetcher = fetcher;
    this.userAgent = userAgent;
  }

  async grantAppToken(input: OfficialTokenGrantInput, options?: OfficialApiOptions): Promise<{ accessToken: string }> {
    const url = `https://as.${providerToDomain()}/user/oauth2/v2/grant`;
    throwIfAborted(options?.signal);

    const response = await this.fetcher(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': this.userAgent,
      },
      signal: options?.signal,
      body: JSON.stringify({ type: 1, appCode: 'be36d44aa36bfb5b', token: input.userToken }),
    });

    if (!response.ok) {
      throw new HttpError('grantAppToken failed', response.status, url);
    }

    const json = (await response.json()) as { data?: { token?: string } };
    const accessToken = json.data?.token;
    if (!accessToken) {
      throw new Error('grantAppToken: missing app token in response');
    }

    return { accessToken };
  }

  async listBindings(appToken: string, options?: OfficialApiOptions): Promise<UserBindingsResponse> {
    const url = `https://binding-api-account-prod.${providerToDomain()}/account/binding/v1/binding_list?${new URLSearchParams({
      token: appToken,
      appCode: 'endfield',
    }).toString()}`;

    throwIfAborted(options?.signal);

    const response = await this.fetcher(url, {
      method: 'GET',
      headers: { 'User-Agent': this.userAgent },
      signal: options?.signal,
    });

    if (!response.ok) {
      throw new HttpError('listBindings failed', response.status, url);
    }

    return response.json() as Promise<UserBindingsResponse>;
  }

  async fetchU8TokenByUid(uid: string, appToken: string, options?: OfficialApiOptions): Promise<string> {
    const url = `https://binding-api-account-prod.${providerToDomain()}/account/binding/v1/u8_token_by_uid`;
    throwIfAborted(options?.signal);

    const response = await this.fetcher(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': this.userAgent,
      },
      signal: options?.signal,
      body: JSON.stringify({ uid, token: appToken }),
    });

    const text = await response.text();

    if (!response.ok) {
      if (response.status === 404 && is404PageNotFound(text)) {
        throw new OfficialRiskControlError('fetchU8TokenByUid: risk control / rate limited', response.status, url, text);
      }
      throw new HttpError('fetchU8TokenByUid failed', response.status, url);
    }

    if (is404PageNotFound(text)) {
      throw new OfficialRiskControlError('fetchU8TokenByUid: risk control / rate limited', response.status, url, text);
    }

    const json = JSON.parse(text) as { data?: { token?: string } };
    const token = json.data?.token;
    if (!token) {
      throw new Error('fetchU8TokenByUid: missing u8 token in response');
    }

    return token;
  }

  async fetchCharacterPoolPage(
    input: FetchCharacterPoolPageInput,
    options?: OfficialApiOptions,
  ): Promise<FetchPoolPageResult<OfficialCharacterRecord>> {
    const query = new URLSearchParams({
      lang: options?.lang ?? 'zh-cn',
      token: input.u8Token,
      server_id: normalizeServerId(options),
      pool_type: input.poolType,
    });

    if (input.seqId) {
      query.set('seq_id', input.seqId);
    }

    const url = `https://ef-webview.${providerToDomain()}/api/record/char?${query.toString()}`;
    const response = await this.fetcher(url, {
      method: 'GET',
      headers: { 'User-Agent': this.userAgent },
      signal: options?.signal,
    });

    if (!response.ok) {
      throw new HttpError('fetchCharacterPoolPage failed', response.status, url);
    }

    const json = (await response.json()) as CharacterGachaResponse;
    if (json.code !== 0) {
      throw new Error(`fetchCharacterPoolPage: api error code=${json.code} msg=${json.msg}`);
    }

    const list = json.data?.list ?? [];
    return {
      list,
      hasMore: Boolean(json.data?.hasMore),
      nextSeqId: list[list.length - 1]?.seqId,
    };
  }

  async fetchWeaponPoolPage(
    input: FetchWeaponPoolPageInput,
    options?: OfficialApiOptions,
  ): Promise<FetchPoolPageResult<OfficialWeaponRecord>> {
    const query = new URLSearchParams({
      lang: options?.lang ?? 'zh-cn',
      token: input.u8Token,
      server_id: normalizeServerId(options),
    });

    if (input.seqId) {
      query.set('seq_id', input.seqId);
    }

    const url = `https://ef-webview.${providerToDomain()}/api/record/weapon?${query.toString()}`;
    const response = await this.fetcher(url, {
      method: 'GET',
      headers: { 'User-Agent': this.userAgent },
      signal: options?.signal,
    });

    if (!response.ok) {
      throw new HttpError('fetchWeaponPoolPage failed', response.status, url);
    }

    const json = (await response.json()) as WeaponGachaResponse;
    if (json.code !== 0) {
      throw new Error(`fetchWeaponPoolPage: api error code=${json.code} msg=${json.msg}`);
    }

    const list = json.data?.list ?? [];
    return {
      list,
      hasMore: Boolean(json.data?.hasMore),
      nextSeqId: list[list.length - 1]?.seqId,
    };
  }

  async fetchAllGachaRecords(u8Token: string, options?: FetchAllGachaOptions): Promise<AllOfficialGachaRecords> {
    const poolSwitchMinDelayMs = options?.poolSwitchMinDelayMs ?? 1500;
    const poolSwitchMaxDelayMs = options?.poolSwitchMaxDelayMs ?? 2500;
    const categorySwitchDelayMs = options?.categorySwitchDelayMs ?? 2000;

    const character = {} as AllOfficialGachaRecords['character'];
    for (let index = 0; index < CHARACTER_POOL_TYPES.length; index += 1) {
      const poolType = CHARACTER_POOL_TYPES[index];
      const existingSeqIds = options?.existingCharacterSeqIdsByPool?.[poolType];
      character[poolType] = await this.fetchAllCharacterPoolRecords(u8Token, poolType, {
        ...options,
        existingSeqIds,
        onFetched: (recordsFetched) =>
          options?.onProgress?.({
            category: 'character',
            poolType,
            poolIndex: index + 1,
            totalPools: CHARACTER_POOL_TYPES.length + 1,
            recordsFetched,
          }),
      });

      if (index < CHARACTER_POOL_TYPES.length - 1) {
        await sleepAbortable(randomInt(poolSwitchMinDelayMs, poolSwitchMaxDelayMs), options?.signal);
      }
    }

    await sleepAbortable(categorySwitchDelayMs, options?.signal);

    const weaponRecords = await this.fetchAllWeaponPoolRecords(u8Token, {
      ...options,
      existingSeqIds: options?.existingWeaponSeqIds,
      onFetched: (recordsFetched) =>
        options?.onProgress?.({
          category: 'weapon',
          poolType: 'E_WeaponGachaPoolType_All',
          poolIndex: CHARACTER_POOL_TYPES.length + 1,
          totalPools: CHARACTER_POOL_TYPES.length + 1,
          recordsFetched,
        }),
    });

    return {
      character,
      weapon: {
        E_WeaponGachaPoolType_All: weaponRecords,
      },
    };
  }

  private async fetchAllCharacterPoolRecords(
    u8Token: string,
    poolType: CharacterPoolType,
    options?: OfficialApiOptions & {
      existingSeqIds?: Set<string>;
      onFetched?: (count: number) => void;
      minDelayMs?: number;
      maxDelayMs?: number;
    },
  ): Promise<OfficialCharacterRecord[]> {
    const all: OfficialCharacterRecord[] = [];
    let seqId: string | undefined;

    for (;;) {
      throwIfAborted(options?.signal);
      const page = await this.fetchCharacterPoolPage(seqId ? { u8Token, poolType, seqId } : { u8Token, poolType }, options);
      if (!page.list.length) {
        break;
      }

      const batch: OfficialCharacterRecord[] = [];
      for (const record of page.list) {
        if (options?.existingSeqIds?.has(record.seqId)) {
          all.push(...batch);
          options?.onFetched?.(all.length);
          return all;
        }
        batch.push(record);
      }

      all.push(...batch);
      options?.onFetched?.(all.length);

      if (!page.hasMore) {
        break;
      }

      seqId = page.nextSeqId;
      await sleepAbortable(randomInt(options?.minDelayMs ?? 800, options?.maxDelayMs ?? 1500), options?.signal);
    }

    return all;
  }

  private async fetchAllWeaponPoolRecords(
    u8Token: string,
    options?: OfficialApiOptions & {
      existingSeqIds?: Set<string>;
      onFetched?: (count: number) => void;
      minDelayMs?: number;
      maxDelayMs?: number;
    },
  ): Promise<OfficialWeaponRecord[]> {
    const all: OfficialWeaponRecord[] = [];
    let seqId: string | undefined;

    for (;;) {
      throwIfAborted(options?.signal);
      const page = await this.fetchWeaponPoolPage(seqId ? { u8Token, seqId } : { u8Token }, options);
      if (!page.list.length) {
        break;
      }

      const batch: OfficialWeaponRecord[] = [];
      for (const record of page.list) {
        if (options?.existingSeqIds?.has(record.seqId)) {
          all.push(...batch);
          options?.onFetched?.(all.length);
          return all;
        }
        batch.push(record);
      }

      all.push(...batch);
      options?.onFetched?.(all.length);

      if (!page.hasMore) {
        break;
      }

      seqId = page.nextSeqId;
      await sleepAbortable(randomInt(options?.minDelayMs ?? 800, options?.maxDelayMs ?? 1500), options?.signal);
    }

    return all;
  }
}
