import { memo, useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Cloud, Download, RefreshCw } from 'lucide-react';
import { useData, useTheme } from '@/app/hooks/contexts';
import { getSecurePreference, saveSecurePreference } from '@/modules/storage/repositories';
import { isTauriRuntime } from '@/lib/runtime';

const WDAV_URL_KEY = 'webdav.url';
const WDAV_USER_KEY = 'webdav.user';
const WDAV_PASS_KEY = 'webdav.pass';

export const SettingsPage = memo(function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { storageState, pathsLabel, exportJson, importJson, exportCsv, importCsv, syncAssets } = useData();
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [csvMsg, setCsvMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [assetMsg, setAssetMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [syncingAssets, setSyncingAssets] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlistenProgress: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;
    void Promise.all([
      listen<{ checked: number; total: number; downloaded: number; skipped: number; failed: number; complete: boolean }>('assets:sync-progress', (event) => {
        const { checked, total, downloaded, skipped, failed, complete } = event.payload;
        if (complete) {
          setSyncingAssets(false);
          setAssetMsg({ ok: failed === 0, text: `图片同步完成：检查 ${total}，下载 ${downloaded}，跳过 ${skipped}${failed ? `，失败 ${failed}` : ''}` });
        } else {
          setSyncingAssets(true);
          setAssetMsg({ ok: true, text: `正在后台检查图片缓存：${checked}/${total}（下载 ${downloaded}，跳过 ${skipped}）` });
        }
      }),
      listen<string>('assets:sync-error', (event) => {
        setSyncingAssets(false);
        setAssetMsg({ ok: false, text: `图片缓存同步失败：${event.payload}` });
      }),
    ]).then(([progress, error]) => {
      unlistenProgress = progress;
      unlistenError = error;
    });
    return () => { unlistenProgress?.(); unlistenError?.(); };
  }, []);

  // WebDAV state
  const [wdavUrl, setWdavUrl] = useState('');
  const [wdavUser, setWdavUser] = useState('');
  const [wdavPass, setWdavPass] = useState('');
  const [wdavMsg, setWdavMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [wdavTesting, setWdavTesting] = useState(false);
  const [wdavBacking, setWdavBacking] = useState(false);
  const [wdavBackups, setWdavBackups] = useState<string[]>([]);
  const [wdavRestoring, setWdavRestoring] = useState(false);

  // Load saved configs
  useEffect(() => {
    void (async () => {
      const [url, user, pass] = await Promise.all([
        getSecurePreference(WDAV_URL_KEY),
        getSecurePreference(WDAV_USER_KEY),
        getSecurePreference(WDAV_PASS_KEY),
      ]);
      if (url) setWdavUrl(url);
      if (user) setWdavUser(user);
      if (pass) setWdavPass(pass);
    })();
  }, []);

  const handleExportJson = async () => {
    try {
      const path = await exportJson();
      if (path != null && path.length > 0) {
        setImportMsg({ ok: true, text: path });
      }
    } catch (e) {
      setImportMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleImportJson = async () => {
    try {
      const result = await importJson();
      const label = result.fromLegacy
        ? `旧版格式已转换 · ${result.accounts} 账号, ${result.records} 条记录`
        : `${result.accounts} accounts, ${result.records} records`;
      setImportMsg({ ok: true, text: label });
    } catch (e) {
      setImportMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleExportCsv = async () => {
    try {
      const path = await exportCsv();
      if (path != null && path.length > 0) {
        setCsvMsg({ ok: true, text: path });
      }
    } catch (e) {
      setCsvMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleImportCsv = async () => {
    try {
      const count = await importCsv();
      setCsvMsg({ ok: true, text: `已导入 ${count} 条记录` });
    } catch (e) {
      setCsvMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleSyncAssets = async () => {
    setSyncingAssets(true);
    try {
      const result = await syncAssets();
      setAssetMsg({
        ok: true,
        text: result.cacheStarted
          ? `已检查 ${result.pools} 个卡池，版本 ${result.version}。图片正后台全量检查并增量下载。`
          : `已检查 ${result.pools} 个卡池，资源版本 ${result.version}；图片缓存任务已在运行。`,
      });
    } catch (error) {
      setAssetMsg({ ok: false, text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSyncingAssets(false);
    }
  };

  // ─── WebDAV ─────────────────────────────────────────────────────

  const saveWdavConfig = useCallback(async () => {
    await Promise.all([
      saveSecurePreference(WDAV_URL_KEY, wdavUrl),
      saveSecurePreference(WDAV_USER_KEY, wdavUser),
      saveSecurePreference(WDAV_PASS_KEY, wdavPass),
    ]);
    setWdavMsg({ ok: true, text: '配置已保存' });
  }, [wdavUrl, wdavUser, wdavPass]);

  const handleWdavTest = async () => {
    if (!isTauriRuntime()) { setWdavMsg({ ok: false, text: '仅桌面端可用' }); return; }
    setWdavTesting(true);
    try {
      const result = await invoke<string>('webdav_test', { url: wdavUrl, username: wdavUser, password: wdavPass });
      setWdavMsg({ ok: true, text: result });
    } catch (e) {
      setWdavMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setWdavTesting(false);
    }
  };

  const handleWdavBackup = async () => {
    if (!isTauriRuntime()) { setWdavMsg({ ok: false, text: '仅桌面端可用' }); return; }
    setWdavBacking(true);
    try {
      const dataDir = await invoke<string>('pool_source_dir');
      const name = await invoke<string>('webdav_backup', { url: wdavUrl, username: wdavUser, password: wdavPass, dataDir });
      setWdavMsg({ ok: true, text: `备份成功: ${name}` });
    } catch (e) {
      setWdavMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setWdavBacking(false);
    }
  };

  const handleWdavList = async () => {
    if (!isTauriRuntime()) return;
    try {
      const list = await invoke<string[]>('webdav_list_backups', { url: wdavUrl, username: wdavUser, password: wdavPass });
      setWdavBackups(list);
    } catch (e) {
      setWdavMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleWdavRestore = async (name: string) => {
    if (!isTauriRuntime()) return;
    setWdavRestoring(true);
    try {
      const dataDir = await invoke<string>('pool_source_dir');
      await invoke('webdav_restore', { url: wdavUrl, username: wdavUser, password: wdavPass, dataDir, backupName: name });
      setWdavMsg({ ok: true, text: `已恢复: ${name}。请重启应用。` });
    } catch (e) {
      setWdavMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setWdavRestoring(false);
    }
  };

  // ─── Update ─────────────────────────────────────────────────────

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      {/* left: preferences */}
      <section className="panel rounded-[28px] p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">偏好设置</p>
        <h3 className="mt-2 text-xl font-semibold">主题与本地行为</h3>

        <div className="mt-5 grid gap-3">
          <div className="panel-strong rounded-3xl p-5">
            <div className="flex flex-wrap gap-3">
              <ThemeBtn active={theme === 'dark'}  label="深色主题"  onClick={() => void setTheme('dark')} />
              <ThemeBtn active={theme === 'light'} label="浅色主题" onClick={() => void setTheme('light')} />
            </div>
          </div>

          <div className="panel-strong rounded-3xl p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--accent)]">资源同步</div>
            <p className="mt-3 text-sm text-muted">启动时后台检查卡池数据。手动同步会全量检查卡池和图片，但只下载缺失或已变化的图片，不会阻塞使用。</p>
            <ActionBtn onClick={() => void handleSyncAssets()} disabled={syncingAssets}>
              <RefreshCw className={syncingAssets ? 'animate-spin' : ''} />
              {syncingAssets ? '同步中…' : '同步资源'}
            </ActionBtn>
            {assetMsg && <MsgBanner {...assetMsg} onDismiss={() => setAssetMsg(null)} />}
          </div>

          {/* JSON backup */}
          <div className="panel-strong rounded-3xl p-5">
            <div className="mb-3 text-xs uppercase tracking-[0.18em] text-[color:var(--accent)]">
              导入 / 导出
            </div>
            <div className="flex flex-wrap gap-3">
              <ActionBtn onClick={() => void handleExportJson()}>导出 JSON</ActionBtn>
              <ActionBtn onClick={() => void handleImportJson()}>导入 JSON</ActionBtn>
              <ActionBtn onClick={() => void handleExportCsv()}>导出 CSV</ActionBtn>
              <ActionBtn onClick={() => void handleImportCsv()}>导入 CSV</ActionBtn>
            </div>
            {importMsg && <MsgBanner {...importMsg} onDismiss={() => setImportMsg(null)} />}
            {csvMsg && <MsgBanner {...csvMsg} onDismiss={() => setCsvMsg(null)} />}
            <p className="mt-4 text-sm text-muted">文件对话框使用 Tauri 插件，导入时自动去重。CSV 可在 Excel 中查看编辑。</p>
          </div>

          {/* WebDAV backup */}
          <div className="panel-strong rounded-3xl p-5">
            <div className="mb-3 text-xs uppercase tracking-[0.18em] text-[color:var(--accent)]">
              <span className="inline-flex items-center gap-1.5"><Cloud className="h-3.5 w-3.5" />WebDAV 备份</span>
            </div>

            <div className="grid gap-2">
              <input type="text" value={wdavUrl} onChange={(e) => setWdavUrl(e.target.value)}
                placeholder="https://your-webdav-server.com/dav/"
                className="w-full rounded-xl border border-[color:var(--panel-border)] bg-transparent px-3 py-2 text-sm outline-none" />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={wdavUser} onChange={(e) => setWdavUser(e.target.value)}
                  placeholder="用户名" className="w-full rounded-xl border border-[color:var(--panel-border)] bg-transparent px-3 py-2 text-sm outline-none" />
                <input type="password" value={wdavPass} onChange={(e) => setWdavPass(e.target.value)}
                  placeholder="密码" className="w-full rounded-xl border border-[color:var(--panel-border)] bg-transparent px-3 py-2 text-sm outline-none" />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <ActionBtn onClick={() => void saveWdavConfig()}>保存配置</ActionBtn>
              <ActionBtn onClick={() => void handleWdavTest()}>{wdavTesting ? '测试中…' : '测试连接'}</ActionBtn>
              <ActionBtn onClick={() => void handleWdavBackup()}>{wdavBacking ? '备份中…' : '立即备份'}</ActionBtn>
            </div>

            <div className="mt-3">
              <button type="button" onClick={() => void handleWdavList()}
                className="rounded-xl border border-[color:var(--panel-border)] px-3 py-1.5 text-xs text-muted transition hover:text-[color:var(--text-main)]">
                列出备份
              </button>
              {wdavBackups.length > 0 && (
                <div className="mt-2 max-h-32 overflow-auto rounded-xl border border-[color:var(--panel-border)] p-2">
                  {wdavBackups.map((name) => (
                    <div key={name} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs hover:bg-white/5">
                      <span className="text-muted truncate">{name}</span>
                      <button type="button" onClick={() => void handleWdavRestore(name)}
                        disabled={wdavRestoring}
                        className="shrink-0 rounded-lg border border-[color:var(--panel-border)] px-2 py-0.5 text-[10px] disabled:opacity-50">
                        <Download className="inline h-3 w-3" /> 恢复
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {wdavMsg && <MsgBanner {...wdavMsg} onDismiss={() => setWdavMsg(null)} />}
          </div>

          {/* token safety */}
          <div className="panel-strong rounded-3xl p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--accent)]">Token 安全</div>
            <p className="mt-3 text-sm text-muted">Token 和密码使用设备指纹加密存储，仅本地可解密。</p>
          </div>
        </div>
      </section>

      {/* right: runtime + updates */}
      <section className="panel rounded-[28px] p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">运行时状态</p>
        <h3 className="mt-2 text-xl font-semibold">桌面集成状态</h3>

        <div className="mt-5 grid gap-3">
          <StatusCard label="存储初始化" value={storageState} />
          <StatusCard label="数据目录路径" value={pathsLabel} />
        </div>
      </section>
    </div>
  );
});

// ─── Internal components ──────────────────────────────────────────

function ThemeBtn({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={[
        'rounded-2xl border px-4 py-3 text-sm transition',
        active
          ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/12 text-[color:var(--text-main)]'
          : 'border-[color:var(--panel-border)] text-muted hover:text-[color:var(--text-main)]',
      ].join(' ')}>
      {label}
    </button>
  );
}

function ActionBtn({ children, onClick, disabled = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--panel-border)] px-4 py-3 text-sm transition hover:border-[color:var(--accent)]/50 disabled:cursor-wait disabled:opacity-60">
      {children}
    </button>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-strong rounded-3xl p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--accent)]">{label}</div>
      <div className="mt-3 text-sm text-muted break-all">{value}</div>
    </div>
  );
}

function MsgBanner({ ok, text, onDismiss }: { ok: boolean; text: string; onDismiss: () => void }) {
  return (
    <div className={[
      'mt-4 rounded-2xl px-4 py-3 text-sm',
      ok
        ? 'border border-[color:var(--success)]/40 text-[color:var(--success)]'
        : 'border border-[color:var(--danger)]/40 text-[color:var(--danger)]',
    ].join(' ')}>
      {text}
      <button type="button" onClick={onDismiss} className="ml-3 text-xs opacity-60 hover:opacity-100">✕</button>
    </div>
  );
}
