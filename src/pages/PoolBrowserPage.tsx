import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { getPoolImageCandidates, readPoolJsonMerged } from '@/modules/pool-management/files';
import type { GachaCategory, GachaRecord } from '@/domain/types';
import type { PoolSummary } from '@/modules/stats-engine/summary';
import { RarityDonut } from '@/components/RarityDonut';
import { PullTimeline } from '@/components/PullTimeline';
import { PoolEditModal } from '@/pages/PoolEditModal';
import { useData } from '@/app/hooks/contexts';
import { rarityTextClass } from '@/lib/rarity-utils';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { AvatarImg } from '@/components/AvatarImg';

interface PoolBrowserPageProps {
  category: GachaCategory;
  poolSummaries: PoolSummary[];
  records: GachaRecord[];
}

export const PoolBrowserPage = memo(function PoolBrowserPage({ category, poolSummaries, records }: PoolBrowserPageProps) {
  const [tab, setTab] = useState<'limited' | 'secondary' | 'beginner'>('limited');
  const [selectedPool, setSelectedPool] = useState<PoolSummary | null>(null);
  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);
  const [assetsVersion, setAssetsVersion] = useState(0);

  const pools = useMemo(() => {
    const all = poolSummaries.filter((p) => p.category === category);
    if (category === 'character') {
      const limited = all.filter((p) => p.poolId.toLowerCase().startsWith('special'));
      const basic = all.filter((p) => {
        const id = p.poolId.toLowerCase();
        return id === 'standard' || id.startsWith('standard');
      });
      const beginner = all.filter((p) => p.poolId.toLowerCase() === 'beginner' || p.poolId.toLowerCase().startsWith('beginner'));
      if (tab === 'limited') return limited;
      if (tab === 'beginner') return beginner;
      return basic;
    }

    const limited = all.filter((p) => {
      const id = p.poolId.toLowerCase();
      return (id.startsWith('weponbox_1_') || id.startsWith('weaponbox_1_')) && !id.includes('constant');
    });
    const constant = all.filter((p) => {
      const id = p.poolId.toLowerCase();
      return id.startsWith('weaponbox_constant_') || id.startsWith('weponbox_constant_');
    });
    return tab === 'limited' ? limited : constant;
  }, [category, poolSummaries, tab]);

  // Stable callbacks via ref to avoid re-creating functions in .map()
  const poolsRef = useRef(pools);
  poolsRef.current = pools;

  const handleOpenRecords = useCallback((poolId: string) => {
    const p = poolsRef.current.find((pool) => pool.poolId === poolId);
    if (p) setSelectedPool(p);
  }, []);

  const handleOpenSettings = useCallback((poolId: string) => {
    setEditingPoolId(poolId);
  }, []);

  const handleCloseRecords = useCallback(() => {
    setSelectedPool(null);
    setAssetsVersion(Date.now());
  }, []);

  const handleCloseSettings = useCallback(() => {
    setEditingPoolId(null);
    setAssetsVersion(Date.now());
  }, []);

  const poolRecordsMap = useMemo(() => {
    const map = new Map<string, GachaRecord[]>();
    for (const r of records) {
      const list = map.get(r.pool_id);
      if (list) {
        list.push(r);
      } else {
        map.set(r.pool_id, [r]);
      }
    }
    return map;
  }, [records]);

  useEffect(() => {
    let alive = true;
    const preload = async () => {
      const tasks = pools.map(async (pool) => {
        const parsed = await readPoolJsonMerged(pool.poolId);
        const candidates = await getPoolImageCandidates(pool.poolId, pool.category, parsed?.up6ItemId, assetsVersion);
        const targets = [candidates.background[0], candidates.avatar[0]].filter((v): v is string => Boolean(v));
        await Promise.all(
          targets.map(
            (src) =>
              new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => resolve();
                img.src = src;
              }),
          ),
        );
      });
      await Promise.all(tasks);
      if (!alive) return;
    };
    void preload();
    return () => {
      alive = false;
    };
  }, [pools, assetsVersion]);

  return (
    <div className="grid gap-4">
      <section className="panel rounded-[28px] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">
              {category === 'character' ? '角色卡池' : '武器卡池'}
            </p>
            <h3 className="mt-1 text-xl font-semibold">
              {category === 'character' ? '卡池总览' : '武库总览'}
            </h3>
          </div>
          <div className="text-sm text-muted">{pools.length} 个卡池</div>
        </div>

        <div className="mt-4 flex gap-2 border-b border-[color:var(--panel-border)]">
          <button
            type="button"
            onClick={() => setTab('limited')}
            className={[
              'px-3 py-2 text-sm font-medium transition-colors',
              tab === 'limited'
                ? 'border-b-2 border-[color:var(--accent)] text-[color:var(--accent)]'
                : 'text-muted hover:text-[color:var(--text-main)]',
            ].join(' ')}
          >
            限定寻访
          </button>
          <button
            type="button"
            onClick={() => setTab('secondary')}
            className={[
              'px-3 py-2 text-sm font-medium transition-colors',
              tab === 'secondary'
                ? 'border-b-2 border-[color:var(--accent)] text-[color:var(--accent)]'
                : 'text-muted hover:text-[color:var(--text-main)]',
            ].join(' ')}
          >
            {category === 'character' ? '基础寻访' : '指定寻访'}
          </button>
          {category === 'character' && (
            <button
              type="button"
              onClick={() => setTab('beginner')}
              className={[
                'px-3 py-2 text-sm font-medium transition-colors',
                tab === 'beginner'
                  ? 'border-b-2 border-[color:var(--accent)] text-[color:var(--accent)]'
                  : 'text-muted hover:text-[color:var(--text-main)]',
              ].join(' ')}
            >
              启程寻访
            </button>
          )}
        </div>
      </section>

      <div className="grid gap-3">
        {pools.map((pool) => (
          <PoolBannerCardItem
            key={pool.poolId}
            pool={pool}
            recordsMap={poolRecordsMap}
            assetsVersion={assetsVersion}
            onOpenRecords={handleOpenRecords}
            onOpenSettings={handleOpenSettings}
          />
        ))}
        {pools.length === 0 && (
          <div className="panel rounded-2xl p-5 text-sm text-muted">暂无卡池数据</div>
        )}
      </div>

      {selectedPool && (
        <PoolRecordsModal
          pool={selectedPool}
          records={poolRecordsMap.get(selectedPool.poolId) ?? []}
          onClose={handleCloseRecords}
        />
      )}

      {editingPoolId && (
        <PoolEditModal
          poolId={editingPoolId}
          poolName={poolSummaries.find((p) => p.poolId === editingPoolId)?.poolName}
          onClose={handleCloseSettings}
        />
      )}
    </div>
  );
});

const PoolBannerCardItem = memo(function PoolBannerCardItem({
  pool,
  recordsMap,
  assetsVersion,
  onOpenRecords,
  onOpenSettings,
}: {
  pool: PoolSummary;
  recordsMap: Map<string, GachaRecord[]>;
  assetsVersion: number;
  onOpenRecords: (poolId: string) => void;
  onOpenSettings: (poolId: string) => void;
}) {
  const poolRecords = recordsMap.get(pool.poolId) ?? [];
  const handleOpenRecords = useCallback(() => onOpenRecords(pool.poolId), [onOpenRecords, pool.poolId]);
  const handleOpenSettings = useCallback(() => onOpenSettings(pool.poolId), [onOpenSettings, pool.poolId]);

  return (
    <PoolBannerCard
      pool={pool}
      poolRecords={poolRecords}
      assetsVersion={assetsVersion}
      onOpenRecords={handleOpenRecords}
      onOpenSettings={handleOpenSettings}
    />
  );
});

interface PoolBannerCardProps {
  pool: PoolSummary;
  poolRecords: GachaRecord[];
  assetsVersion: number;
  onOpenRecords: () => void;
  onOpenSettings: () => void;
}

const PoolBannerCard = memo(function PoolBannerCard({
  pool,
  poolRecords,
  assetsVersion,
  onOpenRecords,
  onOpenSettings,
}: PoolBannerCardProps) {
  const { metadataIndex } = useData();
  const [bannerCandidates, setBannerCandidates] = useState<string[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);

  const meta = metadataIndex.get(pool.poolId);
  const up6Name = meta?.up6_name?.trim() ?? '';

  const cardStats = useMemo(() => {
    const sorted = [...poolRecords].sort((a, b) => a.gacha_ts - b.gacha_ts);
    const uniqueUp6: GachaRecord[] = [];
    const uniqueNonUp6: GachaRecord[] = [];
    const uniqueFive: GachaRecord[] = [];
    let up6Count = 0;
    let nonUp6Count = 0;
    let fiveCount = 0;
    let earliestTs = Infinity;
    let latestTs = -Infinity;

    for (const r of poolRecords) {
      const ts = r.gacha_ts > 1_000_000_000_000 ? r.gacha_ts / 1000 : r.gacha_ts;
      if (ts < earliestTs) earliestTs = ts;
      if (ts > latestTs) latestTs = ts;

      if (r.rarity === 6) {
        if (up6Name && r.item_name.trim() === up6Name) {
          up6Count++;
          if (!uniqueUp6.some((x) => x.item_id === r.item_id)) uniqueUp6.push(r);
        } else {
          nonUp6Count++;
          if (!uniqueNonUp6.some((x) => x.item_id === r.item_id)) uniqueNonUp6.push(r);
        }
      } else if (r.rarity === 5) {
        fiveCount++;
        if (!uniqueFive.some((x) => x.item_id === r.item_id)) uniqueFive.push(r);
      }
    }

    const startTs = poolRecords.length ? earliestTs : null;
    const endTs = poolRecords.length ? latestTs : null;

    return {
      sortedRecords: sorted,
      uniqueUp6Records: uniqueUp6,
      uniqueNonUp6Records: uniqueNonUp6,
      uniqueFive5Records: uniqueFive,
      up6Count,
      nonUp6Count,
      fiveCount,
      startTs,
      endTs,
    };
  }, [poolRecords, up6Name]);

  useEffect(() => {
    let alive = true;
    const loadAssets = async () => {
      const parsed = await readPoolJsonMerged(pool.poolId);
      const candidates = await getPoolImageCandidates(pool.poolId, pool.category, parsed?.up6ItemId, assetsVersion);
      if (!alive) return;
      setBannerCandidates(candidates.background);
      setBannerIndex(0);
    };
    void loadAssets();
    return () => { alive = false; };
  }, [pool.poolId, pool.category, assetsVersion]);

  return (
    <div className="panel-strong group relative w-full overflow-hidden rounded-3xl text-left">
      <button type="button" onClick={onOpenRecords} className="relative block w-full text-left">
        <div className="relative h-[180px] w-full overflow-hidden">
          {bannerIndex < bannerCandidates.length && (
            <img
              src={bannerCandidates[bannerIndex]}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center opacity-65 transition group-hover:opacity-80"
              onError={() => setBannerIndex((prev) => prev + 1)}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />
          <div className="absolute top-0 left-0 px-5 py-3 pr-12">
            <div className="text-2xl font-bold text-white drop-shadow leading-tight">{pool.poolName}</div>
            <div className="text-sm text-white/65 mt-1">
              抽取时间 {cardStats.startTs ? formatDate(cardStats.startTs) : '—'} 至 {cardStats.endTs ? formatDate(cardStats.endTs) : '—'}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 px-5 py-2">
            <span className="text-sm text-white/80 font-semibold">{pool.pulls} 抽</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 px-5 py-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-red-400 shrink-0">UP 6星 {cardStats.up6Count}：</span>
              {cardStats.uniqueUp6Records.length > 0 ? (
                <div className="flex items-center gap-1 flex-wrap">
                  {cardStats.uniqueUp6Records.map((r) => (
                    <AvatarImg key={r.record_uid} category={pool.category} itemId={r.item_id} size={36} ringClass="border-2 border-red-500" title={r.item_name} />
                  ))}
                </div>
              ) : (
                <span className="text-sm text-red-400/50">—</span>
              )}
            </div>
            <div className="h-5 w-px bg-[color:var(--panel-border)] shrink-0" />
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-red-300 shrink-0">非UP 6星 {cardStats.nonUp6Count}：</span>
              {cardStats.nonUp6Count > 0 ? (
                <div className="flex items-center gap-1 flex-wrap">
                  {cardStats.uniqueNonUp6Records.map((r) => (
                    <AvatarImg key={r.record_uid} category={pool.category} itemId={r.item_id} size={36} ringClass="border-2 border-red-300" title={r.item_name} />
                  ))}
                </div>
              ) : (
                <span className="text-sm text-red-300/50">—</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-amber-400 shrink-0">5星 {cardStats.fiveCount}：</span>
            {cardStats.uniqueFive5Records.length > 0 ? (
              <div className="flex items-center gap-1 flex-wrap">
                {cardStats.uniqueFive5Records.map((r) => (
                    <AvatarImg key={r.record_uid} category={pool.category} itemId={r.item_id} size={32} ringClass="border-2 border-amber-400" title={r.item_name} />
                ))}
              </div>
            ) : (
              <span className="text-sm text-amber-400/50">—</span>
            )}
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={onOpenSettings}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 rounded-md border border-white/35 bg-black/45 p-3 text-white hover:bg-black/60"
        title="卡池设置"
      >
        <Menu className="h-5 w-5" />
      </button>
    </div>
  );
});





const PoolRecordsModal = memo(function PoolRecordsModal({
  pool,
  records,
  onClose,
}: {
  pool: PoolSummary;
  records: GachaRecord[];
  onClose: () => void;
}) {
  const { metadataIndex } = useData();
  const sorted = useMemo(() => [...records].sort((a, b) => b.gacha_ts - a.gacha_ts), [records]);
  const poolMeta = metadataIndex.get(pool.poolId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="panel w-full max-w-5xl max-h-[90vh] flex flex-col rounded-3xl">
        <div className="flex items-center justify-between border-b border-[color:var(--panel-border)] px-5 py-4 shrink-0">
          <div>
            <div className="text-lg font-semibold">{pool.poolName}</div>
            <div className="text-xs text-muted">{pool.poolId}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[color:var(--panel-border)] px-3 py-2 text-sm"
          >
            关闭
          </button>
        </div>

        <div className="shrink-0">
          <div className="flex justify-center border-b border-[color:var(--panel-border)] py-4">
            <RarityDonut counts={pool.rarityCounts} size={140} />
          </div>
          <div className="border-b border-[color:var(--panel-border)] p-4">
            <PullTimeline records={records} metadata={poolMeta} />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="px-5 py-3 font-medium">时间</th>
                <th className="px-5 py-3 font-medium">物品</th>
                <th className="px-5 py-3 font-medium">稀有度</th>
                <th className="px-5 py-3 font-medium">标记</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.record_uid} className="border-t border-[color:var(--panel-border)]/70">
                  <td className="px-5 py-3">{formatDateTime(r.gacha_ts)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <AvatarImg category={r.category} itemId={r.item_id} size={32} />
                      <div>
                        <div className={rarityTextClass(r.rarity)}>{r.item_name}</div>
                        <div className="text-xs text-muted">{r.item_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3"><span className={rarityTextClass(r.rarity)}>{r.rarity}★</span></td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2 text-xs">
                      {r.is_new ? <span className="rounded-full border border-[color:var(--panel-border)] px-2 py-1">NEW</span> : null}
                      {r.is_free ? <span className="rounded-full border border-[color:var(--panel-border)] px-2 py-1">FREE</span> : null}
                    </div>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted">
                    暂无匹配记录。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});


