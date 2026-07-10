import { describe, expect, it } from 'vitest';
import { parseRemotePoolTable } from './remoteAssets';

describe('parseRemotePoolTable', () => {
  it('normalizes the published asset repository schema', () => {
    const metadata = parseRemotePoolTable({
      special_1: {
        pool_gacha_type: 'char', pool_name: 'Test pool', pool_type: 'special',
        up6_name: 'Test six', up5_name: 'Test five, Test five B',
        all: [{ id: 'chr_1', name: 'Test six', rarity: 6 }, { id: 'chr_2', name: 'Test four', rarity: 4 }],
      },
    }, '20260710');

    expect(metadata).toEqual([expect.objectContaining({
      pool_id: 'special_1', category: 'character', version: '20260710',
      up5_names: ['Test five', 'Test five B'],
      items: [{ item_id: 'chr_1', item_name: 'Test six', rarity: 6 }, { item_id: 'chr_2', item_name: 'Test four', rarity: 4 }],
    })]);
  });

  it('rejects a table without valid pools', () => {
    expect(() => parseRemotePoolTable({}, '20260710')).toThrow('没有有效卡池');
  });
});
