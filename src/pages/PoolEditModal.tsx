import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { PoolMetadata } from '@/domain/types';
import { ensurePoolScaffold, readPoolJsonMerged, savePoolJson } from '@/modules/pool-management/files';
import { getPoolMetadata, upsertPoolMetadata, deletePoolMetadata } from '@/modules/pool-management/service';
import { useData } from '@/app/hooks/contexts';

interface PoolEditModalProps {
  poolId: string;
  poolName?: string;
  onClose: () => void;
}


export function PoolEditModal({ poolId, poolName, onClose }: PoolEditModalProps) {
  const { metadata, poolSummaries, refresh } = useData();
  const [pool, setPool] = useState<PoolMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPool() {
      try {
        setLoading(true);
        setError(null);

        // 首先从应用元数据中查找
        const poolFromMetadata = metadata.find((m) => m.pool_id === poolId);

        if (poolFromMetadata) {
          let nextPool = poolFromMetadata;
          const parsed = await readPoolJsonMerged(poolId);
          nextPool = {
            ...nextPool,
            pool_name: parsed?.poolName ?? nextPool.pool_name,
            up6_name: parsed?.up6Name ?? nextPool.up6_name,
          };
          await ensurePoolScaffold(nextPool);
          if (!cancelled) setPool(nextPool);
        } else {
          // 如果没找到，尝试从数据库查询
          const data = await getPoolMetadata(poolId);
          if (data) {
            if (!cancelled) setPool(data);
          } else {
            // 如果数据库也没有，创建新的元数据模板
            // 从 poolSummaries 中找到对应的池子信息
            const poolSummary = poolSummaries.find((p) => p.poolId === poolId);

            if (!poolSummary) {
              if (!cancelled) setError(`卡池未找到: ${poolId}`);
              return;
            }

            // 创建新的元数据模板
            const newPool: PoolMetadata = {
              pool_id: poolId,
              category: poolSummary.category,
              pool_type: poolSummary.category === 'character' ? 'special_character' : 'special_weapon',
              pool_name: poolName ?? poolSummary.poolName,
              up6_name: '',
              up5_names: [],
              items: [],
              valid_from: 0,
              valid_to: 0,
              version: '1.0.0',
            };
            const parsed = await readPoolJsonMerged(poolId);
            newPool.pool_name = parsed?.poolName ?? newPool.pool_name;
            newPool.up6_name = parsed?.up6Name ?? newPool.up6_name;
            await ensurePoolScaffold(newPool);
            if (!cancelled) setPool(newPool);
          }
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPool();
    return () => { cancelled = true; };
  }, [metadata, poolId, poolName, poolSummaries]);

  async function handleSave() {
    if (!pool) return;
    try {
      setSaving(true);
      await upsertPoolMetadata({
        ...pool,
        up5_names: [],
      });
      await savePoolJson(pool);
      await refresh();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`确定要删除卡池 ${pool?.pool_name} 吗？`)) return;
    try {
      setSaving(true);
      await deletePoolMetadata(poolId);
      await refresh();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="ef-overlay">
        <div className="ef-modal w-full max-w-sm p-6">
          <div className="flex items-center gap-3">
            <div className="ef-spinner" />
            加载中...
          </div>
        </div>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="ef-overlay">
        <div className="ef-modal w-full max-w-sm p-6">
          <p className="text-sm text-[color:var(--danger)]">{error || '无法加载卡池信息'}</p>
          <button
            type="button"
            onClick={onClose}
            className="ef-btn ef-btn--primary mt-4"
          >
            关闭
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ef-overlay">
      <div className="ef-modal w-full max-w-md p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="ef-title text-xl">编辑卡池</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted transition-colors hover:text-[color:var(--text-main)]"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/5 p-3 text-sm text-[color:var(--danger)]">
            {error}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium">卡池ID</label>
            <input
              type="text"
              value={pool.pool_id}
              disabled
              className="ef-field mt-1 text-muted"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">卡池名称</label>
            <input
              type="text"
              value={pool.pool_name}
              onChange={(e) => setPool({ ...pool, pool_name: e.target.value })}
              className="ef-field mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">UP 6星</label>
            <input
              type="text"
              value={pool.up6_name}
              onChange={(e) => setPool({ ...pool, up6_name: e.target.value })}
              className="ef-field mt-1"
              placeholder="如果没有则留空"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="ef-btn ef-btn--primary flex-1"
            >
              {saving ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin border-2 border-[color:var(--signal-ink)]/30 border-t-[color:var(--signal-ink)]" />
                  保存中...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  保存
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="ef-btn flex-1"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="ef-btn ef-btn--danger"
            >
              删除
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
