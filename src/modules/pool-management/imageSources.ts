import type { GachaCategory } from '@/domain/types';
import { getOfficialBannerUrls } from '@/modules/pool-management/officialAssets';

/**
 * Third-party banner fallbacks.
 *
 * The official content API does not return image fields for some pools (for
 * example the joint pool `joint_1_2_2` / 辉光庆典), so the asset mirror has no
 * banner for them. These mirrors are used as a fallback when the local mirror
 * has no banner image.
 */
export const IVAQIS_BANNER_BASE =
  'https://raw.githubusercontent.com/ivaqis/arknights-tracker/main/arknights-tracker/static/images/banners/icon';

export const CEP_BANNER_BASE = 'https://raw.githubusercontent.com/cmyyx/cep/main/public/images/banners';

/** Explicit poolId -> cep banner slug for pools whose banner is keyed by name. */
export const CEP_BANNER_SLUGS: Record<string, string> = {
  joint_1_2_2: 'huiguagnqingdian',
};

/**
 * Ordered remote banner candidates for a pool. The cep source (name-keyed) is
 * preferred when we know the slug; the ivaqis source is keyed directly by pool
 * id and covers every pool the mirror ships.
 */
export function getBannerFallbackUrls(poolId: string): string[] {
  const urls = [...getOfficialBannerUrls(poolId)];
  const slug = CEP_BANNER_SLUGS[poolId];
  if (slug) urls.push(`${CEP_BANNER_BASE}/${slug}.webp`);
  urls.push(`${IVAQIS_BANNER_BASE}/${poolId}.webp`);
  return urls;
}

/** akedata sprite CDN, used as a portrait fallback when the local mirror lacks an icon. */
export const AKEDATA_SPRITES_BASE =
  'https://data.akedata.wiki/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites';

/** cep portrait mirrors, keyed directly by item id (character portraits and weapon portraits). */
export const CEP_CHARACTER_PORTRAIT_BASE = 'https://raw.githubusercontent.com/cmyyx/cep/main/public/images/characters';
export const CEP_WEAPON_PORTRAIT_BASE = 'https://raw.githubusercontent.com/cmyyx/cep/main/public/images/weapon';

/**
 * Ordered remote portrait candidates for an item. akedata keys character icons by
 * `icon_<itemId>.png` (the item id already carries the `chr_` prefix); cep mirrors
 * both character and weapon portraits as `<itemId>.avif`.
 */
export function getPortraitFallbackUrls(itemId: string, category: GachaCategory): string[] {
  if (category === 'weapon') return [`${CEP_WEAPON_PORTRAIT_BASE}/${itemId}.avif`];
  return [`${AKEDATA_SPRITES_BASE}/charremoteicon/icon_${itemId}.png`, `${CEP_CHARACTER_PORTRAIT_BASE}/${itemId}.avif`];
}
