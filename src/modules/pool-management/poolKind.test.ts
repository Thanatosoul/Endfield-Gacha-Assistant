import { describe, expect, it } from 'vitest';
import { classifyPoolKind } from '@/modules/pool-management/poolKind';

describe('classifyPoolKind', () => {
  it.each([
    ['beginner', 'E_CharacterGachaPoolType_Beginner', 'beginner'],
    ['standard', 'E_CharacterGachaPoolType_Standard', 'standard'],
    ['special_1_2_1', 'E_CharacterGachaPoolType_Special', 'special'],
    ['joint_1_2_2', 'E_CharacterGachaPoolType_Joint', 'joint'],
    ['special_rerun_1', 'E_CharacterGachaPoolType_Special', 'rerun'],
  ] as const)('classifies %s as %s', (poolId, poolType, expected) => {
    expect(classifyPoolKind(poolId, poolType, 'character')).toBe(expected);
  });

  it('keeps weapon pools outside character kinds', () => {
    expect(classifyPoolKind('joint_1_2_2', 'E_WeaponGachaPoolType_All', 'weapon')).toBe('weapon');
  });
});
