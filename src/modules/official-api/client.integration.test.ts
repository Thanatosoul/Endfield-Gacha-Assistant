import { describe, expect, it, vi } from 'vitest';
import { OfficialApiClient } from '@/modules/official-api/client';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

describe('OfficialApiClient integration flow', () => {
  it('fetches full gacha flow across character and weapon pools', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/user/oauth2/v2/grant')) {
        return jsonResponse({ data: { token: 'app-token' } });
      }

      if (url.includes('/binding_list')) {
        return jsonResponse({
          status: 0,
          msg: 'ok',
          data: {
            list: [
              {
                appCode: 'endfield',
                appName: 'Endfield',
                supportMultiServer: true,
                bindingList: [],
              },
            ],
          },
        });
      }

      if (url.includes('/u8_token_by_uid')) {
        return jsonResponse({ data: { token: 'u8-token' } });
      }

      if (url.includes('/api/record/char')) {
        const parsed = new URL(url);
        const poolType = parsed.searchParams.get('pool_type');
        return jsonResponse({
          code: 0,
          msg: 'ok',
          data: {
            list:
              poolType === 'E_CharacterGachaPoolType_Special'
                ? [
                    {
                      charId: 'char_001',
                      charName: 'Perlica',
                      gachaTs: '1762000000',
                      isFree: false,
                      isNew: true,
                      poolId: 'special_launch_001',
                      poolName: 'Vectors of Origination',
                      rarity: 6,
                      seqId: '1001',
                    },
                  ]
                : [],
            hasMore: false,
          },
        });
      }

      if (url.includes('/api/record/weapon')) {
        return jsonResponse({
          code: 0,
          msg: 'ok',
          data: {
            list: [
              {
                weaponId: 'wpn_001',
                weaponName: 'Pharos Prototype',
                weaponType: 'rifle',
                gachaTs: '1762000001',
                isNew: true,
                poolId: 'weapon_launch_001',
                poolName: 'Forged Horizon Arsenal',
                rarity: 6,
                seqId: '2001',
              },
            ],
            hasMore: false,
          },
        });
      }

      throw new Error(`Unexpected request: ${url} ${init?.method ?? 'GET'}`);
    });

    const client = new OfficialApiClient(fetcher);
    const auth = await client.grantAppToken({ userToken: 'token' });
    expect(auth.accessToken).toBe('app-token');

    const bindings = await client.listBindings(auth.accessToken);
    expect(bindings.status).toBe(0);

    const u8 = await client.fetchU8TokenByUid('HG900321', auth.accessToken);
    expect(u8).toBe('u8-token');

    const all = await client.fetchAllGachaRecords(u8, {
      minDelayMs: 0,
      maxDelayMs: 0,
      poolSwitchMinDelayMs: 0,
      poolSwitchMaxDelayMs: 0,
      categorySwitchDelayMs: 0,
    });

    expect(all.character.E_CharacterGachaPoolType_Special).toHaveLength(1);
    expect(all.weapon.E_WeaponGachaPoolType_All).toHaveLength(1);
  });

  it('supports cancellation while fetching pages', async () => {
    const controller = new AbortController();

    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/record/char')) {
        controller.abort();
        return jsonResponse({
          code: 0,
          msg: 'ok',
          data: {
            list: [
              {
                charId: 'char_001',
                charName: 'Perlica',
                gachaTs: '1762000000',
                isFree: false,
                isNew: true,
                poolId: 'special_launch_001',
                poolName: 'Vectors of Origination',
                rarity: 6,
                seqId: '1001',
              },
            ],
            hasMore: true,
          },
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const client = new OfficialApiClient(fetcher);
    await expect(
      client.fetchAllGachaRecords('u8-token', {
        signal: controller.signal,
        minDelayMs: 0,
        maxDelayMs: 0,
        poolSwitchMinDelayMs: 0,
        poolSwitchMaxDelayMs: 0,
        categorySwitchDelayMs: 0,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
