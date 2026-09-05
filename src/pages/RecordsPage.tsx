import { memo, useEffect, useMemo, useState } from 'react';
import type { GameAccount, GachaRecord, GachaRarity } from '@/domain/types';
import { rarityTextClass } from '@/lib/rarity-utils';
import { toDateMs, formatDateTime } from '@/lib/date-utils';
import { AvatarImg } from '@/components/AvatarImg';

interface RecordsPageProps {
  accounts: GameAccount[];
  records: GachaRecord[];
}

const PAGE_SIZE = 25;

type Tab = 'character' | 'weapon';

export const RecordsPage = memo(function RecordsPage({ accounts, records }: RecordsPageProps) {
  const [tab, setTab] = useState<Tab>('character');

  const tabRecords = useMemo(() => records.filter((r) => r.category === tab), [records, tab]);
  const tabCounts = useMemo(() => ({
    character: records.filter((r) => r.category === 'character').length,
    weapon: records.filter((r) => r.category === 'weapon').length,
  }), [records]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3">
        {(['character', 'weapon'] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={[
              'flex items-center border px-5 py-2.5 text-sm font-medium transition',
              tab === key
                ? 'border-[color:var(--accent)] bg-[color:var(--signal-dim)] text-[color:var(--text-main)]'
                : 'border-[color:var(--rule)] text-muted hover:border-[color:var(--accent)] hover:text-[color:var(--text-main)]',
            ].join(' ')}
          >
            {key === 'character' ? '角色' : '武器'}
            <span className={tab === key ? 'ml-2 text-xs text-[color:var(--accent)]' : 'ml-2 text-xs text-muted'}>
              {tabCounts[key]}
            </span>
          </button>
        ))}
      </div>

      <RecordTab
        key={tab}
        category={tab}
        records={tabRecords}
        accounts={accounts}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
});

const RecordTab = memo(function RecordTab({
  category,
  records,
  accounts,
  pageSize,
}: {
  category: Tab;
  records: GachaRecord[];
  accounts: GameAccount[];
  pageSize: number;
}) {
  const [query,     setQuery]     = useState('');
  const [rarity,    setRarity]    = useState('all');
  const [poolName,  setPoolName]  = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');
  const [page,      setPage]      = useState(1);

  const availablePools = useMemo(
    () => [...new Set(records.map((r) => r.pool_name))].sort(),
    [records],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const startMs = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
    const endMs   = endDate   ? new Date(`${endDate}T23:59:59.999`).getTime() : null;

    return records.filter((r) => {
      if (rarity   !== 'all' && String(r.rarity)  !== rarity)   return false;
      if (poolName !== 'all' && r.pool_name !== poolName)        return false;

      const ts = toDateMs(r.gacha_ts);
      if (startMs !== null && ts < startMs) return false;
      if (endMs   !== null && ts > endMs)   return false;

      if (!q) return true;
      return [r.item_name, r.pool_name, r.seq_id, r.item_id].join(' ').toLowerCase().includes(q);
    });
  }, [endDate, poolName, query, rarity, records, startDate]);

  useEffect(() => { setPage(1); }, [query, rarity, poolName, startDate, endDate]);

  const totalPages   = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage     = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  );

  const isWeapon = category === 'weapon';

  const headers = useMemo(() =>
    isWeapon
      ? ['时间', '卡池', '物品', '武器类型', '稀有度', '标记', '流水号']
      : ['时间', '卡池', '物品', '稀有度', '标记', '流水号'],
    [isWeapon],
  );

  return (
    <div className="grid gap-4">
      <section className="ef-sec p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="ef-kicker">筛选</p>
            <p className="mt-2 text-sm text-muted">
              当前账号：{(() => {
                const aid = records[0]?.account_id;
                if (!aid) return '未选择账号';
                const acct = accounts.find((a) => a.id === aid);
                return acct ? acct.nickname : aid;
              })()}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <FF label="搜索">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="物品、卡池、流水号"
                className="ef-field"
              />
            </FF>

            <FF label="稀有度">
              <select value={rarity} onChange={(e) => setRarity(e.target.value)} className="ef-field">
                <option value="all">全部稀有度</option>
                {[6, 5, 4, 3].map((n) => <option key={n} value={String(n)}>{n}★</option>)}
              </select>
            </FF>

            <FF label="卡池">
              <select value={poolName} onChange={(e) => setPoolName(e.target.value)} className="ef-field">
                <option value="all">全部卡池</option>
                {availablePools.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </FF>

            <FF label="开始日期">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="ef-field" />
            </FF>

            <FF label="结束日期">
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="ef-field" />
            </FF>
          </div>
        </div>
      </section>

      <section className="ef-sec">
        <div className="flex flex-col gap-3 border-b border-[color:var(--rule)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h3 className="ef-title text-lg">抽卡记录</h3>
            <p className="mt-1 text-sm text-muted">{filtered.length} 条匹配记录</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="font-mono">页 {safePage} / {totalPages}</span>
            <button type="button" disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="ef-btn ef-btn--sm">
              上一页
            </button>
            <button type="button" disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="ef-btn ef-btn--sm">
              下一页
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="ef-table">
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => (
                <tr key={r.record_uid}>
                  <td className="whitespace-nowrap">{formatDateTime(r.gacha_ts)}</td>
                  <td>
                    <div>{r.pool_name}</div>
                    <div className="text-xs text-muted">{r.pool_id}</div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <AvatarImg category={r.category} itemId={r.item_id} size={32} />
                      <div>
                        <div className={rarityTextClass(r.rarity)}>{r.item_name}</div>
                        <div className="text-xs text-muted">{r.item_id}</div>
                      </div>
                    </div>
                  </td>
                  {isWeapon && (
                    <td>
                      <span className="text-sm text-muted">{r.weapon_type ?? '—'}</span>
                    </td>
                  )}
                  <td><RarityBadge rarity={r.rarity} /></td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {r.is_new  ? <Flag label="首次"  tone="sig" /> : null}
                      {r.is_free ? <Flag label="免费" tone="ok" /> : null}
                    </div>
                  </td>
                  <td className="font-mono text-xs">{r.seq_id}</td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={headers.length} className="text-center text-sm text-muted">
                    暂无匹配记录。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
});

function FF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted">{label}</span>
      {children}
    </label>
  );
}

const RarityBadge = memo(function RarityBadge({ rarity }: { rarity: GachaRarity }) {
  return <span className={rarityTextClass(rarity)}>{rarity}★</span>;
});

function Flag({ label, tone }: { label: string; tone: 'sig' | 'ok' }) {
  return (
    <span className={`ef-chip ${tone === 'sig' ? 'ef-chip--sig' : 'ef-chip--ok'}`}>
      {label}
    </span>
  );
}
