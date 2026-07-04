import { describe, expect, it } from 'vitest';
import { adaptLegacySnapshot, isLegacySnapshot } from '@/modules/import-export/legacyAdapter';

const sampleLegacy = {
  schemaVersion: 2,
  exportedAt: 1781875573820,
  accounts: [
    {
      uid: '1:1640319142',
      hgUid: '102220192',
      channelName: '官服 · China',
      addedAt: 1777942590091,
      provider: 'hypergryph',
      serverId: '1',
      roleId: '1640319142',
      roles: [
        {
          roleId: '1640319142',
          nickName: 'Thanatosoul',
          serverId: '1',
        },
      ],
    },
  ],
  records: [
    {
      uid: '1:1640319142',
      recordUid: '1:1640319142_char_772',
      fetchedAt: 1780909890115,
      category: 'character',
      poolId: 'special_1_3_1',
      poolName: '拳出无悔',
      charId: 'chr_0031_mifu',
      charName: '弭弗',
      rarity: 6,
      isNew: true,
      isFree: false,
      gachaTs: '1780665634759',
      seqId: '772',
    },
    {
      uid: '1:1640319142',
      recordUid: '1:1640319142_char_771',
      fetchedAt: 1780909890115,
      category: 'character',
      poolId: 'standard',
      poolName: '基础寻访',
      charId: 'chr_0019_karin',
      charName: '秋栗',
      rarity: 4,
      isNew: false,
      isFree: true,
      gachaTs: '1780665634759',
      seqId: '771',
    },
  ],
  weaponRecords: [
    {
      uid: '1:1640319142',
      recordUid: '1:1640319142_weapon_430',
      fetchedAt: 1780909890291,
      category: 'weapon',
      poolId: 'weponbox_1_3_1',
      poolName: '绛结申领',
      weaponId: 'wpn_claym_0017',
      weaponName: '赤缨',
      weaponType: 'E_WeaponType_Claymores',
      rarity: 6,
      isNew: true,
      gachaTs: '1780665743311',
      seqId: '430',
    },
    {
      uid: '1:1640319142',
      recordUid: '1:1640319142_weapon_429',
      fetchedAt: 1780909890291,
      category: 'weapon',
      poolId: 'weaponbox_constant_1',
      poolName: '坚冰申领',
      weaponId: 'wpn_lance_0006',
      weaponName: '向心之引',
      weaponType: 'E_WeaponType_Lance',
      rarity: 5,
      isNew: false,
      gachaTs: '1780665743311',
      seqId: '429',
    },
  ],
};

describe('isLegacySnapshot', () => {
  it('recognises legacy snapshots', () => {
    expect(isLegacySnapshot(sampleLegacy)).toBe(true);
  });

  it('rejects new snapshots', () => {
    expect(isLegacySnapshot({ version: '0.1.0', accounts: [], records: [], metadata: [] })).toBe(false);
  });
});

describe('adaptLegacySnapshot', () => {
  it('converts account to new model', () => {
    const result = adaptLegacySnapshot(sampleLegacy);

    expect(result.accounts).toHaveLength(1);
    const acc = result.accounts[0]!;
    expect(acc.id).toBe('1:1640319142');
    expect(acc.uid).toBe('1640319142');
    expect(acc.hg_uid).toBe('102220192');
    expect(acc.nickname).toBe('Thanatosoul');
    expect(acc.region).toBe('cn');
    expect(acc.channel).toBe('官服 · China');
  });

  it('converts character records to snake_case unified model', () => {
    const result = adaptLegacySnapshot(sampleLegacy);
    const charRecords = result.records.filter((r) => r.category === 'character');

    expect(charRecords).toHaveLength(2);

    const sixStar = charRecords.find((r) => r.rarity === 6)!;
    expect(sixStar.record_uid).toBe('1:1640319142_char_772');
    expect(sixStar.account_id).toBe('1:1640319142');
    expect(sixStar.item_id).toBe('chr_0031_mifu');
    expect(sixStar.item_name).toBe('弭弗');
    expect(sixStar.is_new).toBe(true);
    expect(sixStar.is_free).toBe(false);
    expect(sixStar.pool_type).toBe('E_CharacterGachaPoolType_Special');
    expect(sixStar.weapon_type).toBeNull();
    // gacha_ts should be in seconds (original was 13-digit ms)
    expect(sixStar.gacha_ts).toBeLessThan(1_000_000_000_000);

    const free = charRecords.find((r) => r.is_free)!;
    expect(free.pool_type).toBe('E_CharacterGachaPoolType_Standard');
  });

  it('converts weapon records to unified model with weapon_type', () => {
    const result = adaptLegacySnapshot(sampleLegacy);
    const wpnRecords = result.records.filter((r) => r.category === 'weapon');

    expect(wpnRecords).toHaveLength(2);

    const rare = wpnRecords.find((r) => r.rarity === 6)!;
    expect(rare.record_uid).toBe('1:1640319142_weapon_430');
    expect(rare.item_id).toBe('wpn_claym_0017');
    expect(rare.item_name).toBe('赤缨');
    expect(rare.weapon_type).toBe('E_WeaponType_Claymores');
    expect(rare.is_free).toBe(false);
    expect(rare.pool_type).toBe('E_WeaponGachaPoolType_All');

    const constant = wpnRecords.find((r) => r.pool_id.startsWith('weaponbox_constant'))!;
    expect(constant.pool_type).toBe('E_WeaponGachaPoolType_Standard');
  });

  it('produces correct total record count', () => {
    const result = adaptLegacySnapshot(sampleLegacy);
    expect(result.records).toHaveLength(
      sampleLegacy.records.length + sampleLegacy.weaponRecords.length,
    );
  });
});
