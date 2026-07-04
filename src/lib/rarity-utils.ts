export function rarityTextClass(rarity: number): string {
  if (rarity === 6) return 'font-bold text-red-500';
  if (rarity === 5) return 'font-bold text-amber-400';
  if (rarity === 4) return 'font-normal text-violet-400';
  return 'font-normal text-muted';
}
