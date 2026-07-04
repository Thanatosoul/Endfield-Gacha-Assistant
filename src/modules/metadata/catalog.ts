import type { PoolMetadata } from '@/domain/types';

export const seedMetadata: PoolMetadata[] = [
  {
    pool_id: 'special_launch_001',
    category: 'character',
    pool_type: 'special_character',
    pool_name: 'Vectors of Origination',
    up6_name: 'Perlica',
    up5_names: ['Yvonne', 'Wulfgard'],
    items: [
      { item_id: 'char_001', item_name: 'Perlica', rarity: 6 },
      { item_id: 'char_014', item_name: 'Yvonne', rarity: 5 },
      { item_id: 'char_017', item_name: 'Wulfgard', rarity: 5 },
    ],
    valid_from: 1760000000,
    valid_to: 1763000000,
    version: '0.1.0',
  },
  {
    pool_id: 'weapon_launch_001',
    category: 'weapon',
    pool_type: 'special_weapon',
    pool_name: 'Forged Horizon Arsenal',
    up6_name: 'Pharos Prototype',
    up5_names: ['Hailtrace', 'Obsidian Rail'],
    items: [
      { item_id: 'wpn_001', item_name: 'Pharos Prototype', rarity: 6 },
      { item_id: 'wpn_011', item_name: 'Hailtrace', rarity: 5 },
      { item_id: 'wpn_019', item_name: 'Obsidian Rail', rarity: 5 },
    ],
    valid_from: 1760000000,
    valid_to: 1763000000,
    version: '0.1.0',
  },
  {
    pool_id: 'standard_001',
    category: 'character',
    pool_type: 'standard_character',
    pool_name: 'Foundry Registry',
    up6_name: '',
    up5_names: [],
    items: [],
    valid_from: 0,
    valid_to: 4102444800,
    version: '0.1.0',
  },
];

export function buildMetadataIndex(metadata: PoolMetadata[]): Map<string, PoolMetadata> {
  return new Map(metadata.map((entry) => [entry.pool_id, entry]));
}
