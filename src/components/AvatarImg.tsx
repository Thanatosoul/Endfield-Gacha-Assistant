import { memo, useEffect, useState } from 'react';
import { getAssetUrl } from '@/lib/runtime';

interface AvatarImgProps {
  category: 'character' | 'weapon';
  itemId: string;
  size?: number;
  ringClass?: string;
  title?: string;
}

export const AvatarImg = memo(function AvatarImg({
  category,
  itemId,
  size = 32,
  ringClass = '',
  title,
}: AvatarImgProps) {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const folder = category === 'weapon' ? 'weapon' : 'character';
  const candidates = [
    `${getAssetUrl(`/source/${folder}/${itemId}.png`)}`,
    `${getAssetUrl(`/source/${folder}/${itemId}.webp`)}`,
  ];
  const style = { width: size, height: size };

  useEffect(() => {
    setIndex(0);
    setLoaded(false);
  }, [category, itemId]);

  if (index >= candidates.length) {
    return (
      <span
        className={`inline-block border-2 border-[color:var(--panel-border)] bg-black/20 ${ringClass}`}
        style={style}
      />
    );
  }

  return (
    <img
      src={candidates[index]}
      alt=""
      title={title}
      loading="lazy"
      decoding="async"
      className={`shrink-0 object-cover transition-opacity duration-200 ${ringClass} ${loaded ? 'opacity-100' : 'opacity-0'}`}
      style={{ ...style, background: 'var(--rule-soft)' }}
      onLoad={() => setLoaded(true)}
      onError={() => {
        setLoaded(false);
        setIndex((v) => v + 1);
      }}
    />
  );
});
