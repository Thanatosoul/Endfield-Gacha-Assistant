import { describe, expect, it } from 'vitest';
import { accountsFromBinding, makeAccountId, parseAccountId } from '@/modules/storage/accounts';

describe('storage accounts helpers', () => {
  it('builds and parses account ids', () => {
    const accountId = makeAccountId('2', '88002201');
    expect(accountId).toBe('2:88002201');
    expect(parseAccountId(accountId)).toEqual({ serverId: '2', roleId: '88002201' });
  });

  it('maps binding roles into local accounts', () => {
    const accounts = accountsFromBinding(
      {
        uid: 'HG900321',
        channelMasterId: 1,
        channelName: 'Hypergryph',
        isOfficial: true,
        isDefault: true,
        isDeleted: false,
        isBanned: false,
        registerTs: 1,
        roles: [
          {
            roleId: '100181024',
            nickName: 'Aster',
            level: 1,
            serverId: '1',
            serverName: 'CN-1',
            isDefault: true,
            isBanned: false,
            registerTs: 1,
          },
        ],
      },
    );

    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.id).toBe('1:100181024');
    expect(accounts[0]?.hg_uid).toBe('HG900321');
  });
});
