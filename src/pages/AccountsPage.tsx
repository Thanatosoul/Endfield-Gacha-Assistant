import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Download, ExternalLink, RefreshCcw, Upload } from 'lucide-react';
import { useData, useAuth, useSync } from '@/app/hooks/contexts';
import { getCheckInConfig, enableCheckInConfig, deleteCheckInConfig, type CheckInConfig } from '@/modules/skland-checkin/config';

export const AccountsPage = memo(function AccountsPage() {
  const { accounts, activeAccountId, setActiveAccountId, records, importBindings, deleteAccount, refresh, exportFullJson, importJson } = useData();
  const { token, setToken, appToken, bindings, authenticating, authenticate } = useAuth();
  const { syncState, syncActiveAccount, cancelSync } = useSync();
  const [refreshing, setRefreshing] = useState(false);
  const [editingCheckInHguids, setEditingCheckInHguids] = useState<string[]>([]);
  const [checkInCfgs, setCheckInCfgs] = useState<Map<string, CheckInConfig | null>>(new Map());

  const canImportBindings = bindings.length > 0;
  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) ?? null,
    [accounts, activeAccountId],
  );

  const hasSyncedRecords = records.length > 0;

  const isSyncing = syncState.status === 'fetching_records' || syncState.status === 'authenticating' || syncState.status === 'fetching_bindings';

  const syncStatusLabel = useMemo(() => {
    switch (syncState.status) {
      case 'authenticating': return '认证中…';
      case 'fetching_bindings': return '获取绑定列表…';
      case 'fetching_records': {
        const cat = syncState.category === 'weapon' ? '武器' : '角色';
        const pool = syncState.poolIndex != null && syncState.totalPools != null
          ? `(${syncState.poolIndex}/${syncState.totalPools})`
          : '';
        return `抓取${cat}记录${pool} — 已抓 ${syncState.recordsFetched ?? 0} 条`;
      }
      case 'done': return '完成';
      case 'error': return '出错';
      case 'cancelled': return '已取消';
      default: return '空闲';
    }
  }, [syncState]);

  const syncLabel = useMemo(() => {
    if (isSyncing) return syncStatusLabel;
    return hasSyncedRecords ? '再次同步' : '开始同步';
  }, [hasSyncedRecords, isSyncing, syncStatusLabel]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const loadCheckInConfigs = useCallback(async () => {
    const uniqueHgUids = [...new Set(accounts.map((a) => a.hg_uid))];
    const map = new Map<string, CheckInConfig | null>();
    await Promise.all(
      uniqueHgUids.map(async (hgUid) => {
        const cfg = await getCheckInConfig(hgUid);
        map.set(hgUid, cfg);
      }),
    );
    setCheckInCfgs(map);
  }, [accounts]);

  useEffect(() => {
    void loadCheckInConfigs();
  }, [loadCheckInConfigs]);

  const toggleEdit = (hgUid: string) => {
    setEditingCheckInHguids((prev) =>
      prev.includes(hgUid) ? prev.filter((h) => h !== hgUid) : [...prev, hgUid],
    );
  };

  const [saveMsg, setSaveMsg] = useState<Record<string, { ok: boolean; text: string }>>({});

  const handleEnableCheckIn = async (hgUid: string) => {
    try {
      await enableCheckInConfig(hgUid);
      await loadCheckInConfigs();
      setEditingCheckInHguids((prev) => prev.filter((h) => h !== hgUid));
      setSaveMsg((prev) => ({ ...prev, [hgUid]: { ok: true, text: '已启用签到' } }));
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setSaveMsg((prev) => ({ ...prev, [hgUid]: { ok: false, text: errMsg } }));
    }
  };

  const handleDeleteCheckIn = async (hgUid: string) => {
    try {
      await deleteCheckInConfig(hgUid);
      await loadCheckInConfigs();
      setEditingCheckInHguids((prev) => prev.filter((h) => h !== hgUid));
    } catch (e) {
      console.error('[AccountsPage] Failed to delete check-in config:', e);
    }
  };

  const fmtLast = (ts: number | null) => {
    if (!ts) return '暂无';
    return new Date(ts).toLocaleString();
  };

  // Group accounts by HG UID to avoid duplicate settings panels
  const uniqueHgUids = useMemo(() => [...new Set(accounts.map((a) => a.hg_uid))], [accounts]);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      {/* left column */}
      <section className="panel rounded-[28px] p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">账号</p>
        <h3 className="mt-2 text-xl font-semibold">本地账号列表</h3>

        {/* auth form */}
        <div className="mt-5 panel-strong rounded-3xl p-5">
          <div className="grid gap-3">
            <label className="block text-sm">
              <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-muted">官方 Token</span>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="仅本地用于换取凭证，不会上传"
                className="w-full rounded-2xl border border-[color:var(--panel-border)] bg-transparent px-3 py-2 outline-none"
              />
            </label>

            <details className="mt-1 rounded-2xl border border-[color:var(--panel-border)] bg-white/[0.02]">
              <summary className="cursor-pointer px-4 py-2 text-xs text-muted hover:text-[color:var(--text-main)] transition select-none">
                Token 获取指引
              </summary>
              <div className="space-y-2 px-4 pb-3 pt-1">
                <Step num={1} label="登录森空岛">
                  <a href="https://www.skland.com/" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[color:var(--accent)] hover:underline">
                    https://www.skland.com/ <ExternalLink className="h-3 w-3" />
                  </a>
                </Step>
                <Step num={2} label="获取 Token">
                  <span className="text-muted">在已登录状态下访问</span>
                  <br />
                  <a href="https://web-api.skland.com/account/info/hg" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[color:var(--accent)] hover:underline break-all">
                    https://web-api.skland.com/account/info/hg <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                  <p className="mt-1 text-[11px] text-muted">
                    页面返回 JSON，其中 <code className="rounded bg-white/10 px-1 text-[10px]">data.content</code> 的值即为 Token
                  </p>
                </Step>
                <Step num={3} label="填入 Token">
                  将上一步获取的 Token 复制并粘贴到上方输入框，点击「认证」即可
                </Step>
              </div>
            </details>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void authenticate()}
              disabled={authenticating}
              className="rounded-2xl border border-[color:var(--accent)] bg-[color:var(--accent)]/12 px-4 py-3 text-sm disabled:opacity-50"
            >
              {authenticating ? '认证中…' : '认证'}
            </button>
            <button
              type="button"
              onClick={() => void importBindings()}
              disabled={!canImportBindings}
              className="rounded-2xl border border-[color:var(--panel-border)] px-4 py-3 text-sm disabled:opacity-50"
            >
              导入绑定 ({bindings.length})
            </button>
            <span className="self-center text-xs text-muted">
              平台: 国服{appToken ? ' · App Token 已就绪' : ''}
            </span>
          </div>
        </div>

        {/* account list */}
        <div className="mt-5 grid gap-3">
          {accounts.map((account) => {
            const cfg = checkInCfgs.get(account.hg_uid);
            const hasConfig = cfg !== null && cfg !== undefined;
            const editing = editingCheckInHguids.includes(account.hg_uid);

            return (
              <article key={account.id} className="panel-strong rounded-3xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-semibold">{account.nickname}</h4>
                    <p className="mt-1 text-sm text-muted">UID {account.uid}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasConfig && (
                      <span className="rounded-full border border-[color:var(--success)]/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-[color:var(--success)]">
                        签到
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Detail label="渠道" value={account.channel} />
                  <Detail label="HG UID" value={account.hg_uid} />
                  {hasConfig && cfg && (
                    <Detail label="上次签到" value={fmtLast(cfg.lastCheckInAt)} />
                  )}
                  <Detail label="创建时间" value={new Date(account.created_at).toLocaleString()} />
                </div>

                {hasConfig && cfg && cfg.lastResults.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cfg.lastResults.map((r, i) => (
                      <span
                        key={i}
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${r.success ? 'border-[color:var(--success)]/40 text-[color:var(--success)]' : 'border-[color:var(--danger)]/40 text-[color:var(--danger)]'}`}
                      >
                        {r.game}: {r.success ? r.awards.join(', ') || '已签' : r.error}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void setActiveAccountId(account.id)}
                    className={[
                      'rounded-2xl border px-4 py-2 text-sm',
                      account.id === activeAccountId
                        ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/12'
                        : 'border-[color:var(--panel-border)]',
                    ].join(' ')}
                  >
                    {account.id === activeAccountId ? '已选中' : '选中'}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleEdit(account.hg_uid)}
                    className="rounded-2xl border border-[color:var(--panel-border)] px-4 py-2 text-sm"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarCheck className="h-3.5 w-3.5" />
                      签到设置
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        if (!window.confirm(`确定删除账号"${account.nickname}"及其本地抽卡记录吗？`)) return;
                        try {
                          await deleteAccount(account.id);
                        } catch (e) {
                          window.alert(`删除失败: ${e instanceof Error ? e.message : String(e)}`);
                        }
                      })();
                    }}
                    className="rounded-2xl border border-red-400/50 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10"
                  >
                    删除账号
                  </button>
                </div>

                {/* Check-in settings panel */}
                {editing && uniqueHgUids.includes(account.hg_uid) && (
                  <div className="mt-4 rounded-2xl border border-[color:var(--panel-border)] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--accent)]">签到设置</p>
                    <p className="mt-1 text-xs text-muted">
                      HG UID: {account.hg_uid}
                      {hasConfig && cfg && ' · 已启用'}
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      签到将使用上方「官方 Token」对所有已绑定的游戏进行每日签到。
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {!hasConfig ? (
                        <button
                          type="button"
                          onClick={() => void handleEnableCheckIn(account.hg_uid)}
                          className="rounded-2xl border border-[color:var(--accent)] bg-[color:var(--accent)]/12 px-4 py-2 text-xs"
                        >
                          启用签到
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => toggleEdit(account.hg_uid)}
                        className="rounded-2xl border border-[color:var(--panel-border)] px-4 py-2 text-xs"
                      >
                        关闭
                      </button>
                      {hasConfig && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteCheckIn(account.hg_uid)}
                          className="rounded-2xl border border-red-400/40 px-4 py-2 text-xs text-red-300"
                        >
                          清除签到配置
                        </button>
                      )}
                    </div>

                    {saveMsg[account.hg_uid] && (
                      <div className={[
                        'mt-3 rounded-2xl px-4 py-2 text-xs',
                        saveMsg[account.hg_uid].ok
                          ? 'border border-[color:var(--success)]/40 text-[color:var(--success)]'
                          : 'border border-[color:var(--danger)]/40 text-[color:var(--danger)]',
                      ].join(' ')}>
                        {saveMsg[account.hg_uid].text}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* right column – sync panel */}
      <section className="panel rounded-[28px] p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">账号</p>
        <h3 className="mt-2 text-xl font-semibold">官方同步</h3>

        <div className="mt-5 panel-strong rounded-3xl p-5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void syncActiveAccount()}
              disabled={!selectedAccount || isSyncing}
              className="rounded-2xl border border-[color:var(--accent)] bg-[color:var(--accent)]/12 px-4 py-3 text-sm disabled:opacity-50 transition hover:bg-[color:var(--accent)]/20"
            >
              {syncLabel}
            </button>
            {isSyncing ? (
              <button
                type="button"
                onClick={cancelSync}
                className="rounded-2xl border border-red-400/40 px-4 py-3 text-sm text-red-300 hover:bg-red-500/10"
              >
                取消同步
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className="rounded-2xl border border-[color:var(--panel-border)] px-4 py-3 text-sm disabled:opacity-50"
              title="从数据库重新加载记录与账号"
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCcw className="h-4 w-4" />{refreshing ? '刷新中…' : '刷新'}
              </span>
            </button>
            <span className="w-px h-6 self-center" style={{ background: 'var(--panel-border)' }} />
            <button
              type="button"
              onClick={() => void exportFullJson()}
              className="rounded-2xl border border-[color:var(--panel-border)] px-4 py-3 text-sm transition hover:border-[color:var(--accent)]/50"
            >
              <span className="inline-flex items-center gap-2">
                <Upload className="h-4 w-4" />转移账户全部数据
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  try {
                    await importJson();
                  } catch {
                    // handled by notification in action
                  }
                })();
              }}
              className="rounded-2xl border border-[color:var(--panel-border)] px-4 py-3 text-sm transition hover:border-[color:var(--accent)]/50"
            >
              <span className="inline-flex items-center gap-2">
                <Download className="h-4 w-4" />导入账户数据
              </span>
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Detail label="同步状态" value={syncStatusLabel} />
            <Detail label="已选账号" value={selectedAccount ? `${selectedAccount.nickname} (${selectedAccount.id})` : '无'} />
            {isSyncing && syncState.category && (
              <>
                <Detail label="当前分类" value={syncState.category === 'weapon' ? '武器池' : '角色池'} />
                <Detail label="角色已抓" value={String(syncState.charRecordsFetched ?? 0)} />
                <Detail label="武器已抓" value={String(syncState.weaponRecordsFetched ?? 0)} />
              </>
            )}
            {!isSyncing && (
              <Detail label="已拉取" value={String(syncState.recordsFetched ?? 0)} />
            )}
            {syncState.error && (
              <Detail label="错误" value={syncState.error} />
            )}
          </div>
        </div>
      </section>
    </div>
  );
});

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--panel-border)] px-4 py-3">
      <div className="text-xs uppercase tracking-[0.18em] text-muted">{label}</div>
      <div className="mt-2 text-sm">{value}</div>
    </div>
  );
}

function Step({ num, label, children }: { num: number; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[color:var(--panel-border)] bg-white/[0.03] px-3 py-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--accent)]/20 text-[10px] font-bold text-[color:var(--accent)]">
          {num}
        </span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-xs text-muted pl-7">{children}</div>
    </div>
  );
}
