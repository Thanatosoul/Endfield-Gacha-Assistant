import type { GachaCategory, PoolKind } from '@/domain/types';

export type CharacterPoolKind = 'beginner' | 'standard' | 'special' | 'joint' | 'rerun';
export type { PoolKind };

/** Classify a pool for product behavior, independently of the API request type. */
export function classifyPoolKind(
  poolId: string,
  poolType: string,
  category: GachaCategory,
): PoolKind {
  if (category === 'weapon') return 'weapon';

  const id = poolId.toLowerCase();
  const type = poolType.toLowerCase();

  if (id.includes('rerun') || id.includes('reprint') || type.includes('rerun') || type.includes('reprint')) {
    return 'rerun';
  }
  if (id.startsWith('joint') || type.includes('joint')) return 'joint';
  if (id === 'beginner' || id.startsWith('beginner') || type.includes('beginner')) return 'beginner';
  if (id === 'standard' || id.startsWith('standard') || type.includes('standard')) return 'standard';
  return 'special';
}
