import { memo, useState } from 'react';
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
  const folder = category === 'weapon' ? 'weapon' : 'character';
  const candidates = [
    `${getAssetUrl(`/source/${folder}/${itemId}.png`)}`,
    `${getAssetUrl(`/source/${folder}/${itemId}.webp`)}`,
  ];
  const style = { width: size, height: size };

  if (index >= candidates.length) {
    return <span className={`inline-block rounded-full border-2 border-[color:var(--panel-border)] bg-black/20 ${ringClass}`} style={style} />;
  }

  return (
    <img src={candidates[index]} alt="" title={title}
      className={`rounded-full object-cover shrink-0 ${ringClass}`}
      style={style}
      onError={() => setIndex((v) => v + 1)} />
  );
});
