import { afterEach, describe, expect, it } from 'vitest';
import {
  AKEDATA_SPRITES_BASE,
  CEP_BANNER_BASE,
  CEP_CHARACTER_PORTRAIT_BASE,
  CEP_WEAPON_PORTRAIT_BASE,
  IVAQIS_BANNER_BASE,
  getBannerFallbackUrls,
  getPortraitFallbackUrls,
} from './imageSources';
import { getPoolImageCandidates } from './files';
import { clearOfficialBannerCache, setOfficialBannerUrls } from './officialAssets';

afterEach(() => {
  clearOfficialBannerCache();
});

describe('banner fallbacks', () => {
  it('prefers the cep slug, then ivaqis, for joint_1_2_2', () => {
    expect(getBannerFallbackUrls('joint_1_2_2')).toEqual([
      `${CEP_BANNER_BASE}/huiguagnqingdian.webp`,
      `${IVAQIS_BANNER_BASE}/joint_1_2_2.webp`,
    ]);
  });

  it('uses only the ivaqis source when no cep slug is known', () => {
    expect(getBannerFallbackUrls('special_1_5_1')).toEqual([`${IVAQIS_BANNER_BASE}/special_1_5_1.webp`]);
  });

  it('places local mirror images before the remote fallbacks', async () => {
    const { background } = await getPoolImageCandidates('joint_1_2_2', 'character', undefined, 7);
    expect(background[0]).toContain('images/banner/char/joint_1_2_2.png');
    expect(background[1]).toContain('images/banner/char/joint_1_2_2.webp');
    expect(background[2]).toContain('huiguagnqingdian.webp');
    expect(background[3]).toContain('ivaqis');
  });
});

describe('portrait fallbacks', () => {
  it('uses the akedata icon, then the cep portrait, for character items', () => {
    expect(getPortraitFallbackUrls('chr_0016_laevat', 'character')).toEqual([
      `${AKEDATA_SPRITES_BASE}/charremoteicon/icon_chr_0016_laevat.png`,
      `${CEP_CHARACTER_PORTRAIT_BASE}/chr_0016_laevat.avif`,
    ]);
  });

  it('falls back to the cep weapon portrait for weapons', () => {
    expect(getPortraitFallbackUrls('wpn_sword_0003', 'weapon')).toEqual([
      `${CEP_WEAPON_PORTRAIT_BASE}/wpn_sword_0003.avif`,
    ]);
  });

  it('appends the remote portraits after the local mirror portraits', async () => {
    const { avatar } = await getPoolImageCandidates('joint_1_2_2', 'character', 'chr_0016_laevat', 7);
    expect(avatar[0]).toContain('images/character/chr_0016_laevat.png');
    expect(avatar[1]).toContain('images/character/chr_0016_laevat.webp');
    expect(avatar[2]).toContain('charremoteicon/icon_chr_0016_laevat.png');
    expect(avatar[3]).toContain('characters/chr_0016_laevat.avif');
  });
});

describe('official banner tier', () => {
  it('prefers a probed official banner URL before third-party mirrors', () => {
    const official = 'https://web.hycdn.cn/upload/image/20260101/abc.png';
    setOfficialBannerUrls('joint_1_2_2', [official]);
    const urls = getBannerFallbackUrls('joint_1_2_2');
    expect(urls[0]).toBe(official);
    expect(urls[1]).toContain('huiguagnqingdian.webp');
    expect(urls[2]).toContain('ivaqis');
  });

  it('still lists the local mirror before a probed official banner', async () => {
    setOfficialBannerUrls('special_1_5_1', ['https://web.hycdn.cn/upload/image/20260101/xyz.png']);
    const { background } = await getPoolImageCandidates('special_1_5_1', 'character', undefined, 7);
    expect(background[0]).toContain('images/banner/char/special_1_5_1.png');
    expect(background[1]).toContain('images/banner/char/special_1_5_1.webp');
    expect(background[2]).toBe('https://web.hycdn.cn/upload/image/20260101/xyz.png?v=7');
  });
});
